const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

// Validación de datos para crear/actualizar plan
const planSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  slug: z.string().min(1, 'Slug requerido'),
  description: z.string().optional(),
  priceGs: z.number().positive('Precio debe ser positivo'),
  billingPeriod: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
  servicesIncluded: z.number().int().nonnegative('Servicios debe ser >= 0'),
  limitsJson: z.record(z.any()).optional(),
  discountPercent: z.number().min(0).max(100).default(0),
  features: z.array(z.string()).optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// GET /api/plans — public
router.get('/', async (req, res, next) => {
  try {
    const plans = await req.prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: plans });
  } catch (err) { next(err); }
});

// GET /api/plans/:id
router.get('/:id', async (req, res, next) => {
  try {
    const plan = await req.prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// POST /api/plans — admin
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(planSchema), async (req, res, next) => {
  try {
    const plan = await req.prisma.plan.create({ data: req.validatedBody });
    res.status(201).json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// PUT /api/plans/:id — admin
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(planSchema.partial()), async (req, res, next) => {
  try {
    const plan = await req.prisma.plan.update({ where: { id: req.params.id }, data: req.validatedBody });
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// DELETE /api/plans/:id — admin
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    await req.prisma.plan.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Plan desactivado' });
  } catch (err) { next(err); }
});

module.exports = router;
