const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { status, plan, search, page = 1, limit = 20 } = req.query;
    const where = { role: 'CLIENT' };
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (search) { where.OR = [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }]; }

    const [members, total] = await Promise.all([
      req.prisma.user.findMany({
        where, include: { memberships: { where: { status: 'ACTIVE' }, include: { plan: true }, take: 1 }, vehicles: true, _count: { select: { appointments: true, reviews: true } } },
        skip: (page - 1) * limit, take: parseInt(limit), orderBy: { createdAt: 'desc' }
      }),
      req.prisma.user.count({ where })
    ]);
    res.json({ success: true, data: members.map(m => { const { passwordHash, ...u } = m; return u; }), pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

router.get('/stats', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const [total, active, newThisMonth, byPlan] = await Promise.all([
      req.prisma.user.count({ where: { role: 'CLIENT' } }),
      req.prisma.membership.count({ where: { status: 'ACTIVE' } }),
      req.prisma.user.count({ where: { role: 'CLIENT', createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
      req.prisma.membership.groupBy({ by: ['planId'], where: { status: 'ACTIVE' }, _count: true }),
    ]);
    res.json({ success: true, data: { total, active, newThisMonth, byPlan } });
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const member = await req.prisma.user.findUnique({
      where: { id: req.params.id },
      include: { memberships: { include: { plan: true }, orderBy: { createdAt: 'desc' } }, vehicles: true, appointments: { include: { service: true }, orderBy: { date: 'desc' }, take: 10 }, payments: { orderBy: { createdAt: 'desc' }, take: 10 }, reviews: { orderBy: { createdAt: 'desc' }, take: 5 } }
    });
    if (!member) return res.status(404).json({ success: false, message: 'Miembro no encontrado' });
    const { passwordHash, ...userData } = member;
    res.json({ success: true, data: userData });
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    const { email, firstName, lastName, phone, planId } = req.body;
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const user = await req.prisma.user.create({ data: { email, passwordHash, firstName, lastName, phone, role: 'CLIENT' } });
    if (planId) {
      const plan = await req.prisma.plan.findUnique({ where: { id: planId } });
      if (plan) {
        const start = new Date();
        const end = new Date(); end.setMonth(end.getMonth() + 1);
        await req.prisma.membership.create({ data: { userId: user.id, planId, status: 'ACTIVE', startDate: start, endDate: end } });
      }
    }
    const { passwordHash: _, ...userData } = user;
    res.status(201).json({ success: true, data: { ...userData, tempPassword } });
  } catch (err) { next(err); }
});

router.put('/:id/status', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const user = await req.prisma.user.update({ where: { id: req.params.id }, data: { isActive } });
    const { passwordHash, ...userData } = user;
    res.json({ success: true, data: userData });
  } catch (err) { next(err); }
});

module.exports = router;
