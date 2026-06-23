const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const arizarService = require('../services/arizarService');
const ArizarSync = require('../services/arizarSync');
const { provisionClient } = require('../services/clientProvisioning');

const STATUSES = ['NEW', 'CONTACTED', 'CONVERTED', 'DISCARDED'];

/**
 * POST /api/membership-requests  (PÚBLICO, sin auth)
 * Solicitud de membresía desde la landing o el login (lead). Crea el registro y, en segundo
 * plano, lo sincroniza con ARIZAR: upsert de contacto + oportunidad en el pipeline (stage inicial
 * "Consulta Recibida") + nota con el detalle. El cliente recibe respuesta inmediata.
 */
router.post('/', async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, vehicleInfo, vehicleSize, planInterest, message, source } = req.body || {};

    const fn = String(firstName || '').trim();
    const ln = String(lastName || '').trim();
    const ph = String(phone || '').trim();
    const em = String(email || '').trim();
    if (fn.length < 2) return res.status(400).json({ success: false, message: 'Ingresá tu nombre.' });
    if (ph.replace(/\D/g, '').length < 6) return res.status(400).json({ success: false, message: 'Ingresá un teléfono válido.' });
    if (em && !/^\S+@\S+\.\S+$/.test(em)) return res.status(400).json({ success: false, message: 'El email no es válido.' });

    const request = await req.prisma.membershipRequest.create({
      data: {
        firstName: fn,
        lastName: ln || null,
        email: em || null,
        phone: ph,
        vehicleInfo: String(vehicleInfo || '').trim() || null,
        vehicleSize: String(vehicleSize || '').trim() || null,
        planInterest: String(planInterest || '').trim() || null,
        message: String(message || '').trim() || null,
        source: source === 'login' ? 'login' : 'landing',
        status: 'NEW',
      },
    });

    // Respuesta inmediata al cliente (el sync con ARIZAR no debe hacerlo esperar).
    res.status(201).json({
      success: true,
      message: '¡Recibimos tu solicitud! Te vamos a contactar a la brevedad. 🚗',
      data: { id: request.id },
    });

    // ── Sync con ARIZAR (best-effort, en segundo plano; usa el prisma singleton) ──
    setImmediate(async () => {
      try {
        const contact = await arizarService.upsertContact({
          firstName: fn.split(' ')[0] || fn,
          lastName: ln || fn.split(' ').slice(1).join(' ') || undefined,
          email: em || undefined,
          phone: ph,
          tags: ['luxury-garage', 'lead', 'solicitud-membresia', ...(planInterest ? [`interes-${planInterest}`] : [])],
          source: 'landing-solicitud',
        });
        const contactId = contact?.contact?.id || contact?.contactId || null;
        let opportunityId = null;

        if (contactId) {
          const opp = await arizarService.createOpportunity(contactId, {
            name: `Solicitud membresía — ${fn}${ln ? ' ' + ln : ''}`,
            // sin stageId → cae al firstStageId ("Consulta Recibida")
          });
          opportunityId = opp?.opportunity?.id || opp?.id || null;

          await arizarService.addContactNote(contactId,
            `📝 Solicitud de membresía (${request.source})\n` +
            `👤 ${fn}${ln ? ' ' + ln : ''}\n` +
            `📱 ${ph}${em ? '\n📧 ' + em : ''}\n` +
            `${vehicleInfo ? '🚗 ' + vehicleInfo : ''}${vehicleSize ? ' (' + vehicleSize + ')' : ''}\n` +
            `${planInterest ? '📋 Plan de interés: ' + planInterest + '\n' : ''}` +
            `${message ? '💬 ' + message + '\n' : ''}` +
            `📅 ${new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}`
          );
        }

        if (contactId || opportunityId) {
          await req.prisma.membershipRequest.update({
            where: { id: request.id },
            data: { arizarContactId: contactId, arizarOpportunityId: opportunityId },
          });
        }
        console.log(`[MembershipRequest] ${request.id} → ARIZAR contacto=${contactId} oportunidad=${opportunityId}`);
      } catch (e) {
        console.error('[MembershipRequest] sync ARIZAR falló (la solicitud quedó guardada igual):', e.message);
      }
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/membership-requests  (ADMIN / EMPLOYEE)
 * Lista las solicitudes para el panel, con filtro por estado y búsqueda.
 */
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'), async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const where = {};
    if (status && STATUSES.includes(status)) where.status = status;
    if (search) {
      const s = String(search).trim();
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
        { vehicleInfo: { contains: s, mode: 'insensitive' } },
      ];
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const [items, total] = await Promise.all([
      req.prisma.membershipRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      req.prisma.membershipRequest.count({ where }),
    ]);
    res.json({ success: true, data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

/**
 * GET /api/membership-requests/stats  (ADMIN / EMPLOYEE)
 */
router.get('/stats', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'), async (req, res, next) => {
  try {
    const [total, nuevos, contactados, convertidos, descartados] = await Promise.all([
      req.prisma.membershipRequest.count(),
      req.prisma.membershipRequest.count({ where: { status: 'NEW' } }),
      req.prisma.membershipRequest.count({ where: { status: 'CONTACTED' } }),
      req.prisma.membershipRequest.count({ where: { status: 'CONVERTED' } }),
      req.prisma.membershipRequest.count({ where: { status: 'DISCARDED' } }),
    ]);
    const conversion = total > 0 ? Math.round((convertidos / total) * 100) : 0;
    res.json({ success: true, data: { total, nuevos, contactados, convertidos, descartados, conversion } });
  } catch (err) { next(err); }
});

/**
 * PUT /api/membership-requests/:id/status  (ADMIN)
 * Cambia el estado (NEW → CONTACTED → CONVERTED / DISCARDED).
 */
router.put('/:id/status', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Estado inválido.' });
    const existing = await req.prisma.membershipRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
    const updated = await req.prisma.membershipRequest.update({ where: { id: req.params.id }, data: { status } });
    await req.prisma.auditLog.create({
      data: { userId: req.user.id, action: 'MEMBERSHIP_REQUEST_STATUS', entity: 'membership_request', entityId: updated.id, detailsJson: { from: existing.status, to: status } },
    }).catch(() => {});
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

/**
 * POST /api/membership-requests/:id/convert  (ADMIN)
 * Convierte un lead en cliente real con 1 click:
 *  - si ya está CONVERTED → 409
 *  - si el lead no tiene email → 400 (hace falta para crear el User)
 *  - si el email YA existe como User → NO duplica: marca CONVERTED y responde { reused:true, userId }
 *  - sino: aprovisiona el cliente (User + Vehicle + Membership ACTIVE + Audit) de forma atómica,
 *    marca el lead CONVERTED + AuditLog, y best-effort sincroniza ARIZAR + envía credenciales por WhatsApp.
 */
router.post('/:id/convert', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const lead = await req.prisma.membershipRequest.findUnique({ where: { id: req.params.id } });
    if (!lead) return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
    if (lead.status === 'CONVERTED') return res.status(409).json({ success: false, message: 'Este lead ya fue convertido.' });

    const email = String(lead.email || '').trim();
    if (!email) return res.status(400).json({ success: false, message: 'El lead no tiene email, agregalo antes de convertir.' });

    // Si el email ya existe como usuario, no duplicamos: marcamos el lead CONVERTED y reusamos.
    const existing = await req.prisma.user.findUnique({ where: { email } });
    if (existing) {
      await req.prisma.membershipRequest.update({ where: { id: lead.id }, data: { status: 'CONVERTED' } });
      await req.prisma.auditLog.create({
        data: { userId: req.user.id, action: 'MEMBERSHIP_REQUEST_CONVERTED', entity: 'membership_request', entityId: lead.id, detailsJson: { reused: true, userId: existing.id, email } },
      }).catch(() => {});
      return res.status(200).json({ success: true, reused: true, userId: existing.id, message: 'El cliente ya existía; se marcó el lead como convertido.' });
    }

    // Nombre: el lead solo garantiza firstName; usamos un apellido mínimo si falta.
    const firstName = String(lead.firstName || '').trim();
    const lastName = String(lead.lastName || '').trim() || '—';
    const phone = String(lead.phone || '').trim() || null;

    // Plan por slug (planInterest). Si no matchea, se crea sin membresía.
    let planRecord = null;
    if (lead.planInterest) {
      planRecord = await req.prisma.plan.findUnique({ where: { slug: String(lead.planInterest).trim() } });
    }

    // Vehículo desde vehicleInfo (parseo laxo: primer token = brand, resto = model). Solo si hay datos.
    let vehicle = null;
    const vehInfo = String(lead.vehicleInfo || '').trim();
    if (vehInfo) {
      const parts = vehInfo.split(/\s+/);
      const brand = parts.shift();
      if (brand) vehicle = { brand, model: parts.join(' ') };
    }

    const { user, membership, tempPassword } = await provisionClient(req.prisma, {
      email, firstName, lastName, phone,
      plan: planRecord,
      vehicle,
    }, req.user.id);

    // Marcar el lead como convertido + audit (fuera de provisionClient, sobre la entidad lead).
    await req.prisma.membershipRequest.update({ where: { id: lead.id }, data: { status: 'CONVERTED' } });
    await req.prisma.auditLog.create({
      data: { userId: req.user.id, action: 'MEMBERSHIP_REQUEST_CONVERTED', entity: 'membership_request', entityId: lead.id, detailsJson: { userId: user.id, email, plan: membership?.plan?.name || null } },
    }).catch(() => {});

    // ─── best-effort fuera de la transacción ───
    // ARIZAR: si el lead ya tenía contacto, lo respetamos para no duplicar.
    let credentialsSent = false;
    try {
      const sync = new ArizarSync(req.prisma);
      if (lead.arizarContactId && !user.arizarContactId) {
        await req.prisma.user.update({ where: { id: user.id }, data: { arizarContactId: lead.arizarContactId } });
        user.arizarContactId = lead.arizarContactId;
      }
      await sync.syncUserRegistration(user, membership?.plan);
    } catch (e) { console.error('Error sincronizando con ARIZAR (convert):', e.message); }

    // Enviar credenciales por WhatsApp si hay teléfono.
    if (phone) {
      try {
        const contactId = user.arizarContactId || lead.arizarContactId;
        if (contactId) {
          await arizarService.sendWhatsApp(contactId,
            `🚗 ¡Hola ${firstName}! Bienvenido a Luxury Garage\n\n` +
            `Te creamos una cuenta en nuestro portal premium:\n\n` +
            `📧 Email: ${email}\n` +
            `🔑 Contraseña: ${tempPassword}\n\n` +
            `Accedé acá: https://luxurygarage.arizar-ia.cloud/login\n\n` +
            `Desde ahí podés agendar turnos, ver tu membresía y más. 💎`
          );
          credentialsSent = true;
        }
      } catch (e) { console.error('Error enviando credenciales por WhatsApp (convert):', e.message); }
    }

    const { passwordHash: _, ...userData } = user;
    res.status(201).json({
      success: true,
      data: { user: userData, membership, credentialsSent },
      message: `Cliente creado${credentialsSent ? ' y credenciales enviadas por WhatsApp' : ''}`,
    });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'El email ya está registrado' });
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
});

module.exports = router;
