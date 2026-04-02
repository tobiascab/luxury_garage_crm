const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const arizarService = require('../services/arizarService');
const ArizarSync = require('../services/arizarSync');

/**
 * GET /api/luxury/profile/full
 * Comprehensive user profile with everything needed for the clean UI
 */
router.get('/profile/full', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const [user, chargeSum, useSum] = await Promise.all([
            req.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true,
                    avatarUrl: true,
                    memberships: {
                        where: { status: 'ACTIVE' },
                        include: { plan: { select: { name: true, priceGs: true } } },
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    },
                    vehicles: {
                        select: { id: true, brand: true, model: true, licensePlate: true, isPrimary: true },
                        orderBy: { isPrimary: 'desc' },
                        take: 5
                    },
                    appointments: {
                        include: {
                            service: { select: { name: true } },
                            vehicle: { select: { model: true, licensePlate: true } }
                        },
                        orderBy: { startTime: 'desc' },
                        take: 5 // Dashboard only needs a few
                    }
                }
            }),
            req.prisma.credit.aggregate({
                where: { userId, type: 'CHARGE' },
                _sum: { amount: true }
            }),
            req.prisma.credit.aggregate({
                where: { userId, type: 'USE' },
                _sum: { amount: true }
            })
        ]);

        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

        const wallet_balance = (chargeSum._sum.amount || 0) - (useSum._sum.amount || 0);
        const activeMembership = user.memberships[0];

        res.json({
            success: true,
            data: {
                ...user,
                name: `${user.firstName} ${user.lastName}`,
                wallet_balance,
                membership_status: activeMembership ? 'Activa' : 'Inactiva',
                activeMembership,
                bookings: user.appointments.map(a => ({
                    ...a,
                    booking_date: a.startTime // Standard alias
                })),
                avatar: user.avatarUrl || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=0040e0&color=fff`
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

        console.log(`[DEBUG_QR] Token recibido: ${token}`);
        const parts = token.split('-');
        if (parts.length < 3) return res.status(400).json({ success: false, message: 'QR inválido (formato)' });

        // The timestamp is always the last part, the userId is everything in between the prefix 'LUXURY' and the timestamp
        const timestamp = parseInt(parts.pop());
        const userId = parts.slice(1).join('-'); // Join back everything after 'LUXURY'

        const diff = Date.now() - timestamp;
        console.log(`[DEBUG_QR] Token valid: ${token}, UserID: ${userId}, diff: ${diff}ms`);

        // QR válido por 15 minutos máximo
        const QR_VALIDITY_MS = 15 * 60 * 1000;  // 15 minutos
        if (Math.abs(diff) > QR_VALIDITY_MS) {
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

        let vehicle = user.vehicles[0];
        const activeMembership = user.memberships[0];

        // Check if user has an active membership or credits
        if (!activeMembership) {
            // In LUXURY they might allow it anyway or check credits, but for now we follow main logic
        }

        const defaultService = await req.prisma.service.findFirst({
            where: { isActive: true },
            orderBy: { basePriceGs: 'asc' }
        });

        if (!defaultService) {
            return res.status(400).json({ success: false, message: 'Error de configuración: No hay servicios disponibles.' });
        }

        // Si estamos en entorno de prueba y no tiene vehículo, le creamos uno genérico
        if (!vehicle) {
            vehicle = await req.prisma.vehicle.create({
                data: {
                    userId: user.id,
                    brand: 'Genérico',
                    model: 'Vehículo de Prueba',
                    year: new Date().getFullYear(),
                    licensePlate: 'TEST-' + Math.floor(Math.random() * 10000),
                    color: '-',
                    isPrimary: true
                }
            });
        }

        // Register the wash (Appointment)
        const appointment = await req.prisma.appointment.create({
            data: {
                userId: user.id,
                vehicleId: vehicle.id,
                employeeId: employeeId,
                serviceId: defaultService.id,
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

        // ── ARIZAR IA FULL SYNC ─────────────────────────────────────────────
        // Fetch full appointment with relations for proper sync
        try {
            const fullUser = await req.prisma.user.findUnique({ where: { id: user.id } });
            const fullAppointment = await req.prisma.appointment.findUnique({
                where: { id: appointment.id },
                include: { service: true, vehicle: true }
            });
            const fullServiceRecord = await req.prisma.serviceRecord.findFirst({
                where: { appointmentId: appointment.id }
            });
            if (fullUser?.arizarContactId) {
                const sync = new ArizarSync(req.prisma);
                await sync.syncServiceCompleted(fullUser, fullAppointment, fullServiceRecord);
                console.log(`✅ ARIZAR: Servicio QR sincronizado para ${fullUser.email}`);
            }
        } catch (e) { console.error('ARIZAR sync error (qr-scan):', e.message); }
        // ───────────────────────────────────────────────────────────────────────

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
                take: 20
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

        // Format for Luxury UI — DB notifications FIRST (admin-created)
        const luxuryNotifs = [];

        // 1. DB Notifications (from admin) — highest priority
        notifications.forEach(n => {
            const typeMap = { info: 'info', promo: 'success', alert: 'reminder', reminder: 'reminder', success: 'success' };
            luxuryNotifs.push({
                id: n.id,
                type: typeMap[n.type] || 'info',
                icon: 'bell',
                title: n.title,
                body: n.message,
                date: n.createdAt.toISOString(),
                isRead: n.isRead
            });
        });

        // 2. Upcoming appointments
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

        // 3. Membership status (lowest priority)
        const activeMembership = user?.memberships?.[0];
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

        res.json({ success: true, data: luxuryNotifs.slice(0, 15) });
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

        // ms timestamp - subtract 15 mins to account for clock drift between client and server
        const driftToleratedSince = new Date(parseInt(since) - 15 * 60 * 1000);
        const wash = await req.prisma.appointment.findFirst({
            where: {
                userId,
                status: 'COMPLETED',
                date: { gte: driftToleratedSince }
            },
            orderBy: { createdAt: 'desc' } // Changed from date to createdAt to be absolutely sure we get the latest created record
        });

        console.log(`[LATEST_WASH] polled by ${userId}. since=${since}. driftTolerated=${driftToleratedSince.toISOString()}. found=${!!wash}. washDate=${wash ? wash.date : 'N/A'}`);

        res.json({ success: true, found: !!wash, data: wash });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

