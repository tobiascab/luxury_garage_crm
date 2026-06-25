const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const ArizarSync = require('../services/arizarSync');

const isAdmin = (role) => role === 'SUPER_ADMIN' || role === 'ADMIN';

// GET / — CLIENT ve las propias; ADMIN/EMPLOYEE ven todas.
router.get('/', authenticate, async (req, res, next) => {
  try {
    const where = req.user.role === 'CLIENT' ? { userId: req.user.id } : {};
    const reviews = await req.prisma.review.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        serviceRecord: {
          include: {
            employee: { select: { firstName: true, lastName: true } },
            appointment: { include: { service: { select: { name: true } }, vehicle: { select: { brand: true, model: true, licensePlate: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: reviews });
  } catch (err) { next(err); }
});

// GET /stats — métricas reales de reputación (admin).
router.get('/stats', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const reviews = await req.prisma.review.findMany({ select: { rating: true, adminResponse: true } });
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    const average = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let pending = 0;
    for (const r of reviews) {
      if (distribution[r.rating] != null) distribution[r.rating] += 1;
      if (!r.adminResponse) pending += 1;
    }
    res.json({ success: true, data: { total, average, distribution, pending, answered: total - pending } });
  } catch (err) { next(err); }
});

// POST / — el cliente crea una reseña sobre un service record.
const createSchema = z.object({
  serviceRecordId: z.string().min(1, 'serviceRecordId requerido'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});
router.post('/', authenticate, validateBody(createSchema), async (req, res, next) => {
  try {
    const { serviceRecordId, rating, comment } = req.validatedBody;
    // Verificar que el service record exista y que su cita pertenezca al usuario actual.
    const serviceRecord = await req.prisma.serviceRecord.findUnique({
      where: { id: serviceRecordId },
      include: { appointment: { select: { userId: true } } },
    });
    if (!serviceRecord) return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
    if (serviceRecord.appointment.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No podés reseñar un servicio que no es tuyo' });
    }
    const review = await req.prisma.review.create({
      data: { userId: req.user.id, serviceRecordId, rating, comment: comment || null },
    });
    res.status(201).json({ success: true, data: review });

    // ═══ ARIZAR IA SYNC ═══ best-effort, POST-RESPUESTA, no bloquea al cliente.
    try {
      const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
      if (user?.arizarContactId) {
        await new ArizarSync(req.prisma).syncReview(user, review);
      }
    } catch (e) {
      console.error('[Reviews] ARIZAR sync after review failed:', e.message);
    }
  } catch (err) { next(err); }
});

// PUT /:id/respond — responder/editar la respuesta oficial (solo admin).
const respondSchema = z.object({
  response: z.string().trim().min(1, 'La respuesta no puede estar vacía').max(2000),
});
router.put('/:id/respond', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(respondSchema), async (req, res, next) => {
  try {
    const existing = await req.prisma.review.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    const review = await req.prisma.review.update({
      where: { id: req.params.id },
      data: { adminResponse: req.validatedBody.response },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        serviceRecord: { include: { appointment: { include: { service: { select: { name: true } } } } } },
      },
    });
    res.json({ success: true, data: review });
  } catch (err) { next(err); }
});

// DELETE /:id/respond — quitar la respuesta oficial (solo admin).
router.delete('/:id/respond', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const existing = await req.prisma.review.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    const review = await req.prisma.review.update({
      where: { id: req.params.id },
      data: { adminResponse: null },
    });
    res.json({ success: true, data: review });
  } catch (err) { next(err); }
});

// DELETE /:id — moderar/eliminar una reseña (solo admin).
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const existing = await req.prisma.review.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    await req.prisma.review.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Reseña eliminada' });
  } catch (err) { next(err); }
});

module.exports = router;
