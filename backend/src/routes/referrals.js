const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const referrals = await req.prisma.referral.findMany({ where: { referrerId: req.user.id }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: referrals });
  } catch (err) { next(err); }
});

router.post('/invite', authenticate, async (req, res, next) => {
  try {
    const { email, phone } = req.body;
    const referral = await req.prisma.referral.create({ data: { referrerId: req.user.id, referredEmail: email, referredPhone: phone, status: 'invited' } });
    res.status(201).json({ success: true, data: referral });
  } catch (err) { next(err); }
});

router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const total = await req.prisma.referral.count({ where: { referrerId: req.user.id } });
    const registered = await req.prisma.referral.count({ where: { referrerId: req.user.id, status: 'registered' } });
    const purchased = await req.prisma.referral.count({ where: { referrerId: req.user.id, status: 'purchased' } });
    res.json({ success: true, data: { total, registered, purchased } });
  } catch (err) { next(err); }
});

// Admin: Get all referrals for the leads manager
const { authorize } = require('../middleware/auth');
router.get('/all', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const referrals = await req.prisma.referral.findMany({
      include: { referrer: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: referrals });
  } catch (err) { next(err); }
});

module.exports = router;
