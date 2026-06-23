const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const adminOnly = [authenticate, authorize('SUPER_ADMIN', 'ADMIN')];

// Acepta tanto datetime ISO como fecha simple (YYYY-MM-DD del <input type="date">)
const dateLike = z.union([z.string().datetime(), z.string().min(1), z.date()]);

// Validación para crear promoción. validFrom es REQUERIDO en la BD (sin default),
// por eso lo incluimos con default = ahora si el cliente no lo envía.
const promotionSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number().int().positive('Valor debe ser positivo'),
  minPurchase: z.number().int().nonnegative().optional(),
  maxUses: z.number().int().positive('Límite debe ser positivo').optional().nullable(),
  validFrom: dateLike.optional(),
  validUntil: dateLike,
  isActive: z.boolean().default(true),
});

// Para actualizar: todo opcional (no se permite cambiar usesCount manualmente)
const promotionUpdateSchema = promotionSchema.partial();

// Lanza si la fecha es inválida (Invalid Date) para no persistir basura en la BD.
function parseDateStrict(value, field) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`INVALID_DATE:${field}`);
    err.invalidDate = field;
    throw err;
  }
  return d;
}

function normalizeDates(body) {
  const data = { ...body };
  if (data.code) data.code = String(data.code).trim().toUpperCase();
  if (data.validFrom != null) data.validFrom = parseDateStrict(data.validFrom, 'validFrom');
  if (data.validUntil != null) data.validUntil = parseDateStrict(data.validUntil, 'validUntil');
  return data;
}

// GET /api/promotions — todas (incluye inactivas/expiradas)
router.get('/', ...adminOnly, async (req, res, next) => {
  try {
    const promos = await req.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: promos });
  } catch (err) { next(err); }
});

// POST /api/promotions — crear
router.post('/', ...adminOnly, validateBody(promotionSchema), async (req, res, next) => {
  try {
    const data = normalizeDates(req.validatedBody);

    // validFrom requerido en la BD -> default ahora
    if (!data.validFrom) data.validFrom = new Date();

    if (data.validUntil && data.validUntil < data.validFrom) {
      return res.status(400).json({ success: false, message: 'La fecha de cierre no puede ser anterior al inicio' });
    }
    if (data.type === 'PERCENTAGE' && data.value > 100) {
      return res.status(400).json({ success: false, message: 'Un descuento porcentual no puede superar el 100%' });
    }

    const promo = await req.prisma.promotion.create({ data });
    res.status(201).json({ success: true, data: promo });
  } catch (err) {
    if (typeof err.message === 'string' && err.message.startsWith('INVALID_DATE')) {
      return res.status(400).json({ success: false, message: 'Fecha inválida' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Ya existe una promoción con ese código' });
    }
    next(err);
  }
});

// PUT /api/promotions/:id — editar
router.put('/:id', ...adminOnly, validateBody(promotionUpdateSchema), async (req, res, next) => {
  try {
    const existing = await req.prisma.promotion.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Promoción no encontrada' });

    const data = normalizeDates(req.validatedBody);

    const validFrom = data.validFrom ?? existing.validFrom;
    const validUntil = data.validUntil ?? existing.validUntil;
    if (validUntil && validFrom && validUntil < validFrom) {
      return res.status(400).json({ success: false, message: 'La fecha de cierre no puede ser anterior al inicio' });
    }

    const type = data.type ?? existing.type;
    const value = data.value ?? existing.value;
    if (type === 'PERCENTAGE' && value > 100) {
      return res.status(400).json({ success: false, message: 'Un descuento porcentual no puede superar el 100%' });
    }

    const promo = await req.prisma.promotion.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: promo });
  } catch (err) {
    if (typeof err.message === 'string' && err.message.startsWith('INVALID_DATE')) {
      return res.status(400).json({ success: false, message: 'Fecha inválida' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Ya existe una promoción con ese código' });
    }
    next(err);
  }
});

// DELETE /api/promotions/:id — eliminar (solo SUPER_ADMIN; sin soft delete porque el modelo no tiene flag de borrado)
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const existing = await req.prisma.promotion.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Promoción no encontrada' });

    await req.prisma.promotion.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Promoción eliminada' });
  } catch (err) { next(err); }
});

// POST /api/promotions/validate — Validar y usar código (con transacción atómica para evitar race condition)
router.post('/validate', authenticate, async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Código requerido' });
    }

    const promo = await req.prisma.$transaction(async (tx) => {
      const promotion = await tx.promotion.findUnique({
        where: { code: String(code).trim().toUpperCase() },
        select: { id: true, code: true, isActive: true, validFrom: true, validUntil: true, maxUses: true, usesCount: true, type: true, value: true },
      });

      if (!promotion) throw new Error('INVALID_CODE');
      if (!promotion.isActive) throw new Error('INACTIVE_CODE');
      if (promotion.validFrom && new Date() < new Date(promotion.validFrom)) throw new Error('NOT_STARTED');
      if (new Date() > new Date(promotion.validUntil)) throw new Error('EXPIRED_CODE');

      // Incremento atómico con guard en la MISMA query: solo aumenta usesCount si
      // todavía hay cupo (usesCount < maxUses). El guard en JS de arriba lee un valor
      // que puede quedar obsoleto bajo concurrencia y permitir exceder maxUses; el
      // where condicional aquí cierra esa race condition. Si count === 0 el cupo ya
      // se agotó (otra request ganó la carrera).
      if (promotion.maxUses != null) {
        const result = await tx.promotion.updateMany({
          where: { id: promotion.id, usesCount: { lt: promotion.maxUses } },
          data: { usesCount: { increment: 1 } },
        });
        if (result.count === 0) throw new Error('EXHAUSTED_CODE');
      } else {
        // Sin límite de usos: incremento simple.
        await tx.promotion.update({
          where: { id: promotion.id },
          data: { usesCount: { increment: 1 } },
        });
      }

      return promotion;
    });

    res.json({
      success: true,
      data: {
        type: promo.type,
        value: promo.value,
        usesRemaining: promo.maxUses ? Math.max(0, promo.maxUses - (promo.usesCount + 1)) : null,
      },
    });
  } catch (err) {
    const map = {
      INVALID_CODE: [404, 'Código inválido'],
      INACTIVE_CODE: [400, 'Código inactivo'],
      NOT_STARTED: [400, 'La promoción aún no ha iniciado'],
      EXPIRED_CODE: [400, 'Código expirado'],
      EXHAUSTED_CODE: [400, 'Código agotado'],
    };
    if (map[err.message]) {
      const [status, message] = map[err.message];
      return res.status(status).json({ success: false, message });
    }
    next(err);
  }
});

module.exports = router;
