const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const pushService = require('../services/pushService');

// GET /api/push/public-key — clave pública VAPID para suscribirse desde el front
router.get('/public-key', (req, res) => {
  res.json({
    success: true,
    publicKey: pushService.getPublicKey(),
    configured: pushService.isConfigured(),
  });
});

// POST /api/push/subscribe — guarda (o actualiza) la suscripción push del dispositivo
router.post('/subscribe', authenticate, async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, message: 'Suscripción inválida' });
    }

    const sub = await req.prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: req.user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers['user-agent'] || null,
      },
      create: {
        userId: req.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    res.status(201).json({ success: true, data: { id: sub.id } });
  } catch (err) { next(err); }
});

// POST /api/push/unsubscribe — elimina la suscripción de este dispositivo
router.post('/unsubscribe', authenticate, async (req, res, next) => {
  try {
    const { endpoint } = req.body || {};
    if (endpoint) {
      await req.prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/push/status — ¿este dispositivo (endpoint) ya está suscrito?
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const { endpoint } = req.query;
    let subscribed = false;
    if (endpoint) {
      const sub = await req.prisma.pushSubscription.findFirst({ where: { endpoint, userId: req.user.id } });
      subscribed = !!sub;
    }
    res.json({ success: true, subscribed, configured: pushService.isConfigured() });
  } catch (err) { next(err); }
});

// POST /api/push/test — envía una push de prueba al propio usuario
router.post('/test', authenticate, async (req, res, next) => {
  try {
    const result = await pushService.sendToUser(req.prisma, req.user.id, {
      title: 'Luxury Garage 🔔',
      body: '¡Listo! Vas a recibir tus notificaciones acá.',
      type: 'success',
      url: '/',
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
