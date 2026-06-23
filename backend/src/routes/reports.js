const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

// Nombres cortos de mes en español para las etiquetas de la serie temporal.
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * GET /api/reports
 * Reporte agregado por rango de fechas para el módulo de Reportes del admin.
 * Todos los datos salen de filas reales (Payment, Expense, Membership, User,
 * Appointment, Review). Sin datos ficticios: secciones vacías → arrays/0.
 *
 * Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusivo). Default = mes actual.
 */
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const now = new Date();

    // ── Rango inclusivo ──────────────────────────────────────────────────
    const fromStr = typeof req.query.from === 'string' && req.query.from
      ? req.query.from
      : ymd(new Date(now.getFullYear(), now.getMonth(), 1));
    const toStr = typeof req.query.to === 'string' && req.query.to
      ? req.query.to
      : ymd(now);

    const gte = new Date(`${fromStr}T00:00:00`);
    const lte = new Date(`${toStr}T23:59:59.999`);

    const inRange = { gte, lte };

    const [
      // finance
      completedAgg,
      subscriptionAgg,
      pendingAgg,
      byMethodRaw,
      // expenses
      expenseAgg,
      byCategoryRaw,
      expenseCategories,
      // members
      activeMembers,
      newInRange,
      expiringSoon,
      byPlanRaw,
      plans,
      // appointments
      apptTotal,
      apptCompleted,
      apptCancelled,
      apptPending,
      apptRows,
      services,
      // reviews
      reviewTotal,
      reviewAvg,
      reviewPending,
      reviewByRatingRaw,
    ] = await Promise.all([
      // finance
      req.prisma.payment.aggregate({ where: { status: 'COMPLETED', createdAt: inRange }, _sum: { amountGs: true }, _count: { _all: true } }),
      req.prisma.payment.aggregate({ where: { status: 'COMPLETED', membershipId: { not: null }, createdAt: inRange }, _sum: { amountGs: true } }),
      req.prisma.payment.aggregate({ where: { status: 'PENDING', createdAt: inRange }, _sum: { amountGs: true }, _count: { _all: true } }),
      req.prisma.payment.groupBy({ by: ['paymentMethod'], where: { status: 'COMPLETED', createdAt: inRange }, _sum: { amountGs: true }, _count: { _all: true } }),
      // expenses (Expense.date en rango)
      req.prisma.expense.aggregate({ where: { date: inRange }, _sum: { amountGs: true }, _count: { _all: true } }),
      req.prisma.expense.groupBy({ by: ['categoryId'], where: { date: inRange }, _sum: { amountGs: true }, _count: { _all: true } }),
      req.prisma.expenseCategory.findMany({ select: { id: true, name: true } }),
      // members
      req.prisma.membership.count({ where: { status: 'ACTIVE' } }),
      req.prisma.user.count({ where: { role: 'CLIENT', createdAt: inRange } }),
      req.prisma.membership.count({ where: { status: 'ACTIVE', endDate: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } } }),
      req.prisma.membership.groupBy({ by: ['planId'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      req.prisma.plan.findMany({ select: { id: true, name: true } }),
      // appointments (Appointment.date en rango)
      req.prisma.appointment.count({ where: { date: inRange } }),
      req.prisma.appointment.count({ where: { date: inRange, status: 'COMPLETED' } }),
      req.prisma.appointment.count({ where: { date: inRange, status: { in: ['CANCELLED', 'NO_SHOW'] } } }),
      req.prisma.appointment.count({ where: { date: inRange, status: 'PENDING' } }),
      req.prisma.appointment.findMany({ where: { date: inRange }, select: { serviceId: true, status: true, totalPriceGs: true } }),
      req.prisma.service.findMany({ select: { id: true, name: true } }),
      // reviews (Review.createdAt en rango)
      req.prisma.review.count({ where: { createdAt: inRange } }),
      req.prisma.review.aggregate({ where: { createdAt: inRange }, _avg: { rating: true } }),
      req.prisma.review.count({ where: { createdAt: inRange, adminResponse: null } }),
      req.prisma.review.groupBy({ by: ['rating'], where: { createdAt: inRange }, _count: { _all: true } }),
    ]);

    // ── Finance ──────────────────────────────────────────────────────────
    const revenue = completedAgg._sum.amountGs || 0;
    const transactions = completedAgg._count._all || 0;
    const subscriptionRevenue = subscriptionAgg._sum.amountGs || 0;
    const finance = {
      revenue,
      transactions,
      averageTicket: transactions > 0 ? Math.round(revenue / transactions) : 0,
      subscriptionRevenue,
      servicesRevenue: Math.max(0, revenue - subscriptionRevenue),
      pendingTotal: pendingAgg._sum.amountGs || 0,
      pendingCount: pendingAgg._count._all || 0,
      byMethod: byMethodRaw.map((row) => ({
        method: row.paymentMethod || 'otro',
        count: row._count._all,
        total: row._sum.amountGs || 0,
      })),
    };

    // ── Expenses ─────────────────────────────────────────────────────────
    const categoryNameById = Object.fromEntries(expenseCategories.map((c) => [c.id, c.name]));
    const expenses = {
      total: expenseAgg._sum.amountGs || 0,
      count: expenseAgg._count._all || 0,
      byCategory: byCategoryRaw.map((row) => ({
        category: categoryNameById[row.categoryId] || 'Sin categoría',
        total: row._sum.amountGs || 0,
        count: row._count._all,
      })),
    };

    const net = finance.revenue - expenses.total;

    // ── Revenue series: buckets mensuales que cubren el rango ─────────────
    const [seriesPayments, seriesExpenses] = await Promise.all([
      req.prisma.payment.findMany({ where: { status: 'COMPLETED', createdAt: inRange }, select: { amountGs: true, createdAt: true } }),
      req.prisma.expense.findMany({ where: { date: inRange }, select: { amountGs: true, date: true } }),
    ]);
    const revenueSeries = [];
    const cursor = new Date(gte.getFullYear(), gte.getMonth(), 1);
    const lastBucket = new Date(lte.getFullYear(), lte.getMonth(), 1);
    while (cursor <= lastBucket) {
      const bucketStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const revBucket = seriesPayments
        .filter((p) => p.createdAt >= bucketStart && p.createdAt < bucketEnd)
        .reduce((s, p) => s + (p.amountGs || 0), 0);
      const expBucket = seriesExpenses
        .filter((e) => e.date >= bucketStart && e.date < bucketEnd)
        .reduce((s, e) => s + (e.amountGs || 0), 0);
      revenueSeries.push({
        name: `${bucketStart.getFullYear()}-${pad2(bucketStart.getMonth() + 1)}`,
        label: MONTHS_ES[bucketStart.getMonth()],
        revenue: revBucket,
        expenses: expBucket,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // ── Members ──────────────────────────────────────────────────────────
    const planNameById = Object.fromEntries(plans.map((p) => [p.id, p.name]));
    const members = {
      active: activeMembers,
      newInRange,
      expiringSoon,
      byPlan: byPlanRaw.map((row) => ({
        planName: planNameById[row.planId] || 'Sin plan',
        count: row._count._all,
      })),
    };

    // ── Appointments ─────────────────────────────────────────────────────
    const serviceNameById = Object.fromEntries(services.map((s) => [s.id, s.name]));
    const byServiceMap = new Map();
    for (const a of apptRows) {
      let agg = byServiceMap.get(a.serviceId);
      if (!agg) {
        agg = { name: serviceNameById[a.serviceId] || 'Servicio', count: 0, completed: 0, revenue: 0 };
        byServiceMap.set(a.serviceId, agg);
      }
      agg.count += 1;
      if (a.status === 'COMPLETED') {
        agg.completed += 1;
        agg.revenue += a.totalPriceGs || 0;
      }
    }
    const appointments = {
      total: apptTotal,
      completed: apptCompleted,
      cancelled: apptCancelled,
      pending: apptPending,
      byService: Array.from(byServiceMap.values()),
    };

    // ── Reviews ──────────────────────────────────────────────────────────
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of reviewByRatingRaw) {
      if (distribution[row.rating] !== undefined) distribution[row.rating] = row._count._all;
    }
    const reviews = {
      total: reviewTotal,
      average: reviewAvg._avg.rating ? Math.round(reviewAvg._avg.rating * 10) / 10 : 0,
      pending: reviewPending,
      distribution,
    };

    res.json({
      success: true,
      data: {
        range: { from: fromStr, to: toStr },
        finance,
        expenses,
        net,
        revenueSeries,
        members,
        appointments,
        reviews,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
