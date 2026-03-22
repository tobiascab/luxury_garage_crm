const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const memberships = await req.prisma.membership.findMany({ where: { userId: req.user.id }, include: { plan: true }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: memberships });
  } catch (err) { next(err); }
});

router.post('/upgrade', authenticate, async (req, res, next) => {
  try {
    const { planId } = req.body;
    const current = await req.prisma.membership.findFirst({ where: { userId: req.user.id, status: 'ACTIVE' } });
    if (current) await req.prisma.membership.update({ where: { id: current.id }, data: { status: 'CANCELLED' } });
    const start = new Date(); const end = new Date(); end.setMonth(end.getMonth() + 1);
    const membership = await req.prisma.membership.create({ data: { userId: req.user.id, planId, status: 'ACTIVE', startDate: start, endDate: end }, include: { plan: true } });
    res.json({ success: true, data: membership });
  } catch (err) { next(err); }
});

router.post('/cancel', authenticate, async (req, res, next) => {
  try {
    const current = await req.prisma.membership.findFirst({ where: { userId: req.user.id, status: 'ACTIVE' } });
    if (!current) return res.status(404).json({ success: false, message: 'No tenés membresía activa' });
    const membership = await req.prisma.membership.update({ where: { id: current.id }, data: { autoRenew: false } });
    res.json({ success: true, data: membership, message: 'Tu membresía no se renovará automáticamente' });
  } catch (err) { next(err); }
});

module.exports = router;
