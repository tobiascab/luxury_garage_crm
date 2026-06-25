const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const chatService = require('../services/chatService');

// ─────────────────────────────────────────────────────────────
//  ADMIN — Bandeja de conversaciones (SUPER_ADMIN / ADMIN)
// ─────────────────────────────────────────────────────────────

// GET /api/chat/conversations → lista de conversaciones
router.get('/conversations', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = await chatService.listConversations(req.prisma);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/chat/unread-count → total de mensajes sin leer
// (definido antes de /conversations/:id para evitar colisión de rutas)
router.get('/unread-count', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const count = await chatService.unreadCount(req.prisma);
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
});

// GET /api/chat/conversations/:id/messages → mensajes de una conversación
router.get('/conversations/:id/messages', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = await chatService.listMessages(req.prisma, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/conversations/:id/messages → el admin responde al cliente
router.post('/conversations/:id/messages', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { body, channel } = req.body || {};
    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ success: false, message: 'El mensaje no puede estar vacío' });
    }
    const data = await chatService.sendAdminMessage(req.prisma, req.params.id, { body: body.trim(), channel });
    res.status(201).json({ success: true, data });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    next(err);
  }
});

// PUT /api/chat/conversations/:id/read → marcar como leída
router.put('/conversations/:id/read', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    await chatService.markRead(req.prisma, req.params.id);
    res.json({ success: true, data: { unreadCount: 0 } });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
//  CLIENTE — Chat con IA y contexto (cliente autenticado)
// ─────────────────────────────────────────────────────────────

// POST /api/chat/ai → mensaje del cliente al asistente IA
router.post('/ai', authenticate, async (req, res, next) => {
  try {
    const { message, conversationId } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'El mensaje no puede estar vacío' });
    }
    const data = await chatService.handleClientAiMessage(req.prisma, req.user.id, {
      message: message.trim(),
      conversationId,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/chat/context → contexto del cliente logueado
router.get('/context', authenticate, async (req, res, next) => {
  try {
    const data = await chatService.getClientContextPublic(req.prisma, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
