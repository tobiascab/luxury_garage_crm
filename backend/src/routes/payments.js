const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
router.get('/', authenticate, async (req, res, next) => {
  try { const payments = await req.prisma.payment.findMany({ where: req.user.role === 'CLIENT' ? { userId: req.user.id } : {}, include: { user: { select: { firstName: true, lastName: true } }, membership: { include: { plan: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: payments });
  } catch (err) { next(err); }
});
module.exports = router;
