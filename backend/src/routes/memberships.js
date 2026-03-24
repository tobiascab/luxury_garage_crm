const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ArizarSync = require('../services/arizarSync');

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
    const membership = await req.prisma.membership.create({
      data: { userId: req.user.id, planId, status: 'ACTIVE', startDate: start, endDate: end },
      include: { plan: true }
    });

    // ── ARIZAR IA SYNC ──────────────────────────────────────────
    try {
      const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
      if (user?.arizarContactId) {
        const sync = new ArizarSync(req.prisma);
        await sync.syncMembershipActivated(user, membership);
        console.log(`✅ ARIZAR: Membresía activada sincronizada para ${user.email}`);
      }
    } catch (e) { console.error('ARIZAR sync error (upgrade):', e.message); }
    // ────────────────────────────────────────────────────────────

    res.json({ success: true, data: membership });
  } catch (err) { next(err); }
});

router.post('/cancel', authenticate, async (req, res, next) => {
  try {
    const current = await req.prisma.membership.findFirst({
      where: { userId: req.user.id, status: 'ACTIVE' },
      include: { plan: true }
    });
    if (!current) return res.status(404).json({ success: false, message: 'No tenés membresía activa' });
    const membership = await req.prisma.membership.update({ where: { id: current.id }, data: { autoRenew: false } });

    // ── ARIZAR IA SYNC ──────────────────────────────────────────
    try {
      const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
      if (user?.arizarContactId) {
        const sync = new ArizarSync(req.prisma);
        await sync.syncMembershipExpired(user, { ...current, plan: current.plan });
        console.log(`✅ ARIZAR: Membresía cancelada sincronizada para ${user.email}`);
      }
    } catch (e) { console.error('ARIZAR sync error (cancel):', e.message); }
    // ────────────────────────────────────────────────────────────

    res.json({ success: true, data: membership, message: 'Tu membresía no se renovará automáticamente' });
  } catch (err) { next(err); }
});

module.exports = router;
