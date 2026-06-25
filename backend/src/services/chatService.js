const arizarService = require('./arizarService');

let Anthropic = null;
try {
  // Carga perezosa: si el paquete no está instalado, no rompe el arranque del backend.
  Anthropic = require('@anthropic-ai/sdk');
} catch (e) {
  console.warn('⚠️ @anthropic-ai/sdk no está instalado; el chat IA usará respuestas de fallback');
}

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 600;

// ─────────────────────────────────────────────────────────────
//  Helpers de formato
// ─────────────────────────────────────────────────────────────

function gs(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return `₲${Number(n).toLocaleString('es-PY')}`;
}

function fullName(user) {
  if (!user) return 'Cliente';
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Cliente';
}

// ─────────────────────────────────────────────────────────────
//  ADMIN — Bandeja de conversaciones
// ─────────────────────────────────────────────────────────────

/**
 * Lista las conversaciones para el panel admin, ordenadas por última actividad.
 * Resuelve el nombre de contacto desde el User asociado (si existe).
 */
async function listConversations(prisma) {
  const conversations = await prisma.conversation.findMany({
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    take: 100,
  });

  const userIds = [...new Set(conversations.map(c => c.userId).filter(Boolean))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  return conversations.map(c => ({
    id: c.id,
    userId: c.userId,
    contactName: c.userId && userMap.get(c.userId) ? fullName(userMap.get(c.userId)) : 'Contacto',
    channel: c.channel,
    lastMessageBody: c.lastMessageBody,
    lastMessageAt: c.lastMessageAt,
    unreadCount: c.unreadCount,
    status: c.status,
  }));
}

/** Mensajes de una conversación, en orden cronológico. */
async function listMessages(prisma, conversationId) {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  return messages.map(m => ({
    id: m.id,
    direction: m.direction,
    channel: m.channel,
    body: m.body,
    isAi: m.isAi,
    createdAt: m.createdAt,
  }));
}

/**
 * El admin responde al cliente: envía vía arizarService (según canal),
 * crea el Message outbound y actualiza el resumen de la Conversation.
 */
async function sendAdminMessage(prisma, conversationId, { body, channel }) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    const err = new Error('Conversación no encontrada');
    err.statusCode = 404;
    throw err;
  }

  const effectiveChannel = channel || conversation.channel || 'Live_Chat';

  // Enviar al cliente vía ARIZAR según el canal (best-effort; no rompe si ARIZAR falla)
  await deliverToCustomer(conversation, effectiveChannel, body);

  const now = new Date();
  const message = await prisma.message.create({
    data: {
      conversationId,
      direction: 'outbound',
      channel: effectiveChannel,
      body,
      isAi: false,
      status: 'sent',
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: now,
      lastMessageBody: body,
      status: 'open',
    },
  });

  return {
    id: message.id,
    direction: message.direction,
    channel: message.channel,
    body: message.body,
    isAi: message.isAi,
    createdAt: message.createdAt,
  };
}

/**
 * Entrega el mensaje del admin al cliente por el canal correspondiente.
 * arizarService no tiene un `sendMessage` genérico, así que ruteamos a los
 * métodos existentes (sendWhatsApp / sendSMS / sendEmail). Para Live_Chat
 * solo se persiste (el cliente lo verá en su chat in-app vía polling).
 */
async function deliverToCustomer(conversation, channel, body) {
  const contactId = conversation.arizarContactId;
  if (!contactId) return; // sin contacto ARIZAR no hay a quién enviar (ej. Live_Chat in-app)

  try {
    switch (channel) {
      case 'WhatsApp':
        await arizarService.sendWhatsApp(contactId, body);
        break;
      case 'SMS':
        await arizarService.sendSMS(contactId, body);
        break;
      case 'Email':
        await arizarService.sendEmail(contactId, 'Luxury Garage', body);
        break;
      default:
        // Live_Chat / Custom → solo persistencia; no hay canal externo
        break;
    }
  } catch (e) {
    console.error('❌ chatService: error entregando mensaje al cliente vía ARIZAR:', e.message);
  }
}

/** Marca la conversación como leída (unreadCount = 0). */
async function markRead(prisma, conversationId) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    const err = new Error('Conversación no encontrada');
    err.statusCode = 404;
    throw err;
  }
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });
}

/** Suma de mensajes sin leer en todas las conversaciones abiertas. */
async function unreadCount(prisma) {
  const result = await prisma.conversation.aggregate({
    _sum: { unreadCount: true },
  });
  return result._sum.unreadCount || 0;
}

// ─────────────────────────────────────────────────────────────
//  CLIENTE — Contexto y chat con IA
// ─────────────────────────────────────────────────────────────

/**
 * Reúne el contexto real del cliente logueado: nombre, vehículos,
 * membresía activa, próxima reserva y saldo de billetera (créditos).
 */
async function getClientContext(prisma, userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const [vehicles, membership, nextBooking, credits] = await Promise.all([
    prisma.vehicle.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      select: { brand: true, model: true, year: true, color: true, size: true, licensePlate: true, isPrimary: true },
    }),
    prisma.membership.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { endDate: 'desc' },
      include: { plan: { select: { name: true, priceGs: true, slug: true } } },
    }),
    prisma.appointment.findFirst({
      where: { userId, startTime: { gte: new Date() }, status: { in: ['PENDING', 'CONFIRMED'] } },
      orderBy: { startTime: 'asc' },
      include: {
        service: { select: { name: true } },
        vehicle: { select: { brand: true, model: true } },
      },
    }),
    prisma.credit.findMany({
      where: { userId },
      select: { amount: true, type: true },
    }),
  ]);

  // Saldo de billetera = suma de créditos (cargas/recargas suman, consumos restan).
  const walletBalance = credits.reduce((acc, c) => acc + (c.amount || 0), 0);

  return {
    user,
    name: fullName(user),
    vehicles: vehicles.map(v => ({
      brand: v.brand,
      model: v.model,
      year: v.year,
      color: v.color,
      size: v.size,
      licensePlate: v.licensePlate,
      isPrimary: v.isPrimary,
    })),
    membership: membership
      ? {
          plan: membership.plan?.name || null,
          priceGs: membership.plan?.priceGs || null,
          status: membership.status,
          endDate: membership.endDate,
        }
      : null,
    nextBooking: nextBooking
      ? {
          service: nextBooking.service?.name || null,
          vehicle: nextBooking.vehicle ? `${nextBooking.vehicle.brand} ${nextBooking.vehicle.model}` : null,
          startTime: nextBooking.startTime,
          status: nextBooking.status,
        }
      : null,
    walletBalance,
  };
}

/** Devuelve el contexto en el shape público que consume el frontend. */
async function getClientContextPublic(prisma, userId) {
  const ctx = await getClientContext(prisma, userId);
  return {
    name: ctx.name,
    vehicles: ctx.vehicles,
    membership: ctx.membership,
    nextBooking: ctx.nextBooking,
    walletBalance: ctx.walletBalance,
  };
}

/**
 * Construye el system prompt en español con info REAL del negocio
 * (servicios y planes traídos de la BD) + contexto del cliente.
 */
async function buildSystemPrompt(prisma, ctx) {
  const [services, plans] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { name: true, description: true, basePriceGs: true, pricingBySize: true, durationMinutes: true },
    }),
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { name: true, description: true, priceGs: true },
    }),
  ]);

  const serviceLines = services.length
    ? services.map(s => {
        const sizes = s.pricingBySize && typeof s.pricingBySize === 'object'
          ? Object.entries(s.pricingBySize)
              .filter(([, price]) => price != null)
              .map(([size, price]) => `${size}: ${gs(price)}`)
              .join(', ')
          : null;
        const priceText = sizes || (s.basePriceGs ? `desde ${gs(s.basePriceGs)}` : 'precio a consultar');
        const duration = s.durationMinutes ? ` (~${s.durationMinutes} min)` : '';
        return `- ${s.name}${duration}: ${priceText}${s.description ? ` — ${s.description}` : ''}`;
      }).join('\n')
    : '- (Catálogo de servicios en actualización; ofrecé consultar con un asesor)';

  const planLines = plans.length
    ? plans.map(p => `- ${p.name}: ${p.priceGs ? `${gs(p.priceGs)}/mes` : 'precio a consultar'}${p.description ? ` — ${p.description}` : ''}`).join('\n')
    : '- (Planes de membresía en definición)';

  // Contexto del cliente
  const vehicleText = ctx.vehicles.length
    ? ctx.vehicles.map(v => `${v.brand} ${v.model}${v.year ? ` ${v.year}` : ''}${v.licensePlate ? ` (placa ${v.licensePlate})` : ''}`).join('; ')
    : 'sin vehículos registrados';

  const membershipText = ctx.membership
    ? `${ctx.membership.plan}${ctx.membership.priceGs ? ` (${gs(ctx.membership.priceGs)}/mes)` : ''}, vigente`
    : 'sin membresía activa';

  const bookingText = ctx.nextBooking
    ? `${ctx.nextBooking.service || 'servicio'}${ctx.nextBooking.vehicle ? ` para ${ctx.nextBooking.vehicle}` : ''} el ${new Date(ctx.nextBooking.startTime).toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}`
    : 'no tiene reservas próximas';

  const walletText = ctx.walletBalance ? gs(ctx.walletBalance) : '₲0';

  return `Sos el asistente virtual de Luxury Garage, un servicio premium de lavado y detailing automotriz en Paraguay.

Tu rol es atender a los clientes con calidez, profesionalismo y precisión. Respondé SIEMPRE en español paraguayo, de forma breve y clara. No inventes datos: si no tenés la información, ofrecé derivar con un asesor humano.

INFORMACIÓN DEL NEGOCIO:
- Luxury Garage ofrece lavado y detailing premium para vehículos.
- Los pagos se procesan exclusivamente por Bancard (tarjetas, membresías, recargas de billetera).
- Hay planes de membresía mensual con beneficios y servicios incluidos.
- Los precios varían según el tamaño del vehículo.

SERVICIOS DISPONIBLES (datos reales):
${serviceLines}

PLANES DE MEMBRESÍA (datos reales):
${planLines}

DATOS DEL CLIENTE CON QUIEN ESTÁS HABLANDO:
- Nombre: ${ctx.name}
- Vehículo(s): ${vehicleText}
- Membresía: ${membershipText}
- Próxima reserva: ${bookingText}
- Saldo en billetera: ${walletText}

Usá este contexto para personalizar tus respuestas. Si te preguntan por reservar, recargá billetera o pagar, explicá que se hace desde el portal del cliente y que el pago va por Bancard. Para temas que no podés resolver, ofrecé que un asesor humano lo atienda a la brevedad.`;
}

/**
 * Procesa un mensaje del cliente con Claude.
 * - Persiste/recupera la Conversation (channel Live_Chat) y los Messages.
 * - Si falta ANTHROPIC_API_KEY, devuelve un reply de fallback amable (no tira error).
 * @returns {{ reply: string, conversationId: string }}
 */
async function handleClientAiMessage(prisma, userId, { message, conversationId }) {
  // 1. Resolver/crear la conversación del cliente (canal Live_Chat)
  let conversation = null;
  if (conversationId) {
    conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    // SEGURIDAD (IDOR): solo reutilizar la conversación si pertenece a ESTE cliente.
    // Rechazar si no existe, si NO tiene dueño (userId null) o si es de otro usuario;
    // así nadie puede pasar un conversationId ajeno (o huérfano) y leer/continuar ese hilo.
    if (!conversation || conversation.userId !== userId) {
      conversation = null;
    }
  }
  if (!conversation) {
    conversation = await prisma.conversation.findFirst({
      where: { userId, channel: 'Live_Chat', status: 'open' },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { arizarContactId: true },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        userId,
        arizarContactId: user?.arizarContactId || null,
        channel: 'Live_Chat',
        status: 'open',
        unreadCount: 0,
      },
    });
  }

  const now = new Date();

  // 2. Persistir el mensaje entrante del cliente
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'inbound',
      channel: 'Live_Chat',
      body: message,
      isAi: false,
      status: 'sent',
    },
  });

  // 3. Generar la respuesta (Claude o fallback)
  const reply = await generateAiReply(prisma, userId, conversation.id, message);

  // 4. Persistir la respuesta de la IA (outbound, isAi: true)
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'outbound',
      channel: 'Live_Chat',
      body: reply,
      isAi: true,
      status: 'sent',
    },
  });

  // 5. Actualizar resumen de la conversación
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: now, lastMessageBody: reply },
  });

  return { reply, conversationId: conversation.id };
}

/**
 * Llama a Claude con el contexto del cliente y el historial reciente.
 * Si no hay ANTHROPIC_API_KEY o el SDK no está disponible, devuelve un
 * fallback amable y registra un console.warn (NO tira error).
 */
async function generateAiReply(prisma, userId, conversationId, message) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = 'En un momento te atiende un asesor… Gracias por escribir a Luxury Garage. 🙌';

  if (!apiKey) {
    console.warn('⚠️ ANTHROPIC_API_KEY no configurada; usando respuesta de fallback en el chat IA');
    return fallback;
  }
  if (!Anthropic) {
    console.warn('⚠️ @anthropic-ai/sdk no disponible; usando respuesta de fallback en el chat IA');
    return fallback;
  }

  try {
    const ctx = await getClientContext(prisma, userId);
    const system = await buildSystemPrompt(prisma, ctx);

    // Historial reciente de la conversación (para continuidad), excluyendo el
    // mensaje recién creado lo manejamos incluyendo todo y dejando el último como user.
    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { direction: true, body: true },
    });

    const messages = history
      .filter(m => m.body)
      .map(m => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.body,
      }));

    // Garantizar que el primer mensaje sea de rol user y que el último sea el del cliente.
    while (messages.length && messages[0].role !== 'user') messages.shift();
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      messages.push({ role: 'user', content: message });
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
    });

    const text = (response.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')
      .trim();

    return text || fallback;
  } catch (e) {
    console.error('❌ chatService: error llamando a Claude:', e.message);
    return fallback;
  }
}

module.exports = {
  listConversations,
  listMessages,
  sendAdminMessage,
  markRead,
  unreadCount,
  getClientContextPublic,
  handleClientAiMessage,
};
