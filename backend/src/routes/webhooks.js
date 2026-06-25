const router = require('express').Router();
const bcrypt = require('bcryptjs');
const arizarService = require('../services/arizarService');
const { verifyWebhookSignature } = require('../middleware/webhookVerify');
const { handleArizarEvent } = require('../services/arizarWebhookHandlers');

const WEBHOOK_SOURCE = 'arizar';

/**
 * Deriva un id estable para deduplicar el webhook. GHL no siempre manda el mismo
 * campo, así que probamos (en orden): header dedicado, webhookId del payload, y
 * como último recurso un id compuesto por type+entity+timestamp del payload.
 * Devuelve null solo si no hay absolutamente nada (entonces no deduplicamos).
 */
function deriveWebhookId(req, body) {
  const headerId =
    req.headers['x-wh-webhook-id'] ||
    req.headers['x-webhook-id'] ||
    req.headers['x-ghl-webhook-id'];
  if (headerId) return String(headerId);

  const payloadId = body.webhookId || body.webhook_id || body.eventId || body.event_id;
  if (payloadId) return String(payloadId);

  // Fallback determinista: mismo evento reentregado ⇒ mismo id compuesto.
  const type = body.type || 'unknown';
  const entity = body.id || body.appointmentId || body.messageId || body.contactId || 'na';
  const ts = body.timestamp || body.dateAdded || body.createdAt;
  return ts ? `${type}:${entity}:${ts}` : null;
}

/**
 * Procesa el evento entrante (sync inverso CRM → DB local) DESPUÉS de haber
 * respondido 200 al CRM. Combina:
 *   1. Los handlers de sync inverso (arizarWebhookHandlers.js) — reflejan el
 *      cambio del CRM en nuestras tablas (Conversation, Message, User, …).
 *   2. Los side-effects históricos (auto-creación de usuarios, auto-respuestas
 *      de WhatsApp, notificaciones a admins) — se conservan tal cual estaban.
 * Marca el WebhookEvent como processed/failed según el resultado.
 */
async function processArizarWebhook(req, body, webhookEventId) {
  try {
    const result = await runArizarSideEffects(req, body);
    if (webhookEventId) {
      await req.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: 'processed', processedAt: new Date() },
      }).catch(() => {});
    }
    return result;
  } catch (err) {
    console.error(`❌ Webhook processing error (${body.type}):`, err.message);
    if (webhookEventId) {
      await req.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: 'failed', error: String(err.message).substring(0, 1000), processedAt: new Date() },
      }).catch(() => {});
    }
  }
}

// POST /api/webhooks/arizar — Receive ALL webhooks from ARIZAR IA.
// Aliases por si la config de GHL apunta a /api/webhooks o /api/webhooks/arizar/webhook:
//   '/'             → /api/webhooks
//   '/arizar'       → /api/webhooks/arizar  (URL registrada oficialmente)
//   '/arizar/webhook' → tolerancia a la variante mencionada en la doc interna
const ARIZAR_WEBHOOK_PATHS = ['/arizar', '/', '/arizar/webhook'];
async function arizarWebhookHandler(req, res, next) {
  const body = req.body || {};
  const type = body.type;
  const contactId = body.contactId || body.contact_id || body.data?.contactId || body.data?.contact_id;
  const locationId = body.locationId || body.location_id || body.data?.locationId || null;
  const id = body.id || body.appointmentId || body.appointment_id || body.data?.id;

  const timestamp = new Date().toISOString();
  console.log(`📨 [${timestamp}] Webhook: ${type}`, { contactId, id });

  // ── IDEMPOTENCIA (anti reentrega de GHL) ────────────────────────────────────
  // Registramos el evento en WebhookEvent ([source, webhookId] @unique). Si ya
  // existe ⇒ es una reentrega; respondemos 200 y NO reprocesamos.
  const webhookId = deriveWebhookId(req, body);
  let webhookEventId = null;
  // Guard: si el modelo aún no está en el cliente generado (antes del `db push`)
  // o la BD falla, seguimos procesando best-effort sin romper la entrega.
  const hasWebhookEvent = !!req.prisma.webhookEvent;
  if (hasWebhookEvent && webhookId) {
    const dup = await req.prisma.webhookEvent.findUnique({
      where: { source_webhookId: { source: WEBHOOK_SOURCE, webhookId } },
      select: { id: true },
    }).catch(() => null);
    if (dup) {
      console.log(`ℹ️ Webhook duplicado (${type}, ${webhookId}): se omite reprocesamiento`);
      return res.json({ status: 'success', duplicate: true });
    }
  }
  if (hasWebhookEvent) {
    try {
      const evt = await req.prisma.webhookEvent.create({
        data: {
          source: WEBHOOK_SOURCE,
          webhookId: webhookId || undefined,
          eventType: type || 'unknown',
          locationId: locationId || undefined,
          status: 'received',
          payloadJson: body,
        },
        select: { id: true },
      });
      webhookEventId = evt.id;
    } catch (e) {
      // P2002 = carrera: otra entrega del MISMO webhook lo registró primero.
      if (e.code === 'P2002') {
        console.log(`ℹ️ Webhook duplicado por carrera (${type}, ${webhookId}): se omite`);
        return res.json({ status: 'success', duplicate: true });
      }
      // Si WebhookEvent falla por otra razón, seguimos procesando (best-effort).
      console.error('⚠️ No se pudo registrar WebhookEvent:', e.message);
    }
  }

  // ── Responder SIEMPRE 200 rápido y procesar luego (no bloquear al CRM) ──────
  res.json({ status: 'success' });
  processArizarWebhook(req, body, webhookEventId);
}
router.post(ARIZAR_WEBHOOK_PATHS, verifyWebhookSignature, arizarWebhookHandler);

/**
 * Side-effects históricos + sync inverso. Separado del handler HTTP para poder
 * ejecutarlo tras enviar el 200. Lanza si algo falla (lo captura processArizarWebhook).
 */
async function runArizarSideEffects(req, body) {
  {
    const type = body.type;
    const data = body.data || body; // Fallback to root if data is missing
    const contactId = body.contactId || body.contact_id || data.contactId || data.contact_id;
    const locationId = body.locationId || body.location_id || data.locationId;
    const id = body.id || body.appointmentId || body.appointment_id || data.id;

    // Log every webhook
    try {
      await req.prisma.auditLog.create({
        data: { entity: 'webhook', action: type, entityId: id || contactId || 'unknown', detailsJson: body }
      });
    } catch (e) { /* silent */ }

    // ── SYNC INVERSO (CRM → DB local) ─────────────────────────────────────────
    // Refleja en nuestras tablas los cambios del CRM (Conversation/Message,
    // User, Appointment, Membership/MembershipRequest, Payment) ANTES de los
    // side-effects históricos. Best-effort: un fallo acá no debe impedir las
    // auto-respuestas/notificaciones de abajo.
    try {
      const syncResult = await handleArizarEvent(req.prisma, { type, body, data });
      if (syncResult && !syncResult.skipped) {
        console.log(`🔁 Sync inverso (${type}):`, syncResult);
      }
    } catch (e) {
      console.error(`❌ Error en sync inverso (${type}):`, e.message);
    }

    switch (type) {
      // ═══════════ PAYMENTS & ORDERS ═══════════
      case 'PaymentReceived':
      case 'OrderCreate': {
        const contact = data || {};
        const email = contact.email || `${contactId}@luxury-garage.auto`;

        // ── IDEMPOTENCIA ──────────────────────────────────────────────────
        // Un webhook reintentado por GHL/ARIZAR no debe crear un SEGUNDO usuario
        // ni una SEGUNDA membresía. Dedup por arizarContactId (campo @unique) además
        // del email: el contacto es la identidad estable del lado del CRM.
        let existing = null;
        if (contactId) {
          existing = await req.prisma.user.findFirst({ where: { arizarContactId: contactId } });
        }
        if (!existing) {
          existing = await req.prisma.user.findUnique({ where: { email } });
        }

        if (!existing) {
          const password = Math.random().toString(36).slice(-8) + 'Lx1!';
          const passwordHash = await bcrypt.hash(password, 12);
          let user;
          try {
            user = await req.prisma.user.create({
              data: {
                email,
                passwordHash,
                firstName: contact.firstName || contact.first_name || 'Cliente',
                lastName: contact.lastName || contact.last_name || 'Nuevo',
                phone: contact.phone || null,
                role: 'CLIENT',
                arizarContactId: contactId
              }
            });
          } catch (e) {
            // P2002 = unique violation (email o arizarContactId): una entrega
            // concurrente del MISMO webhook ya creó el usuario. Idempotente:
            // recuperamos el existente y NO reenviamos credenciales.
            if (e.code === 'P2002') {
              existing = contactId
                ? await req.prisma.user.findFirst({ where: { arizarContactId: contactId } })
                : null;
              if (!existing) existing = await req.prisma.user.findUnique({ where: { email } });
              console.log('ℹ️ Webhook duplicado: usuario ya existía, se omite re-creación');
            } else {
              throw e;
            }
          }

          if (user) {
          // Send credentials
          try {
            await arizarService.sendEmail(contactId,
              '🚗 Bienvenido a Luxury Garage - Tus credenciales',
              `<div style="font-family:Inter,sans-serif;background:#0A1628;color:#F0F4F8;padding:40px;border-radius:16px;max-width:500px;margin:0 auto;">
                <div style="text-align:center;margin-bottom:24px;">
                  <div style="background:linear-gradient(135deg,#1E90FF,#00D4FF);width:64px;height:64px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;font-size:32px;">🚗</div>
                  <h1 style="background:linear-gradient(135deg,#1E90FF,#00D4FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:24px;margin:16px 0 4px;">LUXURY GARAGE</h1>
                </div>
                <h2 style="color:#00D4FF;margin-bottom:16px;">¡Bienvenido!</h2>
                <p>Tu cuenta ha sido creada. Accedé al portal para gestionar tus servicios:</p>
                <div style="background:rgba(30,144,255,0.1);border:1px solid rgba(30,144,255,0.2);padding:16px;border-radius:8px;margin:16px 0;">
                  <p><strong style="color:#94A3B8;">Email:</strong> ${email}</p>
                  <p><strong style="color:#94A3B8;">Contraseña:</strong> ${password}</p>
                </div>
                <a href="https://luxurygarage.arizar-ia.cloud/login" style="display:block;text-align:center;background:linear-gradient(135deg,#1E90FF,#00D4FF);color:white;padding:14px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">Acceder al Portal</a>
                <p style="text-align:center;color:#64748B;font-size:12px;margin-top:24px;">Powered by ARIZAR IA</p>
              </div>`
            );

            await arizarService.sendWhatsApp(contactId,
              `🚗 ¡Bienvenido a Luxury Garage!\n\n` +
              `Tu cuenta fue creada:\n` +
              `📧 Email: ${email}\n` +
              `🔑 Contraseña: ${password}\n\n` +
              `Accedé: https://luxurygarage.arizar-ia.cloud/login`
            );

            await arizarService.updateContactTags(contactId, ['miembro-activo', 'luxury-garage', 'auto-creado']);
          } catch (err) { console.error('Error enviando credenciales:', err.message); }

          const emailRedacted = email ? email.substring(0, 3) + '***@***' : 'unknown';
          console.log(`✅ Usuario auto-creado desde webhook: ${emailRedacted}`);
          } // fin if (user) — solo enviamos credenciales para usuarios recién creados
        } else {
          // Update existing user's contact ID if missing
          if (!existing.arizarContactId && contactId) {
            await req.prisma.user.update({ where: { id: existing.id }, data: { arizarContactId: contactId } });
          }
        }

        // Auto-assign plan if payment includes plan info
        if (data?.planSlug || data?.product) {
          const planSlug = data.planSlug || data.product?.slug;
          if (planSlug) {
            const plan = await req.prisma.plan.findUnique({ where: { slug: planSlug } });
            // Resolver el usuario de forma fiable: el ya deduplicado, si no por
            // arizarContactId, y como último recurso por email. Evita perder la
            // asignación cuando el contacto se dedupó por contactId con otro email.
            let user = existing;
            if (!user && contactId) user = await req.prisma.user.findFirst({ where: { arizarContactId: contactId } });
            if (!user) user = await req.prisma.user.findUnique({ where: { email } });
            if (plan && user) {
              // ── IDEMPOTENCIA ─────────────────────────────────────────────
              // No crear una SEGUNDA membresía ACTIVE si ya hay una para este plan.
              // Un webhook reintentado entraría aquí de nuevo; sin este guard se
              // acumularían membresías duplicadas en cada reintento.
              const alreadyActive = await req.prisma.membership.findFirst({
                where: { userId: user.id, planId: plan.id, status: 'ACTIVE' },
              });
              if (!alreadyActive) {
                const start = new Date();
                const end = new Date(); end.setMonth(end.getMonth() + 1);
                await req.prisma.membership.create({
                  data: { userId: user.id, planId: plan.id, status: 'ACTIVE', startDate: start, endDate: end }
                });
                const emailRedactedPlan = email ? email.substring(0, 3) + '***@***' : 'unknown';
                console.log(`✅ Membresía ${plan.name} asignada automáticamente a ${emailRedactedPlan}`);
              } else {
                console.log(`ℹ️ Webhook duplicado: membresía ACTIVE de ${plan.name} ya existe, se omite`);
              }
            }
          }
        }
        break;
      }

      // ═══════════ SUBSCRIPTIONS ═══════════
      case 'SubscriptionCreate': {
        console.log('💳 Suscripción creada:', { contactId, data: data?.name });
        const user = await req.prisma.user.findFirst({ where: { arizarContactId: contactId } });
        if (user) {
          await arizarService.addContactNote(contactId, `💳 Suscripción activada desde ARIZAR IA\n${data?.name || ''}`);
        }
        break;
      }

      case 'SubscriptionCancel': {
        console.log('🚫 Suscripción cancelada:', { contactId });
        const user = await req.prisma.user.findFirst({ where: { arizarContactId: contactId } });
        if (user) {
          const activeMembership = await req.prisma.membership.findFirst({ where: { userId: user.id, status: 'ACTIVE' } });
          if (activeMembership) {
            await req.prisma.membership.update({ where: { id: activeMembership.id }, data: { status: 'CANCELLED', autoRenew: false } });
            await arizarService.updateContactTags(contactId, ['miembro-inactivo']);
            await arizarService.removeContactTags(contactId, ['miembro-activo']);
          }
        }
        break;
      }

      // ═══════════ APPOINTMENTS ═══════════
      case 'AppointmentCreate': {
        const title = data.title || body.title;
        const startTimeStr = data.startTime || data.start_time || body.startTime || body.start_time;
        const endTimeStr = data.endTime || data.end_time || body.endTime || body.end_time;

        console.log('📅 Cita creada desde ARIZAR IA:', { contactId, id, title, startTimeStr, dataKeys: Object.keys(data) });
        // Sync appointment to local DB if not already there
        if (startTimeStr && contactId) {
          const user = await req.prisma.user.findFirst({ where: { arizarContactId: contactId } });
          if (user) {
            const existing = await req.prisma.appointment.findFirst({ where: { arizarAppointmentId: id } });
            if (!existing) {
              // Find a default service
              const service = await req.prisma.service.findFirst({ orderBy: { sortOrder: 'asc' } });
              
              // Find vehicle, or create a dummy one if required
              let vehicle = await req.prisma.vehicle.findFirst({ where: { userId: user.id, isPrimary: true } });
              if (!vehicle) {
                vehicle = await req.prisma.vehicle.findFirst({ where: { userId: user.id } });
              }
              if (!vehicle) {
                 vehicle = await req.prisma.vehicle.create({
                   data: { userId: user.id, brand: 'Genérico', model: 'Desde ARIZAR', licensePlate: 'S/D', isPrimary: true }
                 });
              }

              if (service) {
                await req.prisma.appointment.create({
                  data: {
                    userId: user.id,
                    serviceId: service.id,
                    vehicleId: vehicle.id,
                    date: new Date(startTimeStr),
                    startTime: new Date(startTimeStr),
                    endTime: endTimeStr ? new Date(endTimeStr) : new Date(new Date(startTimeStr).getTime() + 60 * 60000),
                    status: 'CONFIRMED',
                    arizarAppointmentId: id,
                    notes: title || 'Agendado desde ARIZAR IA',
                  }
                });
                console.log(`✅ Cita sincronizada desde ARIZAR a DB local`);
              }
            }
          }
        }
        break;
      }

      case 'AppointmentUpdate': {
        console.log('📅 Cita actualizada:', { id });
        if (id) {
          const appointment = await req.prisma.appointment.findFirst({ where: { arizarAppointmentId: id } });
          if (appointment && data) {
            const update = {};
            if (data.status === 'cancelled') update.status = 'CANCELLED';
            if (data.status === 'confirmed') update.status = 'CONFIRMED';
            // Support multiple field name formats
            const startTimeStr = data.startTime || data.start_time || body.startTime || body.start_time;
            const endTimeStr = data.endTime || data.end_time || body.endTime || body.end_time;
            if (startTimeStr) update.startTime = new Date(startTimeStr);
            if (endTimeStr) update.endTime = new Date(endTimeStr);
            if (Object.keys(update).length > 0) {
              await req.prisma.appointment.update({ where: { id: appointment.id }, data: update });
            }
          }
        }
        break;
      }

      case 'AppointmentDelete': {
        console.log('❌ Cita eliminada:', { id });
        if (id) {
          const appointment = await req.prisma.appointment.findFirst({ where: { arizarAppointmentId: id } });
          if (appointment) {
            await req.prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELLED' } });
          }
        }
        break;
      }

      // ═══════════ CONTACTS ═══════════
      case 'ContactCreate': {
        console.log('📇 Nuevo contacto:', { contactId, email: data?.email });
        // Auto-tag as lead
        if (contactId) {
          try { await arizarService.updateContactTags(contactId, ['lead', 'luxury-garage']); } catch (e) { }
        }
        break;
      }

      case 'ContactUpdate': {
        console.log('📇 Contacto actualizado:', { contactId });
        // Sync back to our DB if needed
        if (contactId) {
          const user = await req.prisma.user.findFirst({ where: { arizarContactId: contactId } });
          if (user && data) {
            const update = {};
            if (data.firstName) update.firstName = data.firstName;
            if (data.lastName) update.lastName = data.lastName;
            if (data.phone) update.phone = data.phone;
            if (Object.keys(update).length > 0) {
              await req.prisma.user.update({ where: { id: user.id }, data: update });
              const emailRedactedUpd = user.email ? user.email.substring(0, 3) + '***@***' : 'unknown';
              console.log(`✅ Usuario ${emailRedactedUpd} actualizado desde CRM`);
            }
          }
        }
        break;
      }

      case 'ContactTagUpdate': {
        console.log('🏷️ Tags actualizados:', { contactId, tags: data?.tags });
        break;
      }

      // ═══════════ OPPORTUNITIES ═══════════
      case 'OpportunityCreate':
      case 'OpportunityUpdate':
      case 'OpportunityStageUpdate':
      case 'OpportunityStatusUpdate': {
        console.log(`🎯 Oportunidad ${type}:`, { id, contactId, status: data?.status, stage: data?.pipelineStageId });
        break;
      }

      // ═══════════ CONVERSATIONS ═══════════
      case 'InboundMessage': {
        const rawMsg = (data?.message || data?.body || data?.text || body.message || '').toLowerCase().trim();
        const msgContactId = contactId;
        console.log('💬 Mensaje entrante:', { contactId: msgContactId, type: data?.type, preview: rawMsg.substring(0, 80) });

        if (msgContactId) {
          // ─── 1. Keyword-based auto-reply ─────────────────────────────────
          let autoReply = null;

          if (/\b(hola|buenas|buenos|buen dia|buena tarde|saludos|hey|buenas noches)\b/.test(rawMsg)) {
            autoReply =
              `¡Hola! 👋 Bienvenido a *Luxury Garage*. ¿En qué te puedo ayudar?\n\n` +
              `Escribí una de estas palabras y te respondo enseguida:\n` +
              `📅 *TURNO* → Agendar un turno\n` +
              `💎 *PRECIOS* → Ver planes y precios\n` +
              `❌ *CANCELAR* → Cancelar un turno\n` +
              `👨‍💼 *ASESOR* → Hablar con una persona`;
          } else if (/\b(turno|agendar|reservar|cita|appointment|quiero|cuando|disponible|disponibilidad|horario|hora)\b/.test(rawMsg)) {
            autoReply =
              `📅 *¡Claro! Para agendar tu turno:*\n\n` +
              `➡️ Ingresá a tu portal y agendá en segundos:\n` +
              `https://luxurygarage.arizar-ia.cloud/client/book\n\n` +
              `¿No tenés cuenta aún? Registrate gratis acá:\n` +
              `https://luxurygarage.arizar-ia.cloud/register\n\n` +
              `¿Necesitás ayuda? Escribí *ASESOR* y te contactamos. 🤝`;
          } else if (/\b(precio|plan|planes|cuanto|costo|tarifa|membresia|membresía|pagar|vale|valor|info|información|informacion)\b/.test(rawMsg)) {
            autoReply =
              `💎 *Planes de Luxury Garage:*\n\n` +
              `Tenemos membresías mensuales con lavados incluidos, agenda prioritaria y descuentos exclusivos.\n\n` +
              `Mirá todos los planes y beneficios acá:\n` +
              `https://luxurygarage.arizar-ia.cloud\n\n` +
              `¿Querés que un asesor te explique? Escribí *ASESOR* 👨‍💼`;
          } else if (/\b(cancelar|cancel|anular|suspender|baja)\b/.test(rawMsg)) {
            autoReply =
              `Para cancelar un turno podés hacerlo directamente desde tu portal:\n` +
              `https://luxurygarage.arizar-ia.cloud/client/appointments\n\n` +
              `Si necesitás ayuda, escribí *ASESOR* y te asistimos enseguida. 🙏`;
          } else if (/\b(asesor|humano|persona|hablar|ayuda|help|soporte|admin|problema|queja|reclamo)\b/.test(rawMsg)) {
            autoReply =
              `👨‍💼 *¡Perfecto!* Un miembro de nuestro equipo te va a contactar a la brevedad.\n\n` +
              `⏰ Horario de atención: Lun–Sáb 8:00–18:00\n\n` +
              `¡Gracias por tu paciencia! 🙏`;
          }

          if (autoReply) {
            try {
              await arizarService.sendWhatsApp(msgContactId, autoReply);
              console.log(`🤖 Auto-respuesta enviada al contacto ${msgContactId}`);
            } catch (e) {
              console.error('❌ Error enviando auto-respuesta:', e.message);
            }
          }

          // ─── 2. Notificación in-app para todos los admins ─────────────────
          try {
            const senderUser = await req.prisma.user.findFirst({
              where: { arizarContactId: msgContactId },
              select: { firstName: true, lastName: true, phone: true },
            });
            const senderName = senderUser
              ? `${senderUser.firstName} ${senderUser.lastName}`
              : `Contacto CRM (${msgContactId.substring(0, 8)})`;
            const preview = (data?.message || data?.body || data?.text || '').substring(0, 120) || '(mensaje sin texto)';

            const admins = await req.prisma.user.findMany({
              where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
              select: { id: true },
            });

            for (const admin of admins) {
              await req.prisma.notification.create({
                data: {
                  userId: admin.id,
                  type: 'INBOUND_MESSAGE',
                  title: `💬 Mensaje de ${senderName}`,
                  message: preview,
                  channel: 'app',
                  isRead: false,
                },
              });
            }
          } catch (e) {
            console.error('❌ Error creando notificación admin de mensaje:', e.message);
          }
        }
        break;
      }

      // ═══════════ INVOICES ═══════════
      case 'InvoiceCreate':
      case 'InvoiceSent':
      case 'InvoicePaid': {
        // El marcado del Payment local (InvoicePaid) ya lo hace el sync inverso arriba.
        console.log(`🧾 Factura ${type}:`, { id, contactId });
        break;
      }

      case 'InvoicePartiallyPaid': {
        console.log('💵 Factura parcialmente pagada:', { id });
        break;
      }

      // ═══════════ FORMS & SURVEYS ═══════════
      case 'FormSubmission': {
        console.log('📝 Formulario enviado:', { contactId });
        // Auto-tag the contact
        if (contactId) {
          try { await arizarService.updateContactTags(contactId, ['form-submitted', 'luxury-garage']); } catch (e) { }
        }
        break;
      }

      case 'SurveySubmission': {
        console.log('📊 Encuesta respondida:', { contactId });
        break;
      }

      // ═══════════ WORKFLOWS ═══════════
      case 'WorkflowContactAdd': {
        console.log('🔄 Contacto agregado a workflow:', { contactId, workflowId: data?.workflowId });
        break;
      }

      // ═══════════ DEFAULT ═══════════
      default:
        console.log(`ℹ️ Webhook no manejado: ${type}`, { id, contactId });
    }
  }
}

// GET /api/webhooks/status — Health check for webhooks
router.get('/status', (req, res) => {
  res.json({
    success: true,
    webhookEndpoint: 'https://luxurygarage.arizar-ia.cloud/api/webhooks/arizar',
    configured: !!process.env.ARIZAR_WEBHOOK_SECRET && process.env.ARIZAR_WEBHOOK_SECRET !== 'pending_configuration',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
