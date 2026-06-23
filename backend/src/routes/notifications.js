const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const pushService = require('../services/pushService');

// Los ids son UUID v4 (Prisma @default(uuid())). Validamos el formato antes de
// tocar la BD para devolver 400 en vez de un 500 por un id mal formado.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidId = (id) => typeof id === 'string' && UUID_RE.test(id);

// GET /api/notifications — user's own notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const notifs = await req.prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ success: true, data: notifs });
  } catch (err) { next(err); }
});

// GET /api/notifications/admin — all notifications (admin view) + filtros
router.get('/admin', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { search, type, status } = req.query;
    const where = {};
    if (type) where.type = type;
    if (status === 'unread') where.isRead = false;
    if (status === 'read') where.isRead = true;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }
    const notifs = await req.prisma.notification.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ success: true, data: notifs });
  } catch (err) { next(err); }
});

// GET /api/notifications/admin/stats — KPIs reales (admin)
router.get('/admin/stats', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [total, unread, sentThisMonth, recipients] = await Promise.all([
      req.prisma.notification.count(),
      req.prisma.notification.count({ where: { isRead: false } }),
      req.prisma.notification.count({ where: { createdAt: { gte: monthStart } } }),
      req.prisma.notification.findMany({ select: { userId: true }, distinct: ['userId'] }),
    ]);
    res.json({
      success: true,
      data: { total, unread, read: total - unread, sentThisMonth, reach: recipients.length },
    });
  } catch (err) { next(err); }
});

// PUT /api/notifications/read-all — marcar todas como leídas (propias)
router.put('/read-all', authenticate, async (req, res, next) => {
  try {
    const result = await req.prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, data: { count: result.count } });
  } catch (err) { next(err); }
});

// PUT /api/notifications/:id/read — mark as read (solo propias)
router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }
    const notif = await req.prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif) return res.status(404).json({ success: false, message: 'Notificación no encontrada' });

    const isAdmin = req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN';
    if (notif.userId !== req.user.id && !isAdmin) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    await req.prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/notifications — send to a specific user (admin only)
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { userId, type, title, message, channel } = req.body;
    if (!userId || !title || !message) {
      return res.status(400).json({ success: false, message: 'userId, title y message son requeridos' });
    }

    const notification = await req.prisma.notification.create({
      data: {
        userId,
        type: type || 'info',
        title,
        message,
        channel: channel || 'app',
        sentAt: new Date(),
      }
    });

    // Push best-effort al dispositivo del cliente (no bloquea la respuesta)
    pushService.sendToUser(req.prisma, userId, { title, body: message, type: type || 'info', url: '/', tag: notification.id })
      .catch((e) => console.error('[notif] push individual falló:', e.message));

    // Audit
    await req.prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'SEND_NOTIFICATION',
        entity: 'Notification',
        entityId: notification.id,
        detailsJson: { targetUserId: userId, type, title },
      }
    });

    res.status(201).json({ success: true, data: notification, message: 'Notificación enviada' });
  } catch (err) { next(err); }
});

// POST /api/notifications/broadcast — send to all/active clients (admin only)
router.post('/broadcast', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { type, title, message, channel, filter } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title y message son requeridos' });
    }

    // Get target users
    const where = { role: 'CLIENT' };
    if (filter === 'active') {
      where.isActive = true;
    }

    const users = await req.prisma.user.findMany({
      where,
      select: { id: true }
    });

    if (users.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay clientes para notificar' });
    }

    // Atómico: crear las notificaciones en lote + el audit log juntos.
    // Si el audit fallara después de crear las notificaciones, devolveríamos 500
    // y el admin reenviaría -> broadcast DUPLICADO a todos. La transacción evita
    // ese estado parcial. Marcamos sentAt para registrar el momento de envío.
    const sentAt = new Date();
    const [notifications] = await req.prisma.$transaction([
      req.prisma.notification.createMany({
        data: users.map(u => ({
          userId: u.id,
          type: type || 'info',
          title,
          message,
          channel: channel || 'app',
          sentAt,
        }))
      }),
      req.prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'BROADCAST_NOTIFICATION',
          entity: 'Notification',
          detailsJson: { type, title, filter, recipientCount: users.length },
        }
      }),
    ]);

    // Push best-effort a todos los suscritos (fire-and-forget para no bloquear la respuesta)
    const pushPayload = { title, body: message, type: type || 'info', url: '/' };
    Promise.allSettled(users.map(u => pushService.sendToUser(req.prisma, u.id, pushPayload)))
      .then((rs) => {
        const sent = rs.reduce((acc, r) => acc + (r.status === 'fulfilled' ? (r.value?.sent || 0) : 0), 0);
        console.log(`📲 Broadcast push: ${sent} dispositivos notificados`);
      })
      .catch((e) => console.error('[notif] broadcast push falló:', e.message));

    console.log(`📢 Broadcast: "${title}" enviado a ${users.length} clientes`);

    res.status(201).json({
      success: true,
      data: { count: notifications.count },
      message: `Notificación enviada a ${users.length} clientes`
    });
  } catch (err) { next(err); }
});

// DELETE /api/notifications/:id — eliminar una notificación (admin)
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }
    const notif = await req.prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif) return res.status(404).json({ success: false, message: 'Notificación no encontrada' });

    await req.prisma.notification.delete({ where: { id: req.params.id } });

    await req.prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DELETE_NOTIFICATION',
        entity: 'Notification',
        entityId: req.params.id,
        detailsJson: { title: notif.title },
      },
    });

    res.json({ success: true, message: 'Notificación eliminada' });
  } catch (err) { next(err); }
});

module.exports = router;
