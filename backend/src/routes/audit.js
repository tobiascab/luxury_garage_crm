const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/audit — listar logs de auditoría (solo admin)
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, userId, action, entity, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (entity) where.entity = { contains: entity, mode: 'insensitive' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      req.prisma.auditLog.findMany({
        where, skip, take: parseInt(limit),
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      req.prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true, data: logs,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
});

module.exports = router;
