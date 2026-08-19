const router = require('express').Router();
const crypto = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const arizarService = require('../services/arizarService');
const ArizarSync = require('../services/arizarSync');
const inventoryService = require('../services/inventoryService');
const pushService = require('../services/pushService');
const { getPlanUsage } = require('../services/membershipCoverage');

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
        const [user, creditSum, cardCount, pendingMembership] = await Promise.all([
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
            }),
            // ── Datos del alta obligatoria ────────────────────────────────────────────────
            // ¿Tiene al menos una tarjeta catastrada? Sin tarjeta no se puede cobrar ni renovar.
            req.prisma.paymentCard.count({ where: { userId } }),
            // Plan que el admin dejó preseleccionado al crear la cuenta (queda PENDING hasta
            // que el cliente lo pague). Se usa para abrirle el alta con su plan ya elegido.
            req.prisma.membership.findFirst({
                where: { userId, status: 'PENDING' },
                include: { plan: { select: { id: true, name: true, priceGs: true } } },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

        const wallet_balance = creditSum._sum.amount || 0;
        const activeMembership = user.memberships[0];

        // Consumo real del plan en el ciclo vigente (mismo número que usa el cobro al reservar
        // y que ve el empleado al escanear el QR). null si no tiene membresía activa.
        const planUsage = activeMembership ? await getPlanUsage(req.prisma, userId) : null;

        // El alta es OBLIGATORIA para clientes sin membresía activa: al entrar deben cargar
        // tarjeta, elegir plan y pagar (débito adelantado). Staff/admin nunca la ven.
        const onboardingRequired = user.role === 'CLIENT' && !activeMembership;

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
                onboardingRequired,
                hasPaymentCard: cardCount > 0,
                pendingPlan: pendingMembership?.plan || null,
                planUsage,
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
    // `serverNow` es el reloj del SERVIDOR: el cliente lo usa como `since` al preguntar si ya
    // le registraron el lavado (GET /latest-wash). Antes mandaba su propio Date.now() y un
    // celular con la hora corrida dejaba la consulta comparando contra un instante equivocado.
    res.json({
        success: true,
        token: buildQrToken(req.user.id),
        validityMs: QR_VALIDITY_MS,
        serverNow: Date.now(),
    });
});

/**
 * POST /api/luxury/qr/verify
 * Primer paso del escaneo: valida el QR y devuelve a QUIÉN pertenece y qué reservas tiene
 * pendientes, SIN consumir nada. El empleado elige cuál está atendiendo y recién entonces
 * se llama a /qr/scan.
 *
 * Existe para que escanear no descuente por sí solo: antes el primer escaneo completaba la
 * reserva más próxima de una, así que un escaneo de más —o un cliente con varios turnos
 * reservados— gastaba lavados sin que nadie lo aprobara.
 */
router.post('/qr/verify', authenticate, authorize('EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
    try {
        const v = verifyQrToken(req.body?.token);
        if (!v.ok) {
            const msg = v.reason === 'expired' ? 'El código venció. Pedile al cliente que lo actualice.'
                : v.reason === 'signature' ? 'Código inválido o adulterado'
                    : 'Código inválido';
            return res.status(400).json({ success: false, message: msg });
        }

        const user = await req.prisma.user.findUnique({
            where: { id: v.userId },
            include: {
                memberships: { where: { status: 'ACTIVE' }, include: { plan: true } },
                vehicles: { where: { isPrimary: true }, take: 1 },
            },
        });
        if (!user) return res.status(404).json({ success: false, message: 'Cliente no encontrado' });

        const activeMembership = user.memberships[0];
        const reservas = await req.prisma.appointment.findMany({
            where: { userId: user.id, status: { in: ['CONFIRMED', 'IN_PROGRESS'] } },
            include: { service: { select: { name: true } }, vehicle: { select: { brand: true, model: true, licensePlate: true } } },
            orderBy: { startTime: 'asc' },
        });

        const usage = await getPlanUsage(req.prisma, user.id);

        res.json({
            success: true,
            data: {
                client: {
                    id: user.id,
                    name: `${user.firstName} ${user.lastName}`.trim(),
                    plan: activeMembership?.plan?.name || null,
                    vehicle: user.vehicles[0]
                        ? { ...user.vehicles[0], plate: user.vehicles[0].licensePlate }
                        : null,
                    remainingWashes: usage ? usage.remaining : null, // null = ilimitado o sin plan
                    hasPlan: !!activeMembership,
                },
                reservas: reservas.map((r) => ({
                    id: r.id,
                    servicio: r.service?.name || 'Servicio',
                    cuando: r.startTime,
                    estado: r.status,
                    cubierto: r.coveredByMembership,
                    vehiculo: r.vehicle ? `${r.vehicle.brand} ${r.vehicle.model}`.trim() : null,
                    patente: r.vehicle?.licensePlate || null,
                })),
            },
        });
    } catch (err) { next(err); }
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

        // ── El QR redime la RESERVA real del cliente (no crea un lavado por defecto). ──
        // El empleado ELIGE cuál está atendiendo (appointmentId) tras ver la lista en
        // /qr/verify. Sin ese id no se completa nada: antes se tomaba la más próxima
        // automáticamente y un escaneo de más consumía un lavado sin que nadie lo aprobara.
        // Solo se aceptan CONFIRMED (reservada) o IN_PROGRESS (ya iniciada desde el panel).
        const { appointmentId } = req.body;
        if (!appointmentId) {
            return res.status(400).json({
                success: false,
                code: 'APPOINTMENT_REQUIRED',
                message: 'Elegí qué reserva del cliente estás atendiendo.',
            });
        }
        const reservation = await req.prisma.appointment.findFirst({
            where: {
                id: String(appointmentId),
                userId: user.id, // la reserva TIENE que ser de quien muestra el QR
                status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
            },
            include: { service: true, vehicle: true },
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

        // Consumo del plan tras completar ESTE lavado — mismo cálculo que ve el cliente en su
        // dashboard y que usa el cobro al reservar (ciclo de membresía, no mes calendario).
        const usage = await getPlanUsage(req.prisma, user.id);
        const washesThisMonth = usage ? usage.used : await req.prisma.appointment.count({
            where: { userId: user.id, status: 'COMPLETED', createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
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

        // Cupo restante del plan en el ciclo vigente. null = ilimitado (el front muestra "∞").
        // Sale del MISMO cálculo que usa la reserva para decidir si cobra, así el número que
        // ve el operario coincide siempre con el que ve el cliente.
        const remainingWashes = usage ? usage.remaining : null;

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
        const { since } = req.query; // ms timestamp (viene del `serverNow` que devuelve /qr/token)
        const sinceMs = parseInt(since, 10);
        if (!Number.isFinite(sinceMs)) return res.status(400).json({ success: false, message: 'since required' });

        // Se compara contra CUÁNDO SE REGISTRÓ el lavado, no contra la fecha del turno.
        // `date` guarda el día reservado a medianoche UTC (el front manda "2026-08-15"), o sea
        // las 20:00 del día anterior en Paraguay: un QR generado a cualquier hora del día nunca
        // era >= ese instante, así que esto devolvía found=false SIEMPRE y el cliente jamás veía
        // la pantalla de "lavado registrado". El momento real está en updatedAt (el update a
        // COMPLETED) y en serviceRecord.completedAt.
        const sinceDate = new Date(sinceMs - 2 * 60 * 1000); // 2 min de colchón por desfase de reloj
        const wash = await req.prisma.appointment.findFirst({
            where: {
                userId,
                status: 'COMPLETED',
                OR: [
                    { updatedAt: { gte: sinceDate } },
                    { serviceRecord: { completedAt: { gte: sinceDate } } },
                ],
            },
            include: { service: { select: { name: true } } },
            orderBy: { updatedAt: 'desc' },
        });

        res.json({
            success: true,
            found: !!wash,
            data: wash ? { ...wash, serviceName: wash.service?.name || null } : null,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

