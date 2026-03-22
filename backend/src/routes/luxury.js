const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const arizarService = require('../services/arizarService');

/**
 * GET /api/luxury/profile/full
 * Comprehensive user profile with everything needed for the clean UI
 */
router.get('/profile/full', authenticate, async (req, res, next) => {
    try {
        const user = await req.prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                memberships: {
                    include: { plan: true },
                    orderBy: { createdAt: 'desc' }
                },
                vehicles: {
                    orderBy: { isPrimary: 'desc' }
                },
                appointments: {
                    include: { service: true, vehicle: true },
                    orderBy: { startTime: 'desc' },
                    take: 20
                },
                payments: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                },
                credits: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

        // Format for Luxury UI
        const { passwordHash, ...userData } = user;

        // Add computed fields
        const wallet_balance = user.credits.reduce((acc, c) => acc + c.amount, 0);
        const activeMembership = user.memberships.find(m => m.status === 'ACTIVE');

        res.json({
            success: true,
            data: {
                ...userData,
                name: `${user.firstName} ${user.lastName}`,
                wallet_balance,
                membership_status: activeMembership ? 'Activa' : 'Inactiva',
                activeMembership
            }
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/luxury/qr/scan
 * Employee scans a client QR
 */
router.post('/qr/scan', authenticate, authorize('EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
    try {
        const { token } = req.body;
        const employeeId = req.user.id;

        if (!token || !token.startsWith('LUXURY-')) {
            return res.status(400).json({ success: false, message: 'QR inválido' });
        }

        const parts = token.split('-');
        if (parts.length < 3) return res.status(400).json({ success: false, message: 'QR inválido' });

        const userId = parts[1];
        const timestamp = parseInt(parts[2]);

        // Validate token is not older than 5 minutes
        if (Date.now() - timestamp > 300000) {
            return res.status(400).json({ success: false, message: 'QR expirado' });
        }

        // Fetch user
        const user = await req.prisma.user.findUnique({
            where: { id: userId },
            include: {
                memberships: { where: { status: 'ACTIVE' }, include: { plan: true } },
                vehicles: { where: { isPrimary: true }, take: 1 }
            }
        });

        if (!user) return res.status(404).json({ success: false, message: 'Cliente no encontrado' });

        const vehicle = user.vehicles[0];
        const activeMembership = user.memberships[0];

        // Check if user has an active membership or credits
        if (!activeMembership) {
            // In LUXURY they might allow it anyway or check credits, but for now we follow main logic
            // return res.status(403).json({ success: false, message: 'El cliente no tiene una membresía activa' });
        }

        // Register the wash (Appointment)
        const appointment = await req.prisma.appointment.create({
            data: {
                userId: user.id,
                vehicleId: vehicle?.id,
                employeeId: employeeId,
                serviceId: 'qr-wash-id', // We should have a default service for QR washes or use first available
                date: new Date(),
                startTime: new Date(),
                endTime: new Date(),
                status: 'COMPLETED',
                notes: 'Lavado registrado vía QR'
            }
        });

        // Create service record
        await req.prisma.serviceRecord.create({
            data: {
                appointmentId: appointment.id,
                employeeId: employeeId,
                completedAt: new Date(),
                notes: 'Lavado directo por QR'
            }
        });

        // Increment usage in membership
        if (activeMembership) {
            await req.prisma.membership.update({
                where: { id: activeMembership.id },
                data: { servicesUsed: { increment: 1 } }
            });
        }

        // Get total washes this month
        const washesThisMonth = await req.prisma.appointment.count({
            where: {
                userId: user.id,
                status: 'COMPLETED',
                date: {
                    gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                }
            }
        });

        // Notify via WhatsApp if sync service is available
        if (user.arizarContactId) {
            try {
                await arizarService.sendWhatsApp(user.arizarContactId, `✅ ¡Hola ${user.firstName}! Hemos registrado tu lavado presencial correctamente. ¡Gracias por elegirnos!`);
            } catch (e) { console.error('Error sending WA:', e.message); }
        }

        res.json({
            success: true,
            message: '¡Lavado registrado correctamente!',
            data: {
                client: {
                    id: user.id,
                    name: `${user.firstName} ${user.lastName}`,
                    role: activeMembership?.plan?.name || user.role,
                    vehicle: vehicle || null,
                    totalWashes: washesThisMonth,
                    remainingWashes: activeMembership?.plan?.name?.includes('Platinum') ? 'Ilimitados' : Math.max(0, 4 - washesThisMonth)
                }
            }
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/luxury/employee/stats
 */
router.get('/employee/stats', authenticate, authorize('EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
    try {
        const employeeId = req.user.id;
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

        const [totalToday, totalMonth] = await Promise.all([
            req.prisma.appointment.count({
                where: { employeeId, status: 'COMPLETED', date: { gte: todayStart } }
            }),
            req.prisma.appointment.count({
                where: { employeeId, status: 'COMPLETED', date: { gte: monthStart } }
            })
        ]);

        res.json({ success: true, data: { totalToday, totalMonth } });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/luxury/employee/history
 */
router.get('/employee/history', authenticate, authorize('EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
    try {
        const employeeId = req.user.id;
        const history = await req.prisma.appointment.findMany({
            where: { employeeId },
            include: {
                user: { select: { firstName: true, lastName: true } },
                vehicle: true,
                service: true
            },
            orderBy: { date: 'desc' },
            take: 50
        });

        res.json({
            success: true,
            data: history.map(h => ({
                id: h.id,
                booking_date: h.date,
                client_name: `${h.user.firstName} ${h.user.lastName}`,
                service_type: h.service?.name || h.notes,
                vehicle_model: h.vehicle?.model,
                vehicle_plate: h.vehicle?.licensePlate,
                status: h.status
            }))
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/luxury/notifications
 */
router.get('/notifications', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const [notifications, appointments, user] = await Promise.all([
            req.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10
            }),
            req.prisma.appointment.findMany({
                where: { userId, status: 'CONFIRMED', date: { gte: new Date() } },
                orderBy: { date: 'asc' },
                take: 3
            }),
            req.prisma.user.findUnique({
                where: { id: userId },
                include: { memberships: { where: { status: 'ACTIVE' }, include: { plan: true } } }
            })
        ]);

        // Format for Luxury UI
        const luxuryNotifs = [];

        // Membership status
        const activeMembership = user.memberships[0];
        if (activeMembership) {
            luxuryNotifs.push({
                id: 'membership-' + activeMembership.id,
                type: 'info',
                icon: 'shield',
                title: 'Membresía Activa',
                body: `Tu plan ${activeMembership.plan.name} está vigente.`,
                date: activeMembership.createdAt.toISOString()
            });
        }

        // Appointments
        appointments.forEach(a => {
            luxuryNotifs.push({
                id: 'appointment-' + a.id,
                type: 'reminder',
                icon: 'calendar',
                title: '⏰ Turno Próximo',
                body: `Tenés un lavado el ${new Date(a.date).toLocaleDateString('es-ES')}.`,
                date: a.createdAt.toISOString()
            });
        });

        // DB Notifications
        notifications.forEach(n => {
            luxuryNotifs.push({
                id: n.id,
                type: n.type === 'success' ? 'success' : 'info',
                icon: 'bell',
                title: n.title,
                body: n.message,
                date: n.createdAt.toISOString()
            });
        });

        res.json({ success: true, data: luxuryNotifs.slice(0, 8) });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/luxury/latest-wash
 * Client polling to see if their QR was scanned
 */
router.get('/latest-wash', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { since } = req.query; // ms timestamp
        if (!since) return res.status(400).json({ success: false, message: 'since required' });

        const wash = await req.prisma.appointment.findFirst({
            where: {
                userId,
                status: 'COMPLETED',
                date: { gte: new Date(parseInt(since)) }
            },
            orderBy: { date: 'desc' }
        });

        res.json({ success: true, found: !!wash, data: wash });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

