/**
 * ARIZAR IA — Handlers de webhooks ENTRANTES (sync inverso CRM → DB local).
 *
 * GoHighLevel/ARIZAR dispara webhooks cuando algo cambia en el CRM (un mensaje
 * entra, un contacto se edita, una cita se mueve, una factura se paga…). Este
 * módulo refleja esos cambios en la base local para que el admin no tenga que ir
 * al CRM. Es la contraparte de arizarSync.js (que empuja local → CRM).
 *
 * Convenciones:
 *   - Recibe `prisma` (el singleton `req.prisma`, NUNCA instancia PrismaClient).
 *   - Cada handler es idempotente a nivel de fila: el dedup global por
 *     WebhookEvent vive en webhooks.js, pero un mismo cambio reprocesado no debe
 *     duplicar Conversation/Message/etc., así que upserteamos por ids del CRM.
 *   - No tira hacia afuera: los errores se propagan a webhooks.js, que marca el
 *     WebhookEvent como `failed` (y ya respondió 200 al CRM para no provocar
 *     reintentos infinitos sobre un evento envenenado).
 */

// ── Helpers de extracción de campos (GHL manda nombres inconsistentes) ──────

/** Saca el primer valor no-vacío de una lista de posibles claves en varios objetos. */
function pick(sources, keys) {
  for (const src of sources) {
    if (!src) continue;
    for (const k of keys) {
      const v = src[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
  }
  return null;
}

/** Normaliza el canal a los valores del enum de Conversation/Message. */
function normalizeChannel(raw) {
  if (!raw) return 'WhatsApp';
  const s = String(raw).toLowerCase();
  if (s.includes('whatsapp') || s === 'wa') return 'WhatsApp';
  if (s.includes('sms')) return 'SMS';
  if (s.includes('email') || s.includes('mail')) return 'Email';
  if (s.includes('live') || s.includes('chat') || s.includes('webchat')) return 'Live_Chat';
  if (s.includes('ig') || s.includes('instagram')) return 'Custom';
  if (s.includes('fb') || s.includes('facebook') || s.includes('messenger')) return 'Custom';
  return 'Custom';
}

/** Resuelve el userId local a partir del contactId del CRM (puede ser null). */
async function resolveUserId(prisma, contactId) {
  if (!contactId) return null;
  const user = await prisma.user.findFirst({
    where: { arizarContactId: contactId },
    select: { id: true },
  });
  return user?.id || null;
}

// ── Conversaciones / Mensajes ───────────────────────────────────────────────

/**
 * InboundMessage / OutboundMessage → upsert Conversation + crea Message.
 * direction se infiere del `type` del evento; inbound incrementa unreadCount.
 */
async function handleMessage(prisma, { type, body, data }) {
  const direction = type === 'OutboundMessage' ? 'outbound' : 'inbound';

  const contactId = pick([body, data], ['contactId', 'contact_id']);
  const arizarConversationId = pick([body, data], ['conversationId', 'conversation_id']);
  const arizarMessageId = pick([body, data], ['messageId', 'message_id', 'id']);
  const channel = normalizeChannel(pick([body, data], ['messageType', 'message_type', 'channel', 'type']));
  const messageBody = pick([data, body], ['body', 'message', 'text']);
  const attachments = pick([data, body], ['attachments']);
  const isAi = Boolean(pick([data, body], ['isAi', 'is_ai']));

  // Sin nada que identifique la conversación no hay forma de agrupar mensajes.
  if (!arizarConversationId && !contactId) {
    return { skipped: 'mensaje sin conversationId ni contactId' };
  }

  const userId = await resolveUserId(prisma, contactId);
  const now = new Date();

  // ── Localizar/crear la conversación ──
  // Preferimos arizarConversationId (es @unique); si no vino, agrupamos por
  // contactId (la "conversación" lógica de ese contacto en este canal).
  let conversation = null;
  if (arizarConversationId) {
    conversation = await prisma.conversation.findUnique({
      where: { arizarConversationId },
    });
  }
  if (!conversation && contactId) {
    conversation = await prisma.conversation.findFirst({
      where: { arizarContactId: contactId, channel },
      orderBy: { createdAt: 'desc' },
    });
  }

  const convData = {
    userId,
    arizarContactId: contactId,
    channel,
    lastMessageAt: now,
    lastMessageBody: messageBody ? String(messageBody).substring(0, 500) : null,
    status: 'open',
  };

  if (conversation) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        ...convData,
        // Solo cambiamos userId si lo resolvimos ahora (no pisar con null).
        userId: userId ?? conversation.userId,
        // Adjuntamos el conversationId del CRM si recién ahora lo conocemos.
        arizarConversationId: conversation.arizarConversationId || arizarConversationId || undefined,
        unreadCount: direction === 'inbound' ? { increment: 1 } : conversation.unreadCount,
      },
    });
  } else {
    try {
      conversation = await prisma.conversation.create({
        data: {
          ...convData,
          arizarConversationId: arizarConversationId || undefined,
          unreadCount: direction === 'inbound' ? 1 : 0,
        },
      });
    } catch (e) {
      // Carrera: otra entrega creó la conversación con el mismo
      // arizarConversationId (@unique) entre el find y el create. La recuperamos.
      if (e.code === 'P2002' && arizarConversationId) {
        conversation = await prisma.conversation.findUnique({ where: { arizarConversationId } });
        if (conversation) {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              ...convData,
              userId: userId ?? conversation.userId,
              unreadCount: direction === 'inbound' ? { increment: 1 } : conversation.unreadCount,
            },
          });
        }
      } else {
        throw e;
      }
    }
  }

  if (!conversation) return { skipped: 'no se pudo materializar la conversación' };

  // ── Crear el Message (idempotente por arizarMessageId @unique) ──
  if (arizarMessageId) {
    const dup = await prisma.message.findUnique({ where: { arizarMessageId } });
    if (dup) return { conversationId: conversation.id, messageId: dup.id, duplicate: true };
  }

  try {
    const msg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        arizarMessageId: arizarMessageId || undefined,
        direction,
        channel,
        body: messageBody ? String(messageBody) : null,
        attachmentsJson: attachments || undefined,
        isAi,
        status: 'sent',
      },
    });
    return { conversationId: conversation.id, messageId: msg.id, direction };
  } catch (e) {
    if (e.code === 'P2002') {
      // arizarMessageId duplicado por carrera: ya existe, idempotente.
      return { conversationId: conversation.id, duplicate: true };
    }
    throw e;
  }
}

// ── Contactos ────────────────────────────────────────────────────────────────

/**
 * ContactUpdate → actualiza el User local (firstName/lastName/phone/email) si el
 * arizarContactId matchea. No crea usuarios: eso lo maneja PaymentReceived/OrderCreate.
 */
async function handleContactUpdate(prisma, { body, data }) {
  const contactId = pick([body, data], ['contactId', 'contact_id', 'id']);
  if (!contactId) return { skipped: 'sin contactId' };

  const user = await prisma.user.findFirst({ where: { arizarContactId: contactId } });
  if (!user) return { skipped: 'contacto sin usuario local' };

  const firstName = pick([data, body], ['firstName', 'first_name']);
  const lastName = pick([data, body], ['lastName', 'last_name']);
  const phone = pick([data, body], ['phone']);
  const email = pick([data, body], ['email']);

  const update = {};
  if (firstName) update.firstName = firstName;
  if (lastName) update.lastName = lastName;
  if (phone) update.phone = phone;
  // El email es @unique: solo lo cambiamos si difiere y no choca con otro user.
  if (email && email !== user.email) {
    const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!clash) update.email = email;
  }

  if (Object.keys(update).length === 0) return { skipped: 'sin cambios' };

  await prisma.user.update({ where: { id: user.id }, data: update });
  return { userId: user.id, updated: Object.keys(update) };
}

// ── Citas ────────────────────────────────────────────────────────────────────

/**
 * AppointmentCreate/Update/Delete → refleja en la Appointment local cuando hay un
 * arizarAppointmentId que matchea (o se crea la cita si viene completa en Create).
 */
async function handleAppointment(prisma, { type, body, data }) {
  const arizarAppointmentId = pick([body, data], ['appointmentId', 'appointment_id', 'id']);
  const contactId = pick([body, data], ['contactId', 'contact_id']);
  if (!arizarAppointmentId) return { skipped: 'sin arizarAppointmentId' };

  const startTimeStr = pick([data, body], ['startTime', 'start_time']);
  const endTimeStr = pick([data, body], ['endTime', 'end_time']);
  const title = pick([data, body], ['title']);
  const rawStatus = String(pick([data, body], ['status', 'appointmentStatus']) || '').toLowerCase();

  const existing = await prisma.appointment.findFirst({ where: { arizarAppointmentId } });

  // ── Delete / Cancel ──
  if (type === 'AppointmentDelete') {
    if (!existing) return { skipped: 'cita inexistente local' };
    await prisma.appointment.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
    return { appointmentId: existing.id, action: 'cancelled' };
  }

  // Mapeo de estados del CRM → enum local.
  const statusMap = {
    cancelled: 'CANCELLED',
    canceled: 'CANCELLED',
    confirmed: 'CONFIRMED',
    showed: 'COMPLETED',
    completed: 'COMPLETED',
    noshow: 'NO_SHOW',
    'no-show': 'NO_SHOW',
    no_show: 'NO_SHOW',
  };
  const mappedStatus = statusMap[rawStatus];

  // ── Update ──
  if (existing) {
    const update = {};
    if (mappedStatus) update.status = mappedStatus;
    if (startTimeStr) update.startTime = new Date(startTimeStr);
    if (endTimeStr) update.endTime = new Date(endTimeStr);
    if (title) update.notes = title;
    if (Object.keys(update).length === 0) return { appointmentId: existing.id, skipped: 'sin cambios' };
    await prisma.appointment.update({ where: { id: existing.id }, data: update });
    return { appointmentId: existing.id, action: 'updated', fields: Object.keys(update) };
  }

  // ── Create (solo si tenemos contacto local, hora y un servicio default) ──
  if (type !== 'AppointmentCreate') return { skipped: 'update de cita inexistente local' };
  if (!startTimeStr || !contactId) return { skipped: 'create sin startTime o contactId' };

  const userId = await resolveUserId(prisma, contactId);
  if (!userId) return { skipped: 'contacto sin usuario local' };

  const service = await prisma.service.findFirst({ orderBy: { sortOrder: 'asc' } });
  if (!service) return { skipped: 'no hay servicio default para mapear la cita' };

  // Resolver/crear un vehículo (la cita local requiere vehicleId NOT NULL).
  let vehicle =
    (await prisma.vehicle.findFirst({ where: { userId, isPrimary: true } })) ||
    (await prisma.vehicle.findFirst({ where: { userId } }));
  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: { userId, brand: 'Genérico', model: 'Desde ARIZAR', licensePlate: 'S/D', isPrimary: true },
    });
  }

  const start = new Date(startTimeStr);
  const end = endTimeStr ? new Date(endTimeStr) : new Date(start.getTime() + 60 * 60000);

  try {
    const appt = await prisma.appointment.create({
      data: {
        userId,
        serviceId: service.id,
        vehicleId: vehicle.id,
        date: start,
        startTime: start,
        endTime: end,
        status: mappedStatus || 'CONFIRMED',
        arizarAppointmentId,
        notes: title || 'Agendado desde ARIZAR IA',
      },
    });
    return { appointmentId: appt.id, action: 'created' };
  } catch (e) {
    // arizarAppointmentId @unique: carrera con otra entrega. Idempotente.
    if (e.code === 'P2002') {
      const dup = await prisma.appointment.findFirst({ where: { arizarAppointmentId } });
      return { appointmentId: dup?.id, duplicate: true };
    }
    throw e;
  }
}

// ── Oportunidades (pipeline) ─────────────────────────────────────────────────

/**
 * OpportunityStatusUpdate / OpportunityStageUpdate → log + mapeo best-effort a
 * Membership/MembershipRequest. GHL marca oportunidades won/lost y mueve etapas;
 * lo reflejamos en el lead local si lo encontramos por arizarContactId.
 */
async function handleOpportunity(prisma, { type, body, data }) {
  const contactId = pick([body, data], ['contactId', 'contact_id']);
  const opportunityId = pick([body, data], ['opportunityId', 'opportunity_id', 'id']);
  const status = String(pick([data, body], ['status']) || '').toLowerCase();
  const stageId = pick([data, body], ['pipelineStageId', 'pipeline_stage_id', 'stageId', 'stage_id']);

  const result = { type, opportunityId, contactId, status, stageId, effects: [] };

  if (!contactId) return result;

  // ── MembershipRequest (lead público) ──
  // Si el contacto vino de la landing, movemos su estado según won/lost.
  const leadStatus = status === 'won' ? 'CONVERTED' : status === 'lost' || status === 'abandoned' ? 'DISCARDED' : null;
  if (leadStatus) {
    const reqs = await prisma.membershipRequest.findMany({
      where: { arizarContactId: contactId, status: { notIn: ['CONVERTED', 'DISCARDED'] } },
    }) || [];
    for (const r of reqs) {
      await prisma.membershipRequest.update({ where: { id: r.id }, data: { status: leadStatus } });
      result.effects.push(`membershipRequest:${r.id}→${leadStatus}`);
    }
  }

  // ── Membership (cliente con cuenta) ──
  // Una oportunidad "lost" no cancela una membresía activa por sí sola (eso lo
  // hace SubscriptionCancel), pero lo dejamos como nota auditable. Si en el
  // futuro el pipeline mapea 1:1 a planes, este es el punto de extensión.
  const user = await prisma.user.findFirst({ where: { arizarContactId: contactId }, select: { id: true } });
  if (user) result.userId = user.id;

  return result;
}

// ── Facturas ─────────────────────────────────────────────────────────────────

/**
 * InvoicePaid → marca el Payment local COMPLETED si encontramos arizarInvoiceId.
 */
async function handleInvoicePaid(prisma, { body, data }) {
  const arizarInvoiceId = pick([body, data], ['invoiceId', 'invoice_id', 'id']);
  if (!arizarInvoiceId) return { skipped: 'sin arizarInvoiceId' };

  const payments = await prisma.payment.findMany({
    where: { arizarInvoiceId, status: { not: 'COMPLETED' } },
  }) || [];
  if (payments.length === 0) return { skipped: 'sin Payment local pendiente para esa factura' };

  const ids = [];
  for (const p of payments) {
    await prisma.payment.update({ where: { id: p.id }, data: { status: 'COMPLETED' } });
    ids.push(p.id);
  }
  return { paymentsMarked: ids };
}

/**
 * Dispatcher principal: recibe el evento ya parseado y delega al handler por type.
 * Devuelve un objeto-resumen que webhooks.js loguea en WebhookEvent.
 *
 * @param {object} prisma  req.prisma (singleton)
 * @param {object} evt     { type, body, data }
 */
async function handleArizarEvent(prisma, evt) {
  const { type } = evt;
  switch (type) {
    case 'InboundMessage':
    case 'OutboundMessage':
      return handleMessage(prisma, evt);

    case 'ContactUpdate':
      return handleContactUpdate(prisma, evt);

    case 'AppointmentCreate':
    case 'AppointmentUpdate':
    case 'AppointmentDelete':
      return handleAppointment(prisma, evt);

    case 'OpportunityStatusUpdate':
    case 'OpportunityStageUpdate':
      return handleOpportunity(prisma, evt);

    case 'InvoicePaid':
      return handleInvoicePaid(prisma, evt);

    default:
      return { skipped: `tipo no manejado por sync inverso: ${type}` };
  }
}

module.exports = {
  handleArizarEvent,
  // Exportados para tests unitarios / reuso puntual.
  handleMessage,
  handleContactUpdate,
  handleAppointment,
  handleOpportunity,
  handleInvoicePaid,
  normalizeChannel,
};
