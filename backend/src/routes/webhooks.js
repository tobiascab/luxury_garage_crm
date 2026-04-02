const router = require('express').Router();
const bcrypt = require('bcryptjs');
const arizarService = require('../services/arizarService');
const { verifyWebhookSignature } = require('../middleware/webhookVerify');

// POST /api/webhooks/arizar — Receive ALL webhooks from ARIZAR IA
router.post('/arizar', verifyWebhookSignature, async (req, res, next) => {
  try {
    const body = req.body || {};
    const type = body.type;
    const data = body.data || body; // Fallback to root if data is missing
    const contactId = body.contactId || body.contact_id || data.contactId || data.contact_id;
    const locationId = body.locationId || body.location_id || data.locationId;
    const id = body.id || body.appointmentId || body.appointment_id || data.id;

    const timestamp = new Date().toISOString();
    console.log(`📨 [${timestamp}] Webhook: ${type}`, { contactId, id });

    // Log every webhook
    try {
      await req.prisma.auditLog.create({
        data: { entity: 'webhook', action: type, entityId: id || contactId || 'unknown', details: body }
      });
    } catch (e) { /* silent */ }

    switch (type) {
      // ═══════════ PAYMENTS & ORDERS ═══════════
      case 'PaymentReceived':
      case 'OrderCreate': {
        const contact = data || {};
        const email = contact.email || `${contactId}@luxury-garage.auto`;
        const existing = await req.prisma.user.findUnique({ where: { email } });

        if (!existing) {
          const password = Math.random().toString(36).slice(-8) + 'Lx1!';
          const passwordHash = await bcrypt.hash(password, 12);
          const user = await req.prisma.user.create({
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

          console.log(`✅ Usuario auto-creado desde webhook: ${email}`);
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
            const user = await req.prisma.user.findUnique({ where: { email } });
            if (plan && user) {
              const start = new Date();
              const end = new Date(); end.setMonth(end.getMonth() + 1);
              await req.prisma.membership.create({
                data: { userId: user.id, planId: plan.id, status: 'ACTIVE', startDate: start, endDate: end }
              });
              console.log(`✅ Membresía ${plan.name} asignada automáticamente a ${email}`);
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
              console.log(`✅ Usuario ${user.email} actualizado desde CRM`);
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
        console.log('💬 Mensaje entrante:', { contactId, type: data?.type, message: data?.message?.substring(0, 100) });
        // Could trigger auto-responses or notifications here
        break;
      }

      // ═══════════ INVOICES ═══════════
      case 'InvoiceCreate':
      case 'InvoiceSent': {
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

    res.json({ success: true, received: true, type });
  } catch (err) {
    console.error(`❌ Webhook error:`, err.message);
    next(err);
  }
});

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
