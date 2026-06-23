const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const arizarService = require('../services/arizarService');
const ArizarSync = require('../services/arizarSync');

// All routes require ADMIN
router.use(authenticate, authorize('SUPER_ADMIN', 'ADMIN'));

// GET /api/arizar/status — CRM connection status and sync stats
router.get('/status', async (req, res, next) => {
  try {
    const sync = new ArizarSync(req.prisma);
    const stats = await sync.getSyncStats();

    // Test API connection
    let apiStatus = 'disconnected';
    if (arizarService.isConfigured()) {
      try {
        await arizarService.getContact('test');
        apiStatus = 'connected';
      } catch (err) {
        apiStatus = err.response?.status === 404 ? 'connected' : 'error';
      }
    }

    res.json({
      success: true,
      data: {
        apiStatus,
        configured: arizarService.isConfigured(),
        locationId: process.env.ARIZAR_LOCATION_ID !== 'pending_configuration' ? process.env.ARIZAR_LOCATION_ID : null,
        calendarId: process.env.ARIZAR_CALENDAR_ID !== 'pending_configuration' ? process.env.ARIZAR_CALENDAR_ID : null,
        pipelineId: process.env.ARIZAR_PIPELINE_ID !== 'pending_configuration' ? process.env.ARIZAR_PIPELINE_ID : null,
        webhookUrl: 'https://luxurygarage.arizar-ia.cloud/api/webhooks/arizar',
        ...stats,
      }
    });
  } catch (err) { next(err); }
});

// POST /api/arizar/sync-all — Bulk sync all users to CRM
router.post('/sync-all', async (req, res, next) => {
  try {
    const sync = new ArizarSync(req.prisma);
    const result = await sync.bulkSyncAllUsers();
    res.json({ success: true, data: result, message: `Sincronizados ${result.synced}/${result.total} contactos (${result.errors} errores)` });
  } catch (err) { next(err); }
});

// POST /api/arizar/sync-user/:userId — Sync single user
router.post('/sync-user/:userId', async (req, res, next) => {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.params.userId },
      include: { memberships: { where: { status: 'ACTIVE' }, include: { plan: true }, take: 1 } }
    });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const sync = new ArizarSync(req.prisma);
    const plan = user.memberships[0]?.plan;
    const contactId = await sync.syncUserRegistration(user, plan);

    res.json({ success: true, data: { contactId }, message: contactId ? 'Contacto sincronizado' : 'Error de sincronización' });
  } catch (err) { next(err); }
});

// POST /api/arizar/send-message — Send message from admin panel
router.post('/send-message', async (req, res, next) => {
  try {
    const { userId, channel, message, subject } = req.body;
    if (!userId || !channel || !message) {
      return res.status(400).json({ success: false, message: 'userId, channel y message son requeridos' });
    }

    const user = await req.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.arizarContactId) {
      return res.status(400).json({ success: false, message: 'Usuario no tiene contacto CRM vinculado' });
    }

    let result;
    switch (channel) {
      case 'whatsapp':
        result = await arizarService.sendWhatsApp(user.arizarContactId, message);
        break;
      case 'sms':
        result = await arizarService.sendSMS(user.arizarContactId, message);
        break;
      case 'email':
        result = await arizarService.sendEmail(user.arizarContactId, subject || 'Luxury Garage', message);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Canal no válido (whatsapp, sms, email)' });
    }

    // Audit log
    await req.prisma.auditLog.create({
      data: { entity: 'arizar_message', action: `send_${channel}`, entityId: user.arizarContactId, userId: req.user.id, detailsJson: { to: user.email, channel, messagePreview: message.substring(0, 100) } }
    });

    res.json({ success: true, data: result, message: `${channel.toUpperCase()} enviado a ${user.firstName}` });
  } catch (err) { next(err); }
});

// POST /api/arizar/broadcast — Send broadcast to all members
router.post('/broadcast', async (req, res, next) => {
  try {
    const { channel, message, subject, filter } = req.body;
    if (!channel || !message) {
      return res.status(400).json({ success: false, message: 'channel y message son requeridos' });
    }

    // Get target users
    const where = { role: 'CLIENT', arizarContactId: { not: null } };
    if (filter === 'active') {
      where.memberships = { some: { status: 'ACTIVE' } };
    }

    const users = await req.prisma.user.findMany({ where, select: { id: true, firstName: true, arizarContactId: true } });

    let sent = 0, errors = 0;
    for (const user of users) {
      try {
        const personalizedMsg = message.replace('{{nombre}}', user.firstName);
        switch (channel) {
          case 'whatsapp':
            await arizarService.sendWhatsApp(user.arizarContactId, personalizedMsg);
            break;
          case 'sms':
            await arizarService.sendSMS(user.arizarContactId, personalizedMsg);
            break;
          case 'email':
            await arizarService.sendEmail(user.arizarContactId, subject || 'Luxury Garage', personalizedMsg);
            break;
        }
        sent++;
        // Rate limit: wait 200ms between messages
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        errors++;
      }
    }

    // Audit log
    await req.prisma.auditLog.create({
      data: { entity: 'arizar_broadcast', action: `broadcast_${channel}`, entityId: 'all', userId: req.user.id, detailsJson: { channel, filter, sent, errors, total: users.length } }
    });

    res.json({ success: true, data: { sent, errors, total: users.length }, message: `Broadcast enviado: ${sent}/${users.length} exitosos` });
  } catch (err) { next(err); }
});

// GET /api/arizar/contact/:userId — Get CRM contact info for a user
router.get('/contact/:userId', async (req, res, next) => {
  try {
    const user = await req.prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user?.arizarContactId) {
      return res.json({ success: true, data: null, message: 'No vinculado al CRM' });
    }

    const contact = await arizarService.getContact(user.arizarContactId);
    res.json({ success: true, data: contact });
  } catch (err) { next(err); }
});

// GET /api/arizar/logs — Get sync audit logs
router.get('/logs', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const logs = await req.prisma.auditLog.findMany({
      where: { entity: { startsWith: 'arizar' } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      include: { user: { select: { firstName: true, lastName: true, email: true } } }
    });

    const total = await req.prisma.auditLog.count({ where: { entity: { startsWith: 'arizar' } } });

    res.json({ success: true, data: logs, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
});

// POST /api/arizar/test-connection — Test CRM connection
router.post('/test-connection', async (req, res, next) => {
  try {
    if (!arizarService.isConfigured()) {
      return res.json({ success: false, message: 'ARIZAR IA no está configurado. Configurá ARIZAR_LOCATION_ID en .env' });
    }

    // Try to search contacts
    const result = await arizarService.findContactByEmail('test@test.com');
    res.json({ success: true, message: '✅ Conexión exitosa con ARIZAR IA', data: { apiReachable: true } });
  } catch (err) {
    res.json({ success: false, message: `❌ Error de conexión: ${err.response?.data?.message || err.message}` });
  }
});

// POST /api/arizar/register-webhooks — Register webhooks in ARIZAR IA
router.post('/register-webhooks', async (req, res, next) => {
  try {
    if (!arizarService.isConfigured()) {
      return res.status(400).json({ success: false, message: 'CRM no configurado' });
    }

    const webhookUrl = 'https://luxurygarage.arizar-ia.cloud/api/webhooks/arizar';
    const events = [
      'ContactCreate', 'ContactUpdate', 'ContactTagUpdate',
      'AppointmentCreate', 'AppointmentUpdate', 'AppointmentDelete',
      'OpportunityCreate', 'OpportunityStageUpdate', 'OpportunityStatusUpdate',
      'PaymentReceived', 'OrderCreate',
      'SubscriptionCreate', 'SubscriptionCancel',
      'InvoiceCreate', 'InvoiceSent', 'InvoicePartiallyPaid',
      'InboundMessage',
      'FormSubmission', 'SurveySubmission',
      'WorkflowContactAdd',
    ];

    const result = await arizarService._safe(async () => {
      const response = await arizarService.client.post('/webhooks/', {
        url: webhookUrl,
        events,
        locationId: arizarService.locationId,
      });
      return response.data;
    });

    res.json({ success: true, data: result, message: `Webhooks registrados: ${events.length} eventos → ${webhookUrl}` });
  } catch (err) { next(err); }
});

// ═══════ REVIEWS ═══════

// GET /api/arizar/reviews — Get business reviews
router.get('/reviews', async (req, res, next) => {
  try {
    const reviews = await arizarService.getReviews();
    res.json({ success: true, data: reviews });
  } catch (err) { next(err); }
});

// POST /api/arizar/reviews/:reviewId/reply — Reply to a review
router.post('/reviews/:reviewId/reply', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message requerido' });
    const result = await arizarService.replyReview(req.params.reviewId, message);
    res.json({ success: true, data: result, message: 'Respuesta enviada' });
  } catch (err) { next(err); }
});

// ═══════ SOCIAL MEDIA ═══════

// GET /api/arizar/social/accounts — Get connected social accounts
router.get('/social/accounts', async (req, res, next) => {
  try {
    const accounts = await arizarService.getSocialAccounts();
    res.json({ success: true, data: accounts });
  } catch (err) { next(err); }
});

// GET /api/arizar/social/posts — Get social posts
router.get('/social/posts', async (req, res, next) => {
  try {
    const posts = await arizarService.getSocialPosts();
    res.json({ success: true, data: posts });
  } catch (err) { next(err); }
});

// POST /api/arizar/social/post — Create social media post
router.post('/social/post', async (req, res, next) => {
  try {
    const { content, accountIds, mediaUrls, scheduleDate } = req.body;
    if (!content || !accountIds?.length) return res.status(400).json({ success: false, message: 'content y accountIds requeridos' });
    const result = await arizarService.createSocialPost({ content, accountIds, mediaUrls, scheduleDate });
    res.json({ success: true, data: result, message: 'Post creado' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════
// LEADS / REFERIDOS — Embudo de captación (datos reales)
// ═══════════════════════════════════════════════════════

// Estados reales en BD (minúscula): invited | registered | purchased
const LEAD_STATUSES = ['invited', 'registered', 'purchased'];

// GET /api/arizar/leads — Lista de leads/referidos enriquecida
router.get('/leads', async (req, res, next) => {
  try {
    const { status, search } = req.query;

    const where = {};
    if (status && LEAD_STATUSES.includes(status)) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { referredEmail: { contains: search, mode: 'insensitive' } },
        { referredPhone: { contains: search } },
        { code: { contains: search, mode: 'insensitive' } },
        { referrer: { firstName: { contains: search, mode: 'insensitive' } } },
        { referrer: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const leads = await req.prisma.referral.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        referrer: { select: { id: true, firstName: true, lastName: true, email: true } },
        referred: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, arizarContactId: true } },
      },
    });

    res.json({ success: true, data: leads });
  } catch (err) { next(err); }
});

// GET /api/arizar/leads/stats — Métricas reales del embudo
router.get('/leads/stats', async (req, res, next) => {
  try {
    const [total, invited, registered, purchased, withReward] = await Promise.all([
      req.prisma.referral.count(),
      req.prisma.referral.count({ where: { status: 'invited' } }),
      req.prisma.referral.count({ where: { status: 'registered' } }),
      req.prisma.referral.count({ where: { status: 'purchased' } }),
      req.prisma.referral.count({ where: { rewardAmount: { not: null } } }),
    ]);

    const conversion = total > 0 ? Math.round((purchased / total) * 100) : 0;

    res.json({
      success: true,
      data: { total, invited, registered, purchased, withReward, conversion },
    });
  } catch (err) { next(err); }
});

// GET /api/arizar/registration-link — Link de auto-registro real
router.get('/registration-link', async (req, res, next) => {
  try {
    const base = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://luxurygarage.arizar-ia.cloud';
    const link = `${base.replace(/\/$/, '')}/register`;
    res.json({ success: true, data: { link } });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════
// CONVERSACIONES — Ver mensajes de clientes desde el admin
// ═══════════════════════════════════════════════════════

// GET /api/arizar/conversations — Listar conversaciones activas del CRM
router.get('/conversations', async (req, res, next) => {
  try {
    const { contactId, limit = 25, unread } = req.query;
    const conversations = await arizarService.getConversations({
      contactId,
      limit:  parseInt(limit, 10),
      unread: unread === 'true',
    });

    // Enriquecer con datos del usuario local si existe en nuestra DB
    const enriched = await Promise.all(conversations.map(async (conv) => {
      try {
        const localUser = conv.contactId
          ? await req.prisma.user.findFirst({
              where: { arizarContactId: conv.contactId },
              select: { id: true, firstName: true, lastName: true, email: true, phone: true },
            })
          : null;
        return { ...conv, localUser: localUser || null };
      } catch { return { ...conv, localUser: null }; }
    }));

    res.json({ success: true, data: enriched, total: enriched.length });
  } catch (err) { next(err); }
});

// GET /api/arizar/conversations/:conversationId/messages — Mensajes de una conversación
router.get('/conversations/:conversationId/messages', async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const messages = await arizarService.getConversationMessages(
      req.params.conversationId,
      parseInt(limit, 10)
    );
    res.json({ success: true, data: messages, total: messages.length });
  } catch (err) { next(err); }
});

// POST /api/arizar/conversations/:contactId/reply — Responder a un cliente desde el admin
router.post('/conversations/:contactId/reply', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message requerido' });

    await arizarService.sendWhatsApp(req.params.contactId, message);

    // Log en audit
    await req.prisma.auditLog.create({
      data: {
        entity: 'conversation',
        action: 'admin_reply',
        entityId: req.params.contactId,
        userId: req.user.id,
        detailsJson: { sentBy: req.user.email, preview: message.substring(0, 100) },
      },
    });

    res.json({ success: true, message: 'Mensaje enviado correctamente' });
  } catch (err) { next(err); }
});

module.exports = router;



