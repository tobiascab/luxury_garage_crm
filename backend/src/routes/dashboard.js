const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

router.get('/admin', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [totalMembers, activeMembers, newThisMonth, totalRevenue, todayAppointments, membersByPlan, recentPayments, expiringMemberships, lowStockItems, pendingAppointments] = await Promise.all([
      req.prisma.user.count({ where: { role: 'CLIENT' } }),
      req.prisma.membership.count({ where: { status: 'ACTIVE' } }),
      req.prisma.user.count({ where: { role: 'CLIENT', createdAt: { gte: startOfMonth } } }),
      req.prisma.payment.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: startOfMonth } }, _sum: { amountGs: true } }),
      req.prisma.appointment.count({ where: { date: { gte: new Date(new Date(now).setHours(0,0,0,0)), lte: new Date(new Date(now).setHours(23,59,59,999)) }, status: { not: 'CANCELLED' } } }),
      req.prisma.membership.groupBy({ by: ['planId'], where: { status: 'ACTIVE' }, _count: true }),
      req.prisma.payment.findMany({ where: { status: 'COMPLETED' }, orderBy: { createdAt: 'desc' }, take: 5, include: { user: { select: { firstName: true, lastName: true } } } }),
      req.prisma.membership.count({ where: { status: 'ACTIVE', endDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } } }),
      req.prisma.inventoryItem.count({ where: { currentStock: { lte: req.prisma.inventoryItem.minStockAlert } } }),
      req.prisma.appointment.count({ where: { status: 'PENDING' } })
    ]);
    res.json({ success: true, data: { totalMembers, activeMembers, newThisMonth, totalRevenue: totalRevenue._sum.amountGs || 0, todayAppointments, membersByPlan, recentPayments, expiringMemberships, lowStockItems, pendingAppointments } });
  } catch (err) { next(err); }
});

router.get('/client', authenticate, async (req, res, next) => {
  try {
    const [membership, upcomingAppointments, vehicleCount, totalServices, credits] = await Promise.all([
      req.prisma.membership.findFirst({ where: { userId: req.user.id, status: 'ACTIVE' }, include: { plan: true } }),
      req.prisma.appointment.findMany({ where: { userId: req.user.id, status: { in: ['PENDING', 'CONFIRMED'] }, startTime: { gte: new Date() } }, include: { service: true, vehicle: true }, orderBy: { startTime: 'asc' }, take: 5 }),
      req.prisma.vehicle.count({ where: { userId: req.user.id } }),
      req.prisma.appointment.count({ where: { userId: req.user.id, status: 'COMPLETED' } }),
      req.prisma.credit.aggregate({ where: { userId: req.user.id, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] }, _sum: { amount: true } })
    ]);
    res.json({ success: true, data: { membership, upcomingAppointments, vehicleCount, totalServices, creditBalance: credits._sum.amount || 0 } });
  } catch (err) { next(err); }
});

router.get('/employee', authenticate, authorize('EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const endOfDay = new Date(today); endOfDay.setHours(23,59,59,999);
    const [todayJobs, completedToday, avgRating] = await Promise.all([
      req.prisma.appointment.findMany({ where: { employeeId: req.user.id, date: { gte: today, lte: endOfDay } }, include: { user: { select: { firstName: true, lastName: true, phone: true } }, vehicle: true, service: true, serviceRecord: true }, orderBy: { startTime: 'asc' } }),
      req.prisma.appointment.count({ where: { employeeId: req.user.id, status: 'COMPLETED', date: { gte: today, lte: endOfDay } } }),
      req.prisma.review.aggregate({ where: { serviceRecord: { employeeId: req.user.id } }, _avg: { rating: true } })
    ]);
    res.json({ success: true, data: { todayJobs, completedToday, avgRating: avgRating._avg.rating || 0 } });
  } catch (err) { next(err); }
});

module.exports = router;
