const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

router.get('/admin', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(new Date(now).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(now).setHours(23, 59, 59, 999));

    const [
      totalMembers,
      activeMembers,
      newThisMonth,
      totalRevenue,
      todayAppointments,
      membersByPlanRaw,
      recentPayments,
      expiringMemberships,
      inventoryItems,
      pendingAppointments,
      plans,
      subscriptionRevenue,
      pendingPaymentsAgg,
      creditBalanceAgg,
    ] = await Promise.all([
      req.prisma.user.count({ where: { role: 'CLIENT' } }),
      req.prisma.membership.count({ where: { status: 'ACTIVE' } }),
      req.prisma.user.count({ where: { role: 'CLIENT', createdAt: { gte: startOfMonth } } }),
      req.prisma.payment.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: startOfMonth } }, _sum: { amountGs: true } }),
      req.prisma.appointment.count({ where: { date: { gte: startOfDay, lte: endOfDay }, status: { not: 'CANCELLED' } } }),
      req.prisma.membership.groupBy({ by: ['planId'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      req.prisma.payment.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          user: { select: { firstName: true, lastName: true } },
          membership: { select: { id: true, plan: { select: { name: true } } } },
        },
      }),
      req.prisma.membership.count({ where: { status: 'ACTIVE', endDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } } }),
      // Fetch the small set of inventory items and filter in JS — the previous
      // where (currentStock <= req.prisma.inventoryItem.minStockAlert) compared
      // against an undefined Prisma delegate and never worked.
      req.prisma.inventoryItem.findMany({ select: { currentStock: true, minStockAlert: true } }),
      req.prisma.appointment.count({ where: { status: 'PENDING' } }),
      req.prisma.plan.findMany({ select: { id: true, name: true } }),
      // Subscription revenue this month = completed payments linked to a membership
      req.prisma.payment.aggregate({
        where: { status: 'COMPLETED', membershipId: { not: null }, createdAt: { gte: startOfMonth } },
        _sum: { amountGs: true },
      }),
      // Payments awaiting completion (pending / requires action / processing)
      req.prisma.payment.aggregate({
        where: { status: { in: ['PENDING', 'PROCESSING', 'REQUIRES_ACTION'] } },
        _sum: { amountGs: true },
        _count: { _all: true },
      }),
      // Total active credit balance held by clients (wallet "a favor")
      req.prisma.credit.aggregate({
        where: { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        _sum: { amount: true },
      }),
    ]);

    // Enrich membersByPlan with the plan name (groupBy only returns planId)
    const planNameById = Object.fromEntries(plans.map((p) => [p.id, p.name]));
    const membersByPlan = membersByPlanRaw.map((row) => ({
      planId: row.planId,
      planName: planNameById[row.planId] || 'Sin plan',
      count: row._count._all,
    }));

    const lowStockItems = inventoryItems.filter(
      (i) => (i.currentStock ?? 0) <= (i.minStockAlert ?? 0)
    ).length;

    const monthRevenue = totalRevenue._sum.amountGs || 0;
    const subscriptionRevenueGs = subscriptionRevenue._sum.amountGs || 0;
    // Services / other revenue = total completed this month minus subscription part
    const servicesRevenueGs = Math.max(0, monthRevenue - subscriptionRevenueGs);

    // ── Revenue time series: last 6 months of COMPLETED payments ──
    const seriesStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const seriesPayments = await req.prisma.payment.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: seriesStart } },
      select: { amountGs: true, createdAt: true, membershipId: true },
    });
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const bucket = seriesPayments.filter((p) => p.createdAt >= d && p.createdAt < next);
      monthlyRevenue.push({
        name: d.toLocaleDateString('es-PY', { month: 'short' }),
        revenue: bucket.reduce((s, p) => s + (p.amountGs || 0), 0),
        subscriptions: bucket.filter((p) => p.membershipId).reduce((s, p) => s + (p.amountGs || 0), 0),
      });
    }

    res.json({
      success: true,
      data: {
        totalMembers,
        activeMembers,
        newThisMonth,
        totalRevenue: monthRevenue,
        todayAppointments,
        membersByPlan,
        recentPayments,
        expiringMemberships,
        lowStockItems,
        pendingAppointments,
        // Balance / finance breakdown
        subscriptionRevenue: subscriptionRevenueGs,
        servicesRevenue: servicesRevenueGs,
        creditBalance: creditBalanceAgg._sum.amount || 0,
        pendingPaymentsTotal: pendingPaymentsAgg._sum.amountGs || 0,
        pendingPaymentsCount: pendingPaymentsAgg._count._all || 0,
        monthlyRevenue,
      },
    });
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
