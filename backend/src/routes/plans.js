const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

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
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { name, slug, description, priceGs, billingPeriod, servicesIncluded, limitsJson, discountPercent, features, sortOrder } = req.body;
    const plan = await req.prisma.plan.create({
      data: { name, slug, description, priceGs, billingPeriod: billingPeriod || 'monthly', servicesIncluded, limitsJson, discountPercent: discountPercent || 0, features, sortOrder: sortOrder || 0 }
    });
    res.status(201).json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// PUT /api/plans/:id — admin
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const plan = await req.prisma.plan.update({ where: { id: req.params.id }, data: req.body });
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
