const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try { const where = req.user.role === 'CLIENT' ? { userId: req.user.id } : {};
    const reviews = await req.prisma.review.findMany({ where, include: { user: { select: { firstName: true, lastName: true } }, serviceRecord: { include: { appointment: { include: { service: true } } } } }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: reviews });
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try { const { serviceRecordId, rating, comment } = req.body;
    const review = await req.prisma.review.create({ data: { userId: req.user.id, serviceRecordId, rating, comment } });
    res.status(201).json({ success: true, data: review });
  } catch (err) { next(err); }
});

router.put('/:id/respond', authenticate, async (req, res, next) => {
  try { const review = await req.prisma.review.update({ where: { id: req.params.id }, data: { adminResponse: req.body.response } });
    res.json({ success: true, data: review });
  } catch (err) { next(err); }
});

module.exports = router;
