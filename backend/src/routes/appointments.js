const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const arizarService = require('../services/arizarService');
const ArizarSync = require('../services/arizarSync');
const bancardService = require('../services/bancardService');
const inventoryService = require('../services/inventoryService');
const { postPaymentCompleted } = require('../services/journalService');

/**
 * Cobertura del plan del usuario para un servicio dado.
 * Devuelve si lo cubre (con cupo disponible), si está en el plan, e info de cupo.
 * El cupo se calcula contando las reservas CUBIERTAS de ese servicio en el mes actual
 * (sin contadores frágiles). quota === -1 → ilimitado.
 */
async function getServiceCoverage(prisma, userId, service) {
  const membership = await prisma.membership.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { plan: true },
  });
  if (!membership) return { hasMembership: false, inPlan: false, covered: false };

  const included = Array.isArray(membership.plan?.servicesIncluded) ? membership.plan.servicesIncluded : [];
  const entry = included.find((s) => s && s.slug === service.slug);
  if (!entry) return { hasMembership: true, inPlan: false, covered: false, membership };

  const quota = Number(entry.quota);
  const includedAddons = entry.includedAddons ?? null; // 'all' | [keys] | null (ninguno)
  if (quota === -1) return { hasMembership: true, inPlan: true, covered: true, unlimited: true, remaining: -1, includedAddons, membership };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const used = await prisma.appointment.count({
    where: { userId, serviceId: service.id, coveredByMembership: true, createdAt: { gte: monthStart } },
  });
  const remaining = Math.max(0, quota - used);
  return { hasMembership: true, inPlan: true, covered: remaining > 0, unlimited: false, quota, used, remaining, includedAddons, membership };
}

/**
 * Cobra un turno a la tarjeta guardada del usuario en Bancard (cuando NO está cubierto por el plan).
 * Replica el patrón probado de cobro de membresías:
 *   1. Toma la tarjeta primaria (isPrimary) o la primera del usuario.
 *   2. Refresca el alias_token vía getUserCards (los tokens tienen TTL corto).
 *   3. Llama a bancardService.charge().
 *
 * Devuelve un resultado uniforme:
 *   - aprobado:        { status:'succeeded', shopProcessId, ticketNumber, authNumber }
 *   - requiere 3DS:    { status:'requires_action', requires3ds:true, processId, jsLibUrl, shopProcessId }
 *   - rechazado/error: { status:'failed', message }
 *   - sin tarjeta:     { code:'NO_CARD' }
 */
async function chargeForBooking(prisma, userId, amountGs, description) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { paymentCards: true },
  });

  // Sin ID de Bancard o sin tarjetas guardadas → no se puede cobrar.
  if (!user || !user.bancardUserId || !user.paymentCards || user.paymentCards.length === 0) {
    return { code: 'NO_CARD' };
  }

  // Tarjeta primaria o la primera disponible.
  const selectedCard = user.paymentCards.find((c) => c.isPrimary) || user.paymentCards[0];
  if (!selectedCard) return { code: 'NO_CARD' };

  // Refrescar alias_token desde Bancard (TTL corto); si falla, usamos el cacheado.
  let aliasToken = selectedCard.bancardAliasToken;
  try {
    const bancardCards = await bancardService.getUserCards(user.bancardUserId);
    const fresh = bancardCards.find((c) => parseInt(c.card_id) === selectedCard.bancardCardId);
    if (fresh && fresh.alias_token) {
      aliasToken = fresh.alias_token;
      await prisma.paymentCard.update({
        where: { id: selectedCard.id },
        data: { bancardAliasToken: aliasToken },
      });
    }
  } catch (e) {
    console.warn('[Bancard] No se pudo refrescar alias_token del turno, usando el cacheado:', e.message);
  }

  if (!aliasToken) {
    return { status: 'failed', message: 'No se pudo obtener el token de la tarjeta. Sincronizá tus tarjetas e intentá de nuevo.' };
  }

  const shopProcessId = bancardService.generateShopProcessId();
  const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://luxurygarage.com.py';
  const returnUrl = `${appBaseUrl}/booking?paymentResult=1`;

  let chargeResult;
  try {
    chargeResult = await bancardService.charge({
      shopProcessId,
      amount: amountGs,
      aliasToken,
      description: description || 'Turno - Luxury Garage',
      returnUrl,
    });
  } catch (err) {
    const msg = (err.message || '').startsWith('Bancard:')
      ? err.message.replace('Bancard: ', '')
      : 'No se pudo procesar el pago. Intentá con otra tarjeta.';
    return { status: 'failed', message: msg };
  }

  // 3DS requerido → no se cobró todavía; el frontend completa el challenge en el iframe.
  if (chargeResult.threeDsRequired) {
    return {
      status: 'requires_action',
      requires3ds: true,
      processId: chargeResult.processId,
      jsLibUrl: bancardService.jsLibUrl,
      shopProcessId,
    };
  }

  if (!chargeResult.approved) {
    return { status: 'failed', message: 'El cobro fue rechazado. Verificá tu tarjeta o intentá con otra.' };
  }

  return {
    status: 'succeeded',
    shopProcessId,
    ticketNumber: chargeResult.ticketNumber || null,
    authNumber: chargeResult.authorizationNumber || null,
  };
}

// Saldo disponible de la billetera = suma de créditos no vencidos (incluye debitos negativos).
async function getWalletBalance(prisma, userId) {
  const credits = await prisma.credit.findMany({
    where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { amount: true },
  });
  return credits.reduce((sum, c) => sum + (c.amount || 0), 0);
}

/**
 * Debita `amountGs` del saldo de la billetera de forma ATÓMICA.
 * Toma un lock de fila sobre el usuario (`SELECT ... FOR UPDATE`) para serializar
 * débitos concurrentes del MISMO usuario → evita el doble gasto / sobregiro:
 * un segundo request espera al primero y vuelve a leer el saldo ya reducido.
 * Lanza Error con code='INSUFFICIENT_FUNDS' (y .balance) si no alcanza.
 * Devuelve el saldo resultante.
 */
async function debitWallet(prisma, userId, amountGs, description) {
  return prisma.$transaction(async (tx) => {
    // Lock pesimista de la fila del usuario: serializa los débitos de su billetera.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const credits = await tx.credit.findMany({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { amount: true },
    });
    const balance = credits.reduce((sum, c) => sum + (c.amount || 0), 0);
    if (balance < amountGs) {
      const err = new Error('INSUFFICIENT_FUNDS');
      err.code = 'INSUFFICIENT_FUNDS';
      err.balance = balance;
      throw err;
    }
    await tx.credit.create({
      data: { userId, amount: -amountGs, type: 'WALLET_PAYMENT', description },
    });
    return balance - amountGs;
  });
}

/**
 * Convierte un "startTime" local de Paraguay (ej "2026-06-08T09:00:00" sin TZ)
 * en {start, end} (Date UTC), agregando el offset PYT (UTC-4) si falta.
 * `durationMinutes` define el endTime.
 */
function parseLocalRange(startTime, durationMinutes) {
  const localStartTime = startTime.includes('+') || startTime.includes('Z') || /T.*-\d{2}:\d{2}$/.test(startTime)
    ? startTime
    : `${startTime}-04:00`; // Paraguay Standard Time (UTC-4)
  const start = new Date(localStartTime);
  const end = new Date(start.getTime() + (durationMinutes || 60) * 60000);
  return { start, end };
}

/**
 * Cantidad de bahías disponibles (capacidad de turnos solapados permitidos).
 * Se guarda en la tabla `settings` bajo la key `bays_count` (Setting.value es Json).
 * Si no está configurada o es inválida, se usa el mismo default que el panel de
 * ajustes (2, ver SETTING_SCHEMA en routes/settings.js) para que el comportamiento
 * coincida con lo que ve el admin. Devuelve un entero >= 1.
 */
const DEFAULT_BAYS_COUNT = 2; // 2 lavados simultáneos máx (regla del negocio)
async function getBaysCount(prisma) {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'bays_count' } });
    const n = Math.trunc(Number(row?.value));
    return Number.isFinite(n) && n >= 1 ? n : DEFAULT_BAYS_COUNT;
  } catch (e) {
    // Ante cualquier problema leyendo el ajuste, usamos el default del panel.
    return DEFAULT_BAYS_COUNT;
  }
}

/**
 * ANTI-DOBLE-BOOKING: garantiza que el rango [start, end) no exceda la capacidad
 * de bahías. Dos rangos [aStart,aEnd) y [bStart,bEnd) se solapan si
 * `aStart < bEnd && bStart < aEnd`. Contamos las citas NO canceladas que se solapan
 * y, si alcanzan/superan la cantidad de bahías, rechazamos con un Error
 * `code='SLOT_TAKEN'` (el caller responde 409).
 *
 * Debe llamarse DENTRO de la misma transacción que crea/actualiza la cita para
 * cerrar la ventana TOCTOU entre dos reservas concurrentes del mismo slot.
 * `excludeId` permite ignorar la propia cita al reprogramar (PUT /:id).
 */
async function assertSlotAvailable(tx, start, end, baysCount, excludeId = null) {
  const overlapping = await tx.appointment.count({
    where: {
      status: { not: 'CANCELLED' },
      startTime: { lt: end },
      endTime: { gt: start },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (overlapping >= baysCount) {
    const err = new Error('SLOT_TAKEN');
    err.code = 'SLOT_TAKEN';
    throw err;
  }
}

// GET /api/appointments/available-slots
router.get('/available-slots', authenticate, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ success: false, message: 'startDate y endDate requeridos' });
    const slots = await arizarService.getFreeSlots(startDate, endDate);
    res.json({ success: true, data: slots });
  } catch (err) {
    console.error('Error obteniendo slots de ARIZAR IA:', err.message);
    res.json({ success: true, data: { slots: [] }, message: 'Calendario no disponible temporalmente' });
  }
});

// Lee un setting string (ej opening_time) con fallback. Setting.value es Json.
async function getStringSetting(prisma, key, fallback) {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    const v = row?.value == null ? '' : String(row.value).trim();
    return v || fallback;
  } catch { return fallback; }
}

// Lee slot_duration_minutes (paso entre turnos) con fallback 30.
async function getSlotMinutes(prisma) {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'slot_duration_minutes' } });
    const n = Math.trunc(Number(row?.value));
    return Number.isFinite(n) && n >= 10 ? n : 30;
  } catch { return 30; }
}

function parseHHMM(s, fh, fm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return fh * 60 + fm;
  return Math.min(23, parseInt(m[1], 10)) * 60 + Math.min(59, parseInt(m[2], 10));
}

/**
 * GET /api/appointments/day-availability?date=YYYY-MM-DD&serviceId=...
 * Disponibilidad REAL por turno del día, según settings (horario + slot_duration_minutes +
 * bays_count) y la duración del servicio. Cada turno arranca cada `slot_duration_minutes`
 * dentro del horario y solo se ofrece si el servicio termina antes del cierre. `remaining`
 * = bahías libres en ese rango (mismo criterio de solapamiento que assertSlotAvailable), así
 * el front puede deshabilitar los turnos completos ANTES de que el cliente los elija.
 */
router.get('/day-availability', authenticate, async (req, res, next) => {
  try {
    const { date, serviceId } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ success: false, message: 'Fecha inválida (YYYY-MM-DD)' });
    }

    let durationMinutes = 60;
    if (serviceId) {
      const svc = await req.prisma.service.findUnique({ where: { id: String(serviceId) }, select: { durationMinutes: true } });
      if (svc?.durationMinutes) durationMinutes = svc.durationMinutes;
    }

    const [baysCount, slotMinutes, openStr, closeStr] = await Promise.all([
      getBaysCount(req.prisma),
      getSlotMinutes(req.prisma),
      getStringSetting(req.prisma, 'opening_time', '07:00'),
      getStringSetting(req.prisma, 'closing_time', '18:00'),
    ]);
    const openMin = parseHHMM(openStr, 7, 0);
    const closeMin = parseHHMM(closeStr, 18, 0);

    // Citas activas que tocan el día (1 query); el solapamiento por turno se calcula en memoria.
    const dayStart = parseLocalRange(`${date}T00:00:00`, 0).start;
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const appts = await req.prisma.appointment.findMany({
      where: { status: { not: 'CANCELLED' }, startTime: { lt: dayEnd }, endTime: { gt: dayStart } },
      select: { startTime: true, endTime: true },
    });

    const now = new Date();
    const slots = [];
    for (let t = openMin; t + durationMinutes <= closeMin; t += slotMinutes) {
      const hh = String(Math.floor(t / 60)).padStart(2, '0');
      const mm = String(t % 60).padStart(2, '0');
      const { start, end } = parseLocalRange(`${date}T${hh}:${mm}:00`, durationMinutes);
      const overlapping = appts.filter(a => a.startTime < end && a.endTime > start).length;
      const remaining = Math.max(0, baysCount - overlapping);
      const past = start.getTime() <= now.getTime();
      slots.push({ time: `${hh}:${mm}`, remaining, capacity: baysCount, past, available: remaining > 0 && !past });
    }

    res.json({ success: true, data: { date, slotMinutes, capacity: baysCount, durationMinutes, slots } });
  } catch (err) { next(err); }
});

// GET /api/appointments
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, date } = req.query;
    const where = {};
    if (req.user.role === 'CLIENT') where.userId = req.user.id;
    if (req.user.role === 'EMPLOYEE') where.employeeId = req.user.id;
    if (status) where.status = status.toUpperCase();

    if (date) {
      // Paraguay = UTC-4
      // "2026-04-02" en Paraguay va de 04:00 UTC hasta el día siguiente 03:59:59 UTC
      const [year, month, day] = date.split('-').map(Number);
      const startUtc = new Date(Date.UTC(year, month - 1, day, 4, 0, 0, 0));       // 00:00 PY = 04:00 UTC
      const endUtc   = new Date(Date.UTC(year, month - 1, day + 1, 3, 59, 59, 999)); // 23:59 PY = 03:59 UTC del día siguiente
      where.startTime = { gte: startUtc, lte: endUtc };
    }

    const appointments = await req.prisma.appointment.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } }, vehicle: true, service: true, serviceRecord: true },
      orderBy: { startTime: 'asc' }
    });
    res.json({ success: true, data: appointments });
  } catch (err) { next(err); }
});


// GET /api/appointments/coverage/:serviceId — ¿el plan del usuario cubre este servicio?
router.get('/coverage/:serviceId', authenticate, async (req, res, next) => {
  try {
    const service = await req.prisma.service.findUnique({ where: { id: req.params.serviceId } });
    if (!service) return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
    const cov = await getServiceCoverage(req.prisma, req.user.id, service);
    res.json({
      success: true,
      data: {
        covered: !!cov.covered,            // base cubierto con cupo disponible → ₲0
        unlimited: !!cov.unlimited,
        remaining: cov.remaining ?? null,  // -1 = ilimitado, número = cupo restante, null = no aplica
        hasMembership: !!cov.hasMembership,
        inPlan: !!cov.inPlan,              // el servicio está en el plan (aunque el cupo esté agotado)
        includedAddons: cov.includedAddons ?? null, // 'all' | [keys] | null → qué adicionales cubre el plan
      },
    });
  } catch (err) { next(err); }
});

// POST /api/appointments — Agendar turno (híbrido: cubierto por plan / pago / próximo mes) + sync ARIZAR
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { vehicleId, serviceId, date, startTime, notes, vehicleSize, addons, billingChoice, paymentSource } = req.body;

    // Validación de inputs requeridos (evita 500 por `undefined` más abajo: startTime.includes, new Date(date)...).
    if (!vehicleId || !serviceId || !date || !startTime) {
      return res.status(400).json({ success: false, message: 'Vehículo, servicio, fecha y horario son requeridos.' });
    }

    const service = await req.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return res.status(404).json({ success: false, message: 'Servicio no encontrado' });

    // SEGURIDAD (IDOR): el vehículo DEBE pertenecer al usuario autenticado. Sin esto, un cliente
    // podía reservar (y cobrarse) usando el vehicleId de otro usuario.
    const ownVehicle = await req.prisma.vehicle.findFirst({ where: { id: vehicleId, userId: req.user.id } });
    if (!ownVehicle) return res.status(403).json({ success: false, message: 'El vehículo seleccionado no es válido.' });

    // ── ANTI-DOBLE-BOOKING (pre-check) ──────────────────────────────────────
    // Validamos el slot ANTES de cobrar, para no cobrarle al cliente un horario que
    // ya está lleno. La verificación AUTORITATIVA se repite dentro de la transacción
    // que crea la cita (cierra el TOCTOU entre dos reservas concurrentes).
    const { start: slotStart, end: slotEnd } = parseLocalRange(startTime, service.durationMinutes);
    const baysCount = await getBaysCount(req.prisma);
    try {
      await assertSlotAvailable(req.prisma, slotStart, slotEnd, baysCount);
    } catch (e) {
      if (e.code === 'SLOT_TAKEN') {
        return res.status(409).json({ success: false, code: 'SLOT_TAKEN', message: 'Ese horario ya no está disponible.' });
      }
      throw e;
    }

    // Precio por tamaño (desde la BD) + adicionales elegidos.
    const sizePricing = service.pricingBySize || {};
    const basePrice = (vehicleSize && sizePricing[vehicleSize] != null)
      ? sizePricing[vehicleSize]
      : service.basePriceGs;
    const serviceAddons = Array.isArray(service.addons) ? service.addons : [];
    const chosenAddonKeys = Array.isArray(addons) ? addons : [];

    // ── Cobertura del plan (base + adicionales, granular) ───────────────────
    const cov = await getServiceCoverage(req.prisma, req.user.id, service);

    // ¿Qué adicionales cubre el plan? Solo aplica si la BASE está cubierta.
    const inc = cov.includedAddons; // 'all' | [keys] | null
    const isAddonIncluded = (key) =>
      cov.covered && (inc === 'all' || (Array.isArray(inc) && inc.includes(key)));

    const chosenAddons = serviceAddons.filter((a) => chosenAddonKeys.includes(a.key));
    // Base cubierta → se cobran solo los adicionales NO incluidos.
    // Base NO cubierta → se cobra precio base + todos los adicionales elegidos.
    const addonsChargeable = chosenAddons
      .filter((a) => !isAddonIncluded(a.key))
      .reduce((sum, a) => sum + (a.priceGs || 0), 0);
    const baseChargeable = cov.covered ? 0 : (basePrice || 0);
    const chargeable = baseChargeable + addonsChargeable; // lo que realmente paga el cliente

    // ── Decisión de cobro ───────────────────────────────────────────────────
    let billingMode;
    let coveredByMembership = cov.covered; // la BASE consume cupo si está cubierta
    let chargeNow = false;

    if (chargeable === 0) {
      // Todo cubierto (base + adicionales incluidos) → ₲0
      billingMode = 'covered';
    } else if (cov.covered) {
      // Base cubierta, pero hay adicionales que se cobran → pagar solo los extras
      billingMode = 'paid';
      chargeNow = true;
    } else if (cov.inPlan && cov.hasMembership) {
      // Cupo agotado: el cliente elige pagar ahora o cargar al próximo mes
      if (billingChoice === 'overage') {
        billingMode = 'overage_next_cycle';
      } else if (billingChoice === 'pay') {
        billingMode = 'paid';
        chargeNow = true;
      } else {
        return res.json({ success: true, needsChoice: true, reason: 'quota_exhausted', price: chargeable });
      }
    } else {
      // Sin plan o servicio no incluido → paga el turno completo
      billingMode = 'paid';
      chargeNow = true;
    }

    // Cobro (solo si corresponde pagar ahora): con saldo de billetera o con tarjeta Bancard.
    let bancardShopProcessId = null;
    let bancardTicketNumber = null;
    let bancardAuthNumber = null;
    let paidWithWallet = false;
    if (chargeNow && chargeable > 0) {
      if (paymentSource === 'wallet') {
        // Pagar con saldo → chequeo de saldo + débito ATÓMICOS (evita doble gasto concurrente).
        try {
          await debitWallet(req.prisma, req.user.id, chargeable, `Pago de turno: ${service.name}`);
          paidWithWallet = true;
        } catch (e) {
          if (e.code === 'INSUFFICIENT_FUNDS') {
            return res.status(400).json({
              success: false, code: 'INSUFFICIENT_FUNDS', balance: e.balance,
              message: `Saldo insuficiente (₲ ${Number(e.balance || 0).toLocaleString('es-PY')}). Recargá tu billetera o pagá con tarjeta.`,
            });
          }
          throw e;
        }
      } else {
        const r = await chargeForBooking(req.prisma, req.user.id, chargeable, `Turno: ${service.name}`);
        if (r.code === 'NO_CARD') {
          return res.status(400).json({ success: false, code: 'NO_CARD', message: 'No tenés una tarjeta guardada. Agregala para pagar el turno.' });
        }
        if (r.status === 'requires_action') {
          // 3DS: NO creamos la cita todavía. Persistimos la intención completa en una
          // BancardOperation; la cita se crea al confirmar el 3DS en /charge-booking-3ds-complete.
          const appointmentDraft = {
            userId: req.user.id,
            vehicleId, serviceId,
            date, startTime, notes: notes || null,
            vehicleSize: vehicleSize || null,
            selectedAddons: chosenAddonKeys.length ? chosenAddonKeys : null,
            totalPriceGs: chargeable,
            coveredByMembership,
            billingMode,
          };
          await req.prisma.bancardOperation.create({
            data: {
              shopProcessId: r.shopProcessId,
              userId: req.user.id,
              type: 'charge',
              status: 'PENDING',
              amountGs: chargeable,
              processId: r.processId ? String(r.processId) : null,
              metadataJson: { kind: 'appointment', serviceSlug: service.slug, appointmentDraft },
            },
          });
          await req.prisma.payment.create({
            data: {
              userId: req.user.id, amountGs: chargeable,
              paymentMethod: 'bancard_card', currency: 'PYG', status: 'PENDING',
              description: `appointment:${service.slug}`,
              bancardShopProcessId: r.shopProcessId,
            },
          });
          return res.json({
            success: true,
            status: 'requires_action',
            requires3ds: true,
            data: { processId: r.processId, jsLibUrl: r.jsLibUrl, shopProcessId: r.shopProcessId },
            message: 'Autenticación 3DS requerida. Completá el proceso para confirmar tu turno.',
          });
        }
        if (r.status !== 'succeeded') {
          return res.json({ success: false, status: 'failed', message: r.message || 'No se pudo procesar el pago' });
        }
        bancardShopProcessId = r.shopProcessId;
        bancardTicketNumber = r.ticketNumber;
        bancardAuthNumber = r.authNumber;
      }
    }

    // ── Timezone fix ────────────────────────────────────────────────────────
    // Frontend sends "2026-03-26T09:00:00" (no TZ) → parsed as UTC by Node.js
    // Paraguay is UTC-4 → must append offset so ARIZAR receives correct local time
    const localStartTime = startTime.includes('+') || startTime.includes('Z') || /T.*-\d{2}:\d{2}$/.test(startTime)
      ? startTime
      : `${startTime}-04:00`;   // Paraguay Standard Time (UTC-4)
    // ────────────────────────────────────────────────────────────────────────

    const start = new Date(localStartTime);
    const end = new Date(start.getTime() + service.durationMinutes * 60000);

    // Crear evento en ARIZAR IA
    const vehicle = await req.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
    let arizarAppointmentId = null;

    if (user.arizarContactId) {
      try {
        const arizarEvent = await arizarService.createAppointment({
          contactId: user.arizarContactId,
          startTime: localStartTime,
          endTime: end.toISOString(),
          title: `${service.name} - ${vehicle?.brand || ''} ${vehicle?.model || ''} ${vehicle?.licensePlate || ''}`.trim(),
          notes: notes || '',
        });
        arizarAppointmentId = arizarEvent?.id || arizarEvent?.event?.id || null;
        if (arizarAppointmentId) {
          console.log(`✅ ARIZAR CAL: Cita creada OK id=${arizarAppointmentId}`);
        } else {
          console.warn(`⚠️ ARIZAR CAL: createAppointment retornó null (sin arizarContactId o error silencioso)`);
        }
      } catch (err) {
        console.error('Error creando cita en ARIZAR IA:', err.response?.data || err.message);
      }
    }

    // Save to DB — re-chequeo de solape + creación en una transacción para cerrar
    // el TOCTOU entre dos reservas concurrentes del mismo slot (el pre-check de arriba
    // pudo pasar para ambas; acá serializamos y la segunda recibe SLOT_TAKEN → 409).
    let appointment;
    try {
      appointment = await req.prisma.$transaction(async (tx) => {
        await assertSlotAvailable(tx, start, end, baysCount);
        return tx.appointment.create({
          data: {
            userId: req.user.id, vehicleId, serviceId,
            date: new Date(date), startTime: start, endTime: end,
            status: 'CONFIRMED', notes: notes || null, arizarAppointmentId,
            vehicleSize: vehicleSize || null,
            selectedAddons: chosenAddonKeys.length ? chosenAddonKeys : null,
            totalPriceGs: chargeable, // lo efectivamente cobrado (0 si todo cubierto)
            coveredByMembership,
            billingMode,
          },
          include: { vehicle: true, service: true }
        });
      });
    } catch (e) {
      if (e.code === 'SLOT_TAKEN') {
        return res.status(409).json({ success: false, code: 'SLOT_TAKEN', message: 'Ese horario ya no está disponible.' });
      }
      throw e;
    }

    // Registrar el cobro según el modo
    let directPayment = null;
    if (billingMode === 'paid' && chargeable > 0) {
      directPayment = await req.prisma.payment.create({
        data: {
          userId: req.user.id, amountGs: chargeable,
          paymentMethod: paidWithWallet ? 'wallet' : 'bancard_card',
          currency: 'PYG', status: 'COMPLETED', description: `appointment:${service.slug}`,
          bancardShopProcessId: paidWithWallet ? null : bancardShopProcessId,
          bancardTicketNumber: paidWithWallet ? null : bancardTicketNumber,
          bancardAuthNumber: paidWithWallet ? null : bancardAuthNumber,
        },
      });
      // Marcar la operación Bancard como COMPLETED (solo si fue cobro con tarjeta).
      if (!paidWithWallet && bancardShopProcessId) {
        await req.prisma.bancardOperation.create({
          data: {
            shopProcessId: bancardShopProcessId,
            userId: req.user.id,
            type: 'charge',
            status: 'COMPLETED',
            amountGs: chargeable,
            metadataJson: { kind: 'appointment', serviceSlug: service.slug, appointmentId: appointment.id },
          },
        });
      }
    } else if (billingMode === 'overage_next_cycle') {
      // Extra a facturar en la próxima renovación (cargado al próximo mes)
      await req.prisma.payment.create({
        data: {
          userId: req.user.id, amountGs: chargeable, paymentMethod: 'bancard_card',
          currency: 'PYG', status: 'PENDING', description: `overage:${service.slug}`,
        },
      });
    }

    // Asiento contable (best-effort, POST-COMMIT, no bloqueante) del turno cobrado.
    if (directPayment?.id) postPaymentCompleted(req.prisma, directPayment.id).catch(() => {});

    // ═══ ARIZAR IA: Notify appointment booked ═══
    const sync = new ArizarSync(req.prisma);
    await sync.syncAppointmentBooked(user, appointment);

    res.status(201).json({ success: true, status: 'booked', covered: coveredByMembership, billingMode, data: appointment });
  } catch (err) { next(err); }
});


// POST /api/appointments/charge-booking-3ds-complete — Confirmar turno tras challenge 3DS de Bancard.
// El frontend llama acá cuando el usuario completó el iframe 3DS. Verifica el resultado con Bancard
// y, si aprobó, crea la cita usando el `appointmentDraft` persistido en la BancardOperation.
// Idempotente: si la cita ya fue creada (op COMPLETED), no la duplica.
// Body: { shopProcessId }
router.post('/charge-booking-3ds-complete', authenticate, async (req, res, next) => {
  try {
    const { shopProcessId } = req.body;
    if (!shopProcessId) return res.status(400).json({ success: false, message: 'shopProcessId requerido' });

    // La intención del turno está persistida en la BancardOperation (no se confía en el body).
    const op = await req.prisma.bancardOperation.findFirst({
      where: { shopProcessId: Number(shopProcessId), userId: req.user.id, type: 'charge' },
    });
    if (!op) return res.status(404).json({ success: false, message: 'Operación no encontrada' });

    const meta = op.metadataJson || {};
    if (meta.kind !== 'appointment' || !meta.appointmentDraft) {
      return res.status(400).json({ success: false, message: 'Esta operación no corresponde a un turno.' });
    }
    const draft = meta.appointmentDraft;

    // Idempotencia: si ya está COMPLETED y tenemos el id de cita, devolvemos esa cita.
    if (op.status === 'COMPLETED') {
      const existing = meta.appointmentId
        ? await req.prisma.appointment.findUnique({
            where: { id: meta.appointmentId },
            include: { vehicle: true, service: true },
          })
        : null;
      return res.json({
        success: true,
        status: 'booked',
        data: existing,
        message: 'El turno ya fue confirmado.',
      });
    }

    const pendingPayment = await req.prisma.payment.findFirst({
      where: { bancardShopProcessId: Number(shopProcessId), userId: req.user.id },
    });

    // Verificar resultado con Bancard (mismo enfoque que charge-3ds-complete de membresías).
    let confirmation;
    try {
      confirmation = await bancardService.getConfirmation(Number(shopProcessId));
    } catch (bancardErr) {
      return res.status(402).json({
        success: false,
        message: bancardErr.message.startsWith('Bancard:')
          ? bancardErr.message.replace('Bancard: ', '')
          : 'No se pudo verificar el resultado del pago.',
      });
    }

    const approved = confirmation.response === 'S' && String(confirmation.response_code) === '00';

    // SEGURIDAD: validar que el monto cobrado coincida con el del turno persistido.
    if (approved) {
      const confirmedAmount = Math.round(parseFloat(confirmation.amount));
      if (!Number.isFinite(confirmedAmount) || confirmedAmount !== (draft.totalPriceGs || 0)) {
        if (pendingPayment) {
          await req.prisma.payment.update({
            where: { id: pendingPayment.id },
            data: { status: 'FAILED', description: `${pendingPayment.description || ''} — Monto no coincide (cobrado ${confirmation.amount}, esperado ${draft.totalPriceGs})` },
          });
        }
        await req.prisma.bancardOperation.update({
          where: { shopProcessId: Number(shopProcessId) },
          data: { status: 'FAILED' },
        });
        return res.status(402).json({
          success: false,
          message: 'El monto cobrado no coincide con el del turno. El pago no se aplicó.',
        });
      }
    }

    if (!approved) {
      if (pendingPayment) {
        await req.prisma.payment.update({ where: { id: pendingPayment.id }, data: { status: 'FAILED' } });
      }
      await req.prisma.bancardOperation.update({
        where: { shopProcessId: Number(shopProcessId) },
        data: { status: 'FAILED' },
      });
      return res.status(402).json({
        success: false,
        message: 'El pago 3DS fue rechazado. Intentá con otra tarjeta.',
        data: { responseCode: confirmation.response_code },
      });
    }

    // Aprobado → crear la cita con los datos del draft.
    const bancardTicketNumber = confirmation.ticket_number || null;
    const bancardAuthNumber = confirmation.authorization_number || null;

    const service = await req.prisma.service.findUnique({ where: { id: draft.serviceId } });
    if (!service) return res.status(400).json({ success: false, message: 'Servicio no encontrado para este turno.' });

    const { start, end } = parseLocalRange(draft.startTime, service.durationMinutes);
    const localStartTime = draft.startTime.includes('+') || draft.startTime.includes('Z') || /T.*-\d{2}:\d{2}$/.test(draft.startTime)
      ? draft.startTime
      : `${draft.startTime}-04:00`; // Paraguay (UTC-4)

    // ANTI-DOBLE-BOOKING: el slot pudo llenarse mientras el cliente completaba el 3DS.
    // Se re-verifica de forma autoritativa dentro de la transacción de creación (abajo).
    const baysCount = await getBaysCount(req.prisma);

    // Crear evento en ARIZAR IA (best-effort, igual que el flujo directo).
    const vehicle = await req.prisma.vehicle.findUnique({ where: { id: draft.vehicleId } });
    const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
    let arizarAppointmentId = null;
    if (user.arizarContactId) {
      try {
        const arizarEvent = await arizarService.createAppointment({
          contactId: user.arizarContactId,
          startTime: localStartTime,
          endTime: end.toISOString(),
          title: `${service.name} - ${vehicle?.brand || ''} ${vehicle?.model || ''} ${vehicle?.licensePlate || ''}`.trim(),
          notes: draft.notes || '',
        });
        arizarAppointmentId = arizarEvent?.id || arizarEvent?.event?.id || null;
      } catch (e) {
        console.error('Error creando cita 3DS en ARIZAR IA:', e.response?.data || e.message);
      }
    }

    // Crear cita + completar pago + cerrar operación en una transacción.
    let appointment, completedPayment = null, alreadyMaterialized = false, slotUnavailable = false;
    await req.prisma.$transaction(async (tx) => {
      // Lock + re-check anti doble-materialización con el webhook/job de reconciliación: si el pago
      // ya fue acreditado y la cita creada (op COMPLETED), no la duplicamos.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.user.id} FOR UPDATE`;
      const freshOp = await tx.bancardOperation.findUnique({ where: { shopProcessId: Number(shopProcessId) } });
      if (freshOp?.status === 'COMPLETED') { alreadyMaterialized = true; return; }

      // ANTI-DOBLE-BOOKING (autoritativo): si el slot se llenó durante el 3DS, NO
      // creamos la cita. Marcamos el flag para abortar y dejar traza fuera de la tx
      // (el pago ya fue capturado por Bancard → queda para revisión/reembolso).
      try {
        await assertSlotAvailable(tx, start, end, baysCount);
      } catch (e) {
        if (e.code === 'SLOT_TAKEN') { slotUnavailable = true; return; }
        throw e;
      }

      appointment = await tx.appointment.create({
        data: {
          userId: req.user.id, vehicleId: draft.vehicleId, serviceId: draft.serviceId,
          date: new Date(draft.date), startTime: start, endTime: end,
          status: 'CONFIRMED', notes: draft.notes || null, arizarAppointmentId,
          vehicleSize: draft.vehicleSize || null,
          selectedAddons: draft.selectedAddons || null,
          totalPriceGs: draft.totalPriceGs,
          coveredByMembership: draft.coveredByMembership,
          billingMode: draft.billingMode,
        },
        include: { vehicle: true, service: true },
      });

      if (pendingPayment) {
        completedPayment = await tx.payment.update({
          where: { id: pendingPayment.id },
          data: { status: 'COMPLETED', bancardTicketNumber, bancardAuthNumber },
        });
      } else {
        completedPayment = await tx.payment.create({
          data: {
            userId: req.user.id, amountGs: draft.totalPriceGs,
            paymentMethod: 'bancard_card', currency: 'PYG', status: 'COMPLETED',
            description: `appointment:${service.slug}`,
            bancardShopProcessId: Number(shopProcessId),
            bancardTicketNumber, bancardAuthNumber,
          },
        });
      }

      await tx.bancardOperation.update({
        where: { shopProcessId: Number(shopProcessId) },
        data: {
          status: 'COMPLETED',
          metadataJson: { ...meta, appointmentId: appointment.id },
        },
      });
    });

    if (alreadyMaterialized) {
      const freshOp2 = await req.prisma.bancardOperation.findUnique({ where: { shopProcessId: Number(shopProcessId) } });
      const apptId = freshOp2?.metadataJson?.appointmentId;
      const existing = apptId
        ? await req.prisma.appointment.findUnique({ where: { id: apptId }, include: { vehicle: true, service: true } })
        : null;
      return res.json({ success: true, status: 'booked', data: existing, message: 'El turno ya fue confirmado.' });
    }

    // ANTI-DOBLE-BOOKING: el slot se llenó durante el 3DS. La cita NO se creó (la tx
    // hizo rollback), pero el pago YA fue capturado por Bancard. Dejamos traza para que
    // el flujo de reconciliación/reembolso lo procese y devolvemos 409.
    if (slotUnavailable) {
      if (pendingPayment) {
        await req.prisma.payment.update({
          where: { id: pendingPayment.id },
          data: { status: 'COMPLETED', bancardTicketNumber, bancardAuthNumber, description: `${pendingPayment.description || ''} — SLOT_TAKEN: horario ocupado tras 3DS, requiere reembolso` },
        });
      }
      await req.prisma.bancardOperation.update({
        where: { shopProcessId: Number(shopProcessId) },
        data: { status: 'PENDING', metadataJson: { ...meta, slotTaken: true } },
      });
      return res.status(409).json({
        success: false,
        code: 'SLOT_TAKEN',
        message: 'Ese horario ya no está disponible. Tu pago será revisado y reembolsado.',
      });
    }

    // Asiento contable (best-effort, POST-COMMIT, no bloqueante) del turno cobrado por 3DS.
    if (completedPayment?.id) postPaymentCompleted(req.prisma, completedPayment.id).catch(() => {});

    // ARIZAR IA: notificar turno reservado (best-effort).
    try {
      const sync = new ArizarSync(req.prisma);
      await sync.syncAppointmentBooked(user, appointment);
    } catch (e) {
      console.warn('[Bancard] ARIZAR sync tras 3DS de turno falló:', e.message);
    }

    res.status(201).json({
      success: true,
      status: 'booked',
      covered: draft.coveredByMembership,
      billingMode: draft.billingMode,
      data: appointment,
      message: '¡Turno confirmado exitosamente!',
    });
  } catch (err) {
    console.error('[Bancard] charge-booking-3ds-complete error:', err.message);
    next(err);
  }
});

// POST /api/appointments/admin — Admin agenda un turno manual para un cliente
// No exige membership ni cobra: es una carga manual desde el panel de gestión.
router.post('/admin', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { userId, vehicleId, serviceId, startTime, status, notes, employeeId, vehicleSize, addons } = req.body;

    if (!userId || !vehicleId || !serviceId || !startTime) {
      return res.status(400).json({ success: false, message: 'Cliente, vehículo, servicio y horario son requeridos' });
    }

    const [client, vehicle, service] = await Promise.all([
      req.prisma.user.findUnique({ where: { id: userId } }),
      req.prisma.vehicle.findUnique({ where: { id: vehicleId } }),
      req.prisma.service.findUnique({ where: { id: serviceId } }),
    ]);
    if (!client) return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
    if (!service) return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
    if (vehicle.userId !== userId) {
      return res.status(400).json({ success: false, message: 'El vehículo no pertenece al cliente seleccionado' });
    }

    const VALID_STATUS = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    const finalStatus = VALID_STATUS.includes((status || '').toUpperCase()) ? status.toUpperCase() : 'CONFIRMED';

    if (employeeId) {
      const employee = await req.prisma.user.findUnique({ where: { id: employeeId } });
      if (!employee || !['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'].includes(employee.role)) {
        return res.status(400).json({ success: false, message: 'Empleado inválido' });
      }
    }

    // Precio por tamaño + adicionales (snapshot, igual que el flujo de cliente).
    // El form admin no manda vehicleSize → derivarlo del tamaño real del vehículo (vehicle.size),
    // si no el precio caía a basePriceGs (0/nominal) para servicios tarifados por tamaño.
    const effectiveSize = vehicleSize || vehicle.size || null;
    const sizePricing = service.pricingBySize || {};
    const basePrice = (effectiveSize && sizePricing[effectiveSize] != null) ? sizePricing[effectiveSize] : service.basePriceGs;
    const serviceAddons = Array.isArray(service.addons) ? service.addons : [];
    const chosenAddonKeys = Array.isArray(addons) ? addons : [];
    const addonsTotal = serviceAddons
      .filter((a) => chosenAddonKeys.includes(a.key))
      .reduce((sum, a) => sum + (a.priceGs || 0), 0);
    const totalPriceGs = (basePrice || 0) + addonsTotal;

    const { start, end } = parseLocalRange(startTime, service.durationMinutes);

    // ── Sincronizar con el calendario de ARIZAR (igual que el flujo del cliente) ──
    // Solo para turnos activos; no para cargas históricas ya cerradas.
    const isActiveTurno = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(finalStatus);

    // ── ANTI-DOBLE-BOOKING (pre-check) ──────────────────────────────────────
    // Solo aplica a turnos ACTIVOS (los que ocupan una bahía). Las cargas históricas
    // (COMPLETED/CANCELLED/NO_SHOW) no se bloquean. El re-chequeo autoritativo se hace
    // dentro de la transacción de creación. NO se crea evento de ARIZAR si se rechaza.
    const baysCount = await getBaysCount(req.prisma);
    if (isActiveTurno) {
      try {
        await assertSlotAvailable(req.prisma, start, end, baysCount);
      } catch (e) {
        if (e.code === 'SLOT_TAKEN') {
          return res.status(409).json({ success: false, code: 'SLOT_TAKEN', message: 'Ese horario ya no está disponible.' });
        }
        throw e;
      }
    }

    let arizarAppointmentId = null;
    if (isActiveTurno && client.arizarContactId) {
      const localStartTime = startTime.includes('+') || startTime.includes('Z') || /T.*-\d{2}:\d{2}$/.test(startTime)
        ? startTime
        : `${startTime}-04:00`; // Paraguay (UTC-4)
      try {
        const arizarEvent = await arizarService.createAppointment({
          contactId: client.arizarContactId,
          startTime: localStartTime,
          endTime: end.toISOString(),
          title: `${service.name} - ${vehicle.brand || ''} ${vehicle.model || ''} ${vehicle.licensePlate || ''}`.trim(),
          notes: notes || '',
        });
        arizarAppointmentId = arizarEvent?.id || arizarEvent?.event?.id || null;
      } catch (err) {
        console.error('Error creando cita admin en ARIZAR IA:', err.response?.data || err.message);
      }
    }

    // ANTI-DOBLE-BOOKING: re-chequeo autoritativo + creación en una transacción
    // (para turnos activos) → cierra el TOCTOU entre cargas admin concurrentes.
    let appointment;
    try {
      appointment = await req.prisma.$transaction(async (tx) => {
        if (isActiveTurno) await assertSlotAvailable(tx, start, end, baysCount);
        return tx.appointment.create({
          data: {
            userId, vehicleId, serviceId,
            employeeId: employeeId || null,
            date: start, startTime: start, endTime: end,
            status: finalStatus,
            notes: notes || null,
            arizarAppointmentId,
            vehicleSize: effectiveSize,
            selectedAddons: chosenAddonKeys.length ? chosenAddonKeys : null,
            totalPriceGs,
            billingMode: 'paid',
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, phone: true } },
            vehicle: true, service: true, serviceRecord: true,
          },
        });
      });
    } catch (e) {
      if (e.code === 'SLOT_TAKEN') {
        return res.status(409).json({ success: false, code: 'SLOT_TAKEN', message: 'Ese horario ya no está disponible.' });
      }
      throw e;
    }

    // Notificar al cliente por WhatsApp (reserva confirmada) cuando corresponde.
    if (isActiveTurno) {
      try {
        const sync = new ArizarSync(req.prisma);
        await sync.syncAppointmentBooked(client, appointment);
      } catch (err) {
        console.error('Error notificando turno admin por ARIZAR:', err.message);
      }
    }

    res.status(201).json({ success: true, data: appointment });
  } catch (err) { next(err); }
});

// PUT /api/appointments/:id — Admin edita un turno (reprogramar, reasignar empleado, cambiar estado, notas)
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const existing = await req.prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { service: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Turno no encontrado' });

    const { startTime, status, notes, employeeId, vehicleId, serviceId } = req.body;
    const data = {};

    // Reasignar servicio (recalcula duración para el endTime)
    let durationMinutes = existing.service?.durationMinutes || 60;
    if (serviceId !== undefined && serviceId !== existing.serviceId) {
      const service = await req.prisma.service.findUnique({ where: { id: serviceId } });
      if (!service) return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
      data.serviceId = serviceId;
      durationMinutes = service.durationMinutes;
    }

    // Reasignar vehículo
    if (vehicleId !== undefined && vehicleId !== existing.vehicleId) {
      const vehicle = await req.prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle) return res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
      if (vehicle.userId !== existing.userId) {
        return res.status(400).json({ success: false, message: 'El vehículo no pertenece al cliente del turno' });
      }
      data.vehicleId = vehicleId;
    }

    // Reprogramar
    if (startTime) {
      const { start, end } = parseLocalRange(startTime, durationMinutes);
      data.date = start;
      data.startTime = start;
      data.endTime = end;
    } else if (serviceId !== undefined && serviceId !== existing.serviceId) {
      // Cambió el servicio (y por ende la duración) sin reprogramar la hora:
      // el endTime se recalcula a partir del startTime existente.
      data.endTime = new Date(new Date(existing.startTime).getTime() + durationMinutes * 60000);
    }

    // Cambiar estado
    if (status !== undefined) {
      const VALID_STATUS = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
      const s = (status || '').toUpperCase();
      if (!VALID_STATUS.includes(s)) return res.status(400).json({ success: false, message: 'Estado inválido' });
      data.status = s;
    }

    // Reasignar empleado (null para quitar)
    if (employeeId !== undefined) {
      if (employeeId === null || employeeId === '') {
        data.employeeId = null;
      } else {
        const employee = await req.prisma.user.findUnique({ where: { id: employeeId } });
        if (!employee || !['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'].includes(employee.role)) {
          return res.status(400).json({ success: false, message: 'Empleado inválido' });
        }
        data.employeeId = employeeId;
      }
    }

    if (notes !== undefined) data.notes = notes || null;

    // ── ANTI-DOBLE-BOOKING (reagendar) ──────────────────────────────────────
    // Solo si cambió la ventana de tiempo (reprogramación o cambio de duración) y el
    // estado efectivo del turno es ACTIVO. Se excluye la propia cita del conteo. El
    // chequeo + update van en una transacción para cerrar el TOCTOU con otra reserva.
    const windowChanged = data.startTime !== undefined || data.endTime !== undefined;
    const effectiveStatus = data.status !== undefined ? data.status : existing.status;
    const effectiveActive = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(effectiveStatus);
    const effStart = data.startTime !== undefined ? data.startTime : existing.startTime;
    const effEnd = data.endTime !== undefined ? data.endTime : existing.endTime;

    let updated;
    try {
      updated = await req.prisma.$transaction(async (tx) => {
        if (windowChanged && effectiveActive) {
          const baysCount = await getBaysCount(req.prisma);
          await assertSlotAvailable(tx, effStart, effEnd, baysCount, req.params.id);
        }
        return tx.appointment.update({
          where: { id: req.params.id },
          data,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, phone: true } },
            vehicle: true, service: true, serviceRecord: true,
          },
        });
      });
    } catch (e) {
      if (e.code === 'SLOT_TAKEN') {
        return res.status(409).json({ success: false, code: 'SLOT_TAKEN', message: 'Ese horario ya no está disponible.' });
      }
      throw e;
    }

    // Sincronizar la nueva fecha/hora con el calendario de ARIZAR IA
    if (startTime && updated.arizarAppointmentId) {
      try {
        await arizarService.updateAppointment(updated.arizarAppointmentId, {
          startTime: updated.startTime.toISOString(),
          endTime: updated.endTime.toISOString(),
        });
      } catch (e) { console.error('Error reprogramando cita en ARIZAR IA:', e.message); }
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// PUT /api/appointments/:id/start — Empleado inicia servicio
router.put('/:id/start', authenticate, authorize('EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    // Check if service was already started (serviceRecord has @unique on appointmentId)
    const existingRecord = await req.prisma.serviceRecord.findUnique({ where: { appointmentId: req.params.id } });
    if (existingRecord) {
      return res.status(409).json({ success: false, message: 'El servicio ya fue iniciado' });
    }

    const appointment = await req.prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'IN_PROGRESS', employeeId: req.user.id },
      include: { user: true, vehicle: true, service: true }
    });
    await req.prisma.serviceRecord.create({ data: { appointmentId: req.params.id, employeeId: req.user.id, startedAt: new Date() } });

    // ═══ ARIZAR IA: Update appointment status ═══
    if (appointment.arizarAppointmentId) {
      try { await arizarService.updateAppointment(appointment.arizarAppointmentId, { appointmentStatus: 'confirmed' }); } catch (e) { }
    }

    // Notify client service started
    if (appointment.user?.arizarContactId) {
      await arizarService.sendWhatsApp(appointment.user.arizarContactId,
        `🚿 ¡Tu servicio ha comenzado!\n\n` +
        `${appointment.service?.name}\n` +
        `🚗 ${appointment.vehicle?.brand} ${appointment.vehicle?.model}\n\n` +
        `Te avisamos cuando esté listo. ⏱️`
      );
    }

    res.json({ success: true, data: appointment });
  } catch (err) { next(err); }
});

// PUT /api/appointments/:id/complete — Empleado completa servicio
router.put('/:id/complete', authenticate, authorize('EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { notes, vehicleObservations } = req.body;
    const appointment = await req.prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED' },
      include: { user: true, vehicle: true, service: true }
    });

    const record = await req.prisma.serviceRecord.findUnique({ where: { appointmentId: req.params.id } });
    let serviceRecord = record;
    if (record) {
      const duration = Math.round((new Date() - new Date(record.startedAt)) / 60000);
      serviceRecord = await req.prisma.serviceRecord.update({ where: { id: record.id }, data: { completedAt: new Date(), durationMinutes: duration, notes, vehicleObservations } });
    }

    // Descuento automático de stock según la receta del servicio (no bloquea el flujo)
    if (serviceRecord) {
      await inventoryService.consumeStockForService(req.prisma, {
        serviceRecordId: serviceRecord.id,
        serviceId: appointment.serviceId,
        vehicleSize: appointment.vehicleSize || null,
        employeeId: req.user.id,
      });
    }

    // Increment usage with plan limit validation
    const membership = await req.prisma.membership.findFirst({
      where: { userId: appointment.userId, status: 'ACTIVE' },
      include: { plan: true }
    });
    if (membership) {
      // El tope total del plan = suma de cupos del array `servicesIncluded` ([{slug, quota}]).
      // quota === -1 en cualquier servicio ⇒ ilimitado. BUG corregido: antes comparaba
      // `servicesUsed (Int) >= servicesIncluded (array JSON)`, que en JS es siempre false →
      // el tope NUNCA se aplicaba y servicesUsed se incrementaba sin control.
      const included = Array.isArray(membership.plan?.servicesIncluded) ? membership.plan.servicesIncluded : [];
      const unlimited = included.some((s) => Number(s?.quota) === -1);
      const totalQuota = unlimited ? Infinity : included.reduce((sum, s) => sum + Math.max(0, Number(s?.quota) || 0), 0);
      if (!unlimited && membership.servicesUsed >= totalQuota) {
        console.warn(`⚠️ Cliente ${appointment.userId} alcanzó límite de servicios (${membership.servicesUsed}/${totalQuota})`);
        // Continúa registrando el servicio pero deja traza de overage en auditoría.
        await req.prisma.auditLog.create({
          data: {
            entity: 'membership_overage',
            action: 'SERVICE_LIMIT_EXCEEDED',
            entityId: membership.id,
            userId: appointment.userId,
            detailsJson: { planTotalQuota: totalQuota, servicesUsed: membership.servicesUsed }
          }
        });
      } else {
        // Incrementar solo si no excede el tope
        await req.prisma.membership.update({
          where: { id: membership.id },
          data: { servicesUsed: { increment: 1 } }
        });
      }
    }

    // ═══ ARIZAR IA: Full sync on service completion ═══
    const sync = new ArizarSync(req.prisma);
    await sync.syncServiceCompleted(appointment.user, appointment, serviceRecord);

    // Update calendar event status
    if (appointment.arizarAppointmentId) {
      try { await arizarService.updateAppointment(appointment.arizarAppointmentId, { appointmentStatus: 'confirmed' }); } catch (e) { }
    }

    res.json({ success: true, data: appointment });
  } catch (err) { next(err); }
});

// DELETE /api/appointments/:id — Cancelar
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const appointment = await req.prisma.appointment.findFirst({
      where: { id: req.params.id, ...(req.user.role === 'CLIENT' ? { userId: req.user.id } : {}) },
      include: { user: true, vehicle: true, service: true }
    });
    if (!appointment) return res.status(404).json({ success: false, message: 'Turno no encontrado' });

    // Delete from ARIZAR IA calendar
    if (appointment.arizarAppointmentId) {
      try { await arizarService.deleteAppointment(appointment.arizarAppointmentId); } catch (err) { console.error('Error eliminando cita de ARIZAR IA:', err.message); }
    }

    await req.prisma.appointment.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });

    // ═══ ARIZAR IA: Notify cancellation ═══
    const sync = new ArizarSync(req.prisma);
    await sync.syncAppointmentCancelled(appointment.user, appointment);

    res.json({ success: true, message: 'Turno cancelado. El slot fue liberado.' });
  } catch (err) { next(err); }
});

module.exports = router;
