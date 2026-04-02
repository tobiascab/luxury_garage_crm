const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

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

// GET /api/notifications/admin — all notifications (admin view)
router.get('/admin', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const notifs = await req.prisma.notification.findMany({
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ success: true, data: notifs });
  } catch (err) { next(err); }
});

// PUT /api/notifications/:id/read — mark as read
router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    await req.prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true }
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
      }
    });

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

    // Create notifications in batch
    const notifications = await req.prisma.notification.createMany({
      data: users.map(u => ({
        userId: u.id,
        type: type || 'info',
        title,
        message,
        channel: channel || 'app',
      }))
    });

    // Audit
    await req.prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'BROADCAST_NOTIFICATION',
        entity: 'Notification',
        detailsJson: { type, title, filter, recipientCount: users.length },
      }
    });

    console.log(`📢 Broadcast: "${title}" enviado a ${users.length} clientes`);

    res.status(201).json({
      success: true,
      data: { count: notifications.count },
      message: `Notificación enviada a ${users.length} clientes`
    });
  } catch (err) { next(err); }
});

module.exports = router;
