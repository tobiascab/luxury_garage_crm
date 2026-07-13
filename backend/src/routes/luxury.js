const router = require('express').Router();
const crypto = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const arizarService = require('../services/arizarService');
const ArizarSync = require('../services/arizarSync');
const inventoryService = require('../services/inventoryService');
const pushService = require('../services/pushService');

// ── Token del carnet QR — FIRMADO con HMAC ────────────────────────────────────────────────
// El QR del cliente lo emite SOLO el backend (GET /qr/token), firmado con QR_SECRET. Antes el
// token era `LUXURY-<userId>-<ts>` en texto plano y un EMPLEADO podía fabricar el de cualquier
// cliente (redimir su reserva, consumir inventario). Ahora la firma lo impide. Vence a los 15 min.
const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET || 'luxury-qr-fallback-secret';
const QR_VALIDITY_MS = 15 * 60 * 1000;

function signQrPayload(userId, ts) {
  return crypto.createHmac('sha256', QR_SECRET).update(`${userId}.${ts}`).digest('hex').slice(0, 24);
}
function buildQrToken(userId) {
  const ts = Date.now();
  return `LUXURY-${userId}-${ts}-${signQrPayload(userId, ts)}`;
}
function verifyQrToken(token) {
  if (!token || !token.startsWith('LUXURY-')) return { ok: false, reason: 'format' };
  const parts = token.split('-');
  if (parts.length < 4) return { ok: false, reason: 'format' };
  const sig = parts.pop();
  const ts = parseInt(parts.pop(), 10);
  const userId = parts.slice(1).join('-');
  if (!userId || !Number.isFinite(ts)) return { ok: false, reason: 'format' };
  const expected = signQrPayload(userId, ts);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return { ok: false, reason: 'signature' };
  }
  if (ts > Date.now() + 60_000) return { ok: false, reason: 'future' }; // timestamp futuro = inválido
  if (Date.now() - ts > QR_VALIDITY_MS) return { ok: false, reason: 'expired' };
  return { ok: true, userId, ts };
}

/**
 * GET /api/luxury/profile/full
 * Comprehensive user profile with everything needed for the clean UI
 */
router.get('/profile/full', authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const [user, creditSum] = await Promise.all([
            req.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    role: true,
                    avatarUrl: true,
                    createdAt: true,
                    memberships: {
                        where: { status: 'ACTIVE' },
                        include: { plan: { select: { name: true, priceGs: true, limitsJson: true } } },
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
                    },
                    _count: { select: { vehicles: true, appointments: true } }
                }
            }),
            // Saldo de billetera = suma de TODOS los créditos vigentes (mismo criterio que /api/credits).
            // Antes se filtraba por type 'CHARGE'/'USE' que NUNCA se escriben (los reales son
            // WALLET_TOPUP, WALLET_PAYMENT, REFERRAL_REWARD, etc.) → el saldo daba siempre ₲0.
            req.prisma.credit.aggregate({
                where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
                _sum: { amount: true }
            })
        ]);

        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

        const wallet_balance = creditSum._sum.amount || 0;
        const activeMembership = user.memberships[0];

        res.json({
            success: true,
            data: {
                ...user,
                name: `${user.firstName} ${user.lastName}`,
                wallet_balance,
                vehicleCount: user._count?.vehicles ?? user.vehicles.length,
                appointmentCount: user._count?.appointments ?? user.appointments.length,
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
 * GET /api/luxury/qr/token
 * Emite el token FIRMADO (HMAC) del carnet del cliente autenticado (válido 15 min).
 * El frontend lo usa como contenido del QR — ya NO genera el token por su cuenta.
 */
router.get('/qr/token', authenticate, (req, res) => {
    res.json({ success: true, token: buildQrToken(req.user.id), validityMs: QR_VALIDITY_MS });
});

/**
 * POST /api/luxury/qr/scan
 * Employee scans a client QR
 */
router.post('/qr/scan', authenticate, authorize('EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
    try {
        const { token } = req.body;
        const employeeId = req.user.id;

        // Validación con FIRMA HMAC: el token lo emite el backend (GET /qr/token). Un empleado ya
        // NO puede fabricar el QR de otro cliente. Rechaza adulterados, con timestamp futuro y vencidos.
        const v = verifyQrToken(token);
        if (!v.ok) {
            const msg = v.reason === 'expired' ? 'QR expirado'
                : v.reason === 'signature' ? 'QR inválido o adulterado'
                : 'QR inválido';
            return res.status(400).json({ success: false, message: msg });
        }
        const userId = v.userId;

        // Fetch user
        const user = await req.prisma.user.findUnique({
            where: { id: userId },
            include: {
                memberships: { where: { status: 'ACTIVE' }, include: { plan: true } },
                vehicles: { where: { isPrimary: true }, take: 1 }
            }
        });

        if (!user) return res.status(404).json({ success: false, message: 'Cliente no encontrado' });

        const activeMembership = user.memberships[0];

        // ── Fase 2: el QR redime la RESERVA real del cliente (no crea un lavado por defecto). ──
        // Buscar la reserva redimible: una cita CONFIRMED (reservada, aún no completada) o
        // IN_PROGRESS (turno que el empleado ya inició desde el panel) → el QR también lo cierra.
        // Si no hay → bloquear (cubre el caso "usó todo el cupo y no reservó/pagó").
        const reservation = await req.prisma.appointment.findFirst({
            where: { userId: user.id, status: { in: ['CONFIRMED', 'IN_PROGRESS'] } },
            include: { service: true, vehicle: true },
            orderBy: { startTime: 'asc' },
        });
        if (!reservation) {
            return res.status(400).json({
                success: false,
                code: 'NO_RESERVATION',
                message: 'El cliente no tiene una reserva pendiente. Pedile que reserve su turno primero.',
            });
        }

        // Completar ESA reserva (con su servicio y tamaño reales).
        const completed = await req.prisma.appointment.update({
            where: { id: reservation.id },
            data: { status: 'COMPLETED', employeeId },
            include: { service: true, vehicle: true },
        });
        const vehicle = completed.vehicle;

        // ServiceRecord de esta cita (crear o actualizar).
        let serviceRecord = await req.prisma.serviceRecord.findUnique({ where: { appointmentId: completed.id } });
        if (serviceRecord) {
            serviceRecord = await req.prisma.serviceRecord.update({
                where: { id: serviceRecord.id },
                data: { completedAt: new Date() },
            });
        } else {
            serviceRecord = await req.prisma.serviceRecord.create({
                data: { appointmentId: completed.id, employeeId, startedAt: new Date(), completedAt: new Date(), notes: 'Registrado vía QR' },
            });
        }

        // Descuento automático de inventario según la receta del servicio (no bloquea).
        await inventoryService.consumeStockForService(req.prisma, {
            serviceRecordId: serviceRecord.id,
            serviceId: completed.serviceId,
            vehicleSize: completed.vehicleSize || null,
            employeeId,
        });

        // Lavados completados del mes (para el resumen del operario).
        const washesThisMonth = await req.prisma.appointment.count({
            where: { userId: user.id, status: 'COMPLETED', date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
        });

        // ── ARIZAR IA SYNC ──
        try {
            const fullUser = await req.prisma.user.findUnique({ where: { id: user.id } });
            if (fullUser?.arizarContactId) {
                const sync = new ArizarSync(req.prisma);
                await sync.syncServiceCompleted(fullUser, completed, serviceRecord);
                console.log(`✅ ARIZAR: Servicio QR sincronizado para ${fullUser.email}`);
            }
        } catch (e) { console.error('ARIZAR sync error (qr-scan):', e.message); }

        // Push best-effort al cliente: su lavado quedó registrado.
        pushService.sendToUser(req.prisma, user.id, {
            title: '¡Tu lavado está listo! ✨',
            body: `${completed.service?.name || 'Tu servicio'} fue registrado. ¡Gracias por elegirnos!`,
            type: 'wash_done',
            url: '/qr',
        }).catch((e) => console.error('[push] wash-done falló:', e.message));

        // Cupo restante del plan este mes (dato real de limitsJson.maxWashesPerMonth).
        // -1 o ausente = ilimitado → remainingWashes: null (el front muestra "Ilimitado").
        const maxWashes = activeMembership?.plan?.limitsJson?.maxWashesPerMonth;
        const remainingWashes = (maxWashes == null || maxWashes < 0)
            ? null
            : Math.max(0, maxWashes - washesThisMonth);

        res.json({
            success: true,
            message: `¡${completed.service?.name || 'Servicio'} registrado!`,
            data: {
                client: {
                    id: user.id,
                    name: `${user.firstName} ${user.lastName}`,
                    role: activeMembership?.plan?.name || user.role,
                    // Agregamos `plate` (el schema usa licensePlate) para que el scanner lo muestre.
                    vehicle: vehicle ? { ...vehicle, plate: vehicle.licensePlate } : null,
                    totalWashes: washesThisMonth,
                    remainingWashes, // null = ilimitado
                },
                service: completed.service ? { name: completed.service.name } : null,
                covered: completed.coveredByMembership,
                billingMode: completed.billingMode,
            },
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
        const now = new Date();
        const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
        const fmtDate = (d) => new Date(d).toLocaleDateString('es-PY', { day: 'numeric', month: 'long' });
        const fmtGs = (n) => '₲ ' + Math.abs(n).toLocaleString('es-PY');

        const [dbNotifs, upcoming, recentWashes, user, recentCredits, promos] = await Promise.all([
            req.prisma.notification.findMany({
                where: { userId }, orderBy: { createdAt: 'desc' }, take: 20,
            }),
            req.prisma.appointment.findMany({
                where: { userId, status: 'CONFIRMED', date: { gte: now } },
                orderBy: { date: 'asc' }, take: 3, include: { service: { select: { name: true } } },
            }),
            req.prisma.appointment.findMany({
                where: { userId, status: 'COMPLETED', date: { gte: daysAgo(10) } },
                orderBy: { date: 'desc' }, take: 3, include: { service: { select: { name: true } } },
            }),
            req.prisma.user.findUnique({
                where: { id: userId },
                include: { memberships: { where: { status: 'ACTIVE' }, include: { plan: true }, orderBy: { endDate: 'desc' }, take: 1 } },
            }),
            req.prisma.credit.findMany({
                where: { userId, amount: { gt: 0 }, createdAt: { gte: daysAgo(21) } },
                orderBy: { createdAt: 'desc' }, take: 10,
            }),
            req.prisma.promotion.findMany({
                where: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
                orderBy: { validUntil: 'asc' }, take: 2,
            }),
        ]);

        const items = [];

        // 1. Notificaciones de DB (admin / sistema / push enviadas) — máxima prioridad
        const dbTypeMap = {
            info: 'info', promo: 'promo', alert: 'alert', reminder: 'appointment', success: 'success',
            payment: 'payment', membership: 'membership', wash_done: 'wash_done', referral: 'referral', appointment: 'appointment',
        };
        dbNotifs.forEach(n => items.push({
            id: n.id, type: dbTypeMap[n.type] || 'info', title: n.title, body: n.message,
            date: n.createdAt.toISOString(), isRead: n.isRead,
        }));

        // 2. Próximos turnos confirmados
        upcoming.forEach(a => items.push({
            id: 'appt-' + a.id, type: 'appointment',
            title: 'Turno confirmado',
            body: `${a.service?.name || 'Tu lavado'} el ${fmtDate(a.date)}.`,
            date: a.createdAt.toISOString(),
        }));

        // 3. Lavados recientes terminados
        recentWashes.forEach(a => items.push({
            id: 'wash-' + a.id, type: 'wash_done',
            title: '¡Tu lavado está listo!',
            body: `${a.service?.name || 'Servicio'} completado el ${fmtDate(a.date)}.`,
            date: a.date.toISOString(),
        }));

        // 4. Membresía por vencer (≤ 7 días)
        const m = user?.memberships?.[0];
        if (m) {
            const days = Math.ceil((new Date(m.endDate) - now) / (24 * 60 * 60 * 1000));
            if (days <= 7) {
                items.push({
                    id: 'mem-exp-' + m.id, type: 'membership', title: 'Tu membresía vence pronto',
                    body: `Tu plan ${m.plan.name} vence el ${fmtDate(m.endDate)}. ${m.autoRenew ? 'Se renovará automáticamente.' : '¡Renovala para no perder tus beneficios!'}`,
                    date: now.toISOString(),
                });
            }
        }

        // 5. Movimientos recientes a favor (recarga / bono / promo)
        recentCredits.forEach(c => {
            if (c.type === 'WALLET_TOPUP') {
                items.push({ id: 'cr-' + c.id, type: 'payment', title: 'Recarga acreditada', body: `Se acreditaron ${fmtGs(c.amount)} a tu billetera.`, date: c.createdAt.toISOString() });
            } else if (c.type === 'REFERRAL_REWARD') {
                items.push({ id: 'cr-' + c.id, type: 'referral', title: '¡Ganaste un bono!', body: `${fmtGs(c.amount)} por tu referido${c.description ? ' · ' + c.description : ''}.`, date: c.createdAt.toISOString() });
            } else if (c.type === 'PROMOTION' || c.type === 'COMPENSATION') {
                items.push({ id: 'cr-' + c.id, type: 'promo', title: c.type === 'PROMOTION' ? 'Promoción aplicada' : 'Compensación', body: `${fmtGs(c.amount)}${c.description ? ' · ' + c.description : ' a tu favor'}.`, date: c.createdAt.toISOString() });
            }
        });

        // 6. Promociones vigentes (globales)
        promos.forEach(p => items.push({
            id: 'promo-' + p.id, type: 'promo', title: 'Promoción vigente',
            body: `Aprovechá el código ${p.code} antes del ${fmtDate(p.validUntil)}.`,
            date: p.createdAt.toISOString(),
        }));

        // Dedup por id + orden por fecha desc + cap
        const seen = new Set();
        const data = items
            .filter(it => (seen.has(it.id) ? false : seen.add(it.id)))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 20);

        res.json({ success: true, data });
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

