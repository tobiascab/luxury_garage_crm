const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search } = req.query;

        // Un escaneo de QR genera un Appointment con status='COMPLETED' y notes='Lavado registrado vía QR'
        // Asi que buscaremos esos
        const where = {
            notes: { contains: 'QR' } // Filtrar por "Lavado registrado vía QR" o similar
        };

        if (search) {
            where.OR = [
                { user: { firstName: { contains: search, mode: 'insensitive' } } },
                { user: { lastName: { contains: search, mode: 'insensitive' } } },
                { serviceRecord: { employee: { firstName: { contains: search, mode: 'insensitive' } } } },
                { serviceRecord: { employee: { lastName: { contains: search, mode: 'insensitive' } } } },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [scans, total] = await Promise.all([
            req.prisma.appointment.findMany({
                where,
                include: {
                    user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
                    vehicle: { select: { model: true, licensePlate: true, color: true } },
                    service: { select: { name: true } },
                    serviceRecord: {
                        include: {
                            employee: { select: { id: true, firstName: true, lastName: true } }
                        }
                    }
                },
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
            }),
            req.prisma.appointment.count({ where })
        ]);

        res.json({
            success: true,
            data: scans,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
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

        const whereBase = { notes: { contains: 'QR' } };

        const [todayScans, monthScans, totalScans] = await Promise.all([
            req.prisma.appointment.count({ where: { ...whereBase, createdAt: { gte: todayStart } } }),
            req.prisma.appointment.count({ where: { ...whereBase, createdAt: { gte: monthStart } } }),
            req.prisma.appointment.count({ where: whereBase }),
        ]);

        res.json({
            success: true,
            data: { todayScans, monthScans, totalScans }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
