const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

// Validación de datos para crear promoción
const promotionSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number().positive('Valor debe ser positivo'),
  maxUses: z.number().int().positive('Límite debe ser positivo').optional(),
  validUntil: z.string().datetime().or(z.date()),
  isActive: z.boolean().default(true),
});

router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try { const promos = await req.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: promos });
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(promotionSchema), async (req, res, next) => {
  try { const promo = await req.prisma.promotion.create({ data: req.validatedBody });
    res.status(201).json({ success: true, data: promo });
  } catch (err) { next(err); }
});

// POST /api/promotions/validate — Validar y usar código (con transacción atómica para evitar race condition)
router.post('/validate', authenticate, async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Código requerido' });
    }

    // Transacción atómica: verifica límites y actualiza en una sola operación
    const promo = await req.prisma.$transaction(async (tx) => {
      const promotion = await tx.promotion.findUnique({
        where: { code },
        select: { id: true, isActive: true, validUntil: true, maxUses: true, usesCount: true, type: true, value: true }
      });

      if (!promotion) {
        throw new Error('INVALID_CODE');
      }

      if (!promotion.isActive) {
        throw new Error('INACTIVE_CODE');
      }

      if (new Date() > new Date(promotion.validUntil)) {
        throw new Error('EXPIRED_CODE');
      }

      if (promotion.maxUses && promotion.usesCount >= promotion.maxUses) {
        throw new Error('EXHAUSTED_CODE');
      }

      // Incrementar uso dentro de la transacción (evita race condition)
      await tx.promotion.update({
        where: { code },
        data: { usesCount: { increment: 1 } }
      });

      return promotion;
    });

    res.json({
      success: true,
      data: {
        type: promo.type,
        value: promo.value,
        usesRemaining: promo.maxUses ? Math.max(0, promo.maxUses - (promo.usesCount + 1)) : null
      }
    });
  } catch (err) {
    if (err.message === 'INVALID_CODE') {
      return res.status(404).json({ success: false, message: 'Código inválido' });
    }
    if (err.message === 'INACTIVE_CODE') {
      return res.status(400).json({ success: false, message: 'Código inactivo' });
    }
    if (err.message === 'EXPIRED_CODE') {
      return res.status(400).json({ success: false, message: 'Código expirado' });
    }
    if (err.message === 'EXHAUSTED_CODE') {
      return res.status(400).json({ success: false, message: 'Código agotado' });
    }
    next(err);
  }
});

module.exports = router;
