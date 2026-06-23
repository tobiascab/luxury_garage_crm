const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

/**
 * Historial de lavados registrados.
 *
 * No existe un modelo "Scan" dedicado en el schema. La señal real de un lavado
 * efectivamente realizado es un Appointment que tiene un ServiceRecord asociado
 * (el empleado lo inició/completó). Por eso este historial se basa en
 * appointments con serviceRecord presente (o en estado COMPLETED / IN_PROGRESS),
 * que es el dato verídico disponible.
 */
const WASH_FILTER = {
  OR: [
    { serviceRecord: { isNot: null } },
    { status: { in: ['COMPLETED', 'IN_PROGRESS'] } },
  ],
};

router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { page = 1, limit = 15, search, from, to } = req.query;

    const where = { AND: [WASH_FILTER] };

    const sanitizedSearch = search?.trim().slice(0, 100);
    if (sanitizedSearch) {
      where.AND.push({
        OR: [
          { user: { firstName: { contains: sanitizedSearch, mode: 'insensitive' } } },
          { user: { lastName: { contains: sanitizedSearch, mode: 'insensitive' } } },
          { user: { email: { contains: sanitizedSearch, mode: 'insensitive' } } },
          { vehicle: { licensePlate: { contains: sanitizedSearch, mode: 'insensitive' } } },
          { service: { name: { contains: sanitizedSearch, mode: 'insensitive' } } },
          { serviceRecord: { employee: { firstName: { contains: sanitizedSearch, mode: 'insensitive' } } } },
          { serviceRecord: { employee: { lastName: { contains: sanitizedSearch, mode: 'insensitive' } } } },
        ],
      });
    }

    // Filtro por rango de fechas (sobre la fecha del turno).
    if (from || to) {
      const dateFilter = {};
      if (from) dateFilter.gte = new Date(`${from}T00:00:00`);
      if (to) dateFilter.lte = new Date(`${to}T23:59:59.999`);
      where.AND.push({ date: dateFilter });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [scans, total] = await Promise.all([
      req.prisma.appointment.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          vehicle: { select: { brand: true, model: true, licensePlate: true, color: true } },
          service: { select: { name: true } },
          serviceRecord: {
            include: { employee: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { date: 'desc' },
      }),
      req.prisma.appointment.count({ where }),
    ]);

    res.json({
      success: true,
      data: scans,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [todayScans, monthScans, totalScans, inProgress] = await Promise.all([
      req.prisma.appointment.count({ where: { AND: [WASH_FILTER, { date: { gte: todayStart } }] } }),
      req.prisma.appointment.count({ where: { AND: [WASH_FILTER, { date: { gte: monthStart } }] } }),
      req.prisma.appointment.count({ where: WASH_FILTER }),
      req.prisma.appointment.count({ where: { status: 'IN_PROGRESS' } }),
    ]);

    res.json({
      success: true,
      data: { todayScans, monthScans, totalScans, inProgress },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
