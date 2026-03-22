const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
router.get('/', authenticate, async (req, res, next) => {
  try { const notifs = await req.prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ success: true, data: notifs });
  } catch (err) { next(err); }
});
router.put('/:id/read', authenticate, async (req, res, next) => {
  try { await req.prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err) { next(err); }
});
module.exports = router;
