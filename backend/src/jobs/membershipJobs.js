const cron = require('node-cron');
const arizarService = require('../services/arizarService');
const emailService = require('../services/emailService');

// Zona horaria de Paraguay (UTC-4, sin DST desde 2024). Todos los cron schedules
// y los cálculos de "inicio/fin de día" deben anclarse acá para no usar la TZ del
// server (típicamente UTC), que correría las ventanas y los horarios 4h.
const TZ = 'America/Asuncion';
const CRON_OPTS = { timezone: TZ };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de fecha en America/Asuncion
// ─────────────────────────────────────────────────────────────────────────────
// Devuelve el offset (en minutos) de America/Asuncion respecto de UTC para una
// fecha dada. Paraguay es UTC-4 fijo, pero lo calculamos vía Intl para ser
// robustos ante cambios de regla. Retorna 240 (= +4h hacia UTC) en la práctica.
function asuncionOffsetMinutes(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  // Instante UTC que tendría esa misma "wall clock" si fuera UTC.
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour === '24' ? '0' : parts.hour), Number(parts.minute), Number(parts.second)
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

// Inicio del día (00:00:00.000 hora Asunción) para "hoy + deltaDays", como Date UTC.
function startOfAsuncionDay(deltaDays = 0, base = new Date()) {
  const offsetMin = asuncionOffsetMinutes(base);
  // Wall-clock de Asunción correspondiente a `base`.
  const wall = new Date(base.getTime() + offsetMin * 60000);
  wall.setUTCDate(wall.getUTCDate() + deltaDays);
  wall.setUTCHours(0, 0, 0, 0);
  // Reconvertir esa medianoche local a instante UTC real.
  return new Date(wall.getTime() - offsetMin * 60000);
}

// Fin del día (23:59:59.999 hora Asunción) para "hoy + deltaDays", como Date UTC.
function endOfAsuncionDay(deltaDays = 0, base = new Date()) {
  const start = startOfAsuncionDay(deltaDays, base);
  // +1 día y -1ms.
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

// Hora local de Asunción (0-23) para una fecha dada.
function asuncionHour(date = new Date()) {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false, hour: '2-digit',
  }).format(date);
  return Number(h === '24' ? '0' : h);
}

// ─────────────────────────────────────────────────────────────────────────────
// Guard de concurrencia: node-cron dispara la corrida aunque la anterior no haya
// terminado. Sin esto dos corridas del MISMO job pueden solaparse y cobrar dos
// veces la misma membresía. Cada job se envuelve con withLock(name, fn).
// ─────────────────────────────────────────────────────────────────────────────
const _running = Object.create(null);
function withLock(name, fn) {
  return async () => {
    if (_running[name]) {
      console.warn(`⏭️  Job "${name}" ya en ejecución; se omite esta corrida (anti-solape).`);
      return;
    }
    _running[name] = true;
    try {
      await fn();
    } finally {
      _running[name] = false;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEDUP de recordatorios (anti-TOCTOU).
// El de-dupe original era read-then-write con una brecha grande entre el check y
// el create → WhatsApps duplicados ante re-corridas o solapes. Ahora:
//   1) los jobs están serializados por withLock (no se solapan consigo mismos), y
//   2) la notificación se "reclama" (create) ANTES de mandar el WhatsApp,
//      usando referenceId como marca idempotente.
// reminderAlreadySent() busca una notificación previa del mismo (userId, type,
// referenceId) dentro de una ventana reciente. Devuelve true si ya se mandó.
async function reminderAlreadySent(prisma, userId, type, referenceId, windowHours) {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const existing = await prisma.notification.findFirst({
    where: { userId, type, referenceId, createdAt: { gte: since } },
    select: { id: true },
  });
  return !!existing;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: renovar una membresía cobrando con Bancard
// ─────────────────────────────────────────────────────────────────────────────
async function renewMembership(prisma, membership) {
  const bancardService = require('../services/bancardService');

  // 1. Obtener usuario con sus tarjetas y bancardUserId
  const user = await prisma.user.findUnique({
    where: { id: membership.userId },
    include: {
      paymentCards: {
        where: { isPrimary: true },
        take: 1,
      },
    },
  });

  if (!user || !user.bancardUserId) {
    console.warn(`⚠️ Usuario sin bancardUserId para renovación: ${membership.userId}`);
    return { success: false, reason: 'no_bancard_user' };
  }

  const primaryCard = user.paymentCards[0];
  if (!primaryCard || !primaryCard.bancardCardId) {
    console.warn(`⚠️ Sin tarjeta Bancard para renovación userId=${membership.userId}`);
    return { success: false, reason: 'no_card' };
  }

  // 2. Obtener alias_token fresco desde Bancard API
  let aliasToken;
  try {
    const bancardCards = await bancardService.getUserCards(user.bancardUserId);
    const matchingCard = bancardCards.find(c => parseInt(c.card_id) === primaryCard.bancardCardId);
    if (!matchingCard) {
      console.warn(`⚠️ Tarjeta ${primaryCard.bancardCardId} no encontrada en Bancard`);
      return { success: false, reason: 'card_not_found_in_bancard' };
    }
    aliasToken = matchingCard.alias_token;
  } catch (err) {
    console.error(`❌ Error obteniendo tarjetas Bancard userId=${membership.userId}:`, err.message);
    return { success: false, reason: 'bancard_cards_error' };
  }

  // 3. Obtener plan ANTES de crear cualquier operación.
  //    Si el plan no existe, abortar acá: usar plan.priceGs con plan=null tiraba
  //    DESPUÉS de crear el BancardOperation/Payment → operación PENDING huérfana.
  const plan = await prisma.plan.findUnique({ where: { id: membership.planId } });
  if (!plan) {
    console.error(`❌ Plan ${membership.planId} no existe para renovación membershipId=${membership.id}; se omite.`);
    return { success: false, reason: 'plan_not_found' };
  }

  // 3.b IDEMPOTENCIA — evitar doble cobro de la MISMA membresía.
  //     Si una corrida previa ya creó (o completó) una operación de auto-renovación
  //     para esta membresía, no volvemos a cobrar. Cubre catch-up y solapes:
  //       • COMPLETED → ya se renovó (no debería seguir ACTIVE, pero por las dudas).
  //       • PENDING   → una corrida cobró/quedó a medias; NO recobramos, va a
  //                     reconciliación manual del Payment huérfano.
  // Solo este job escribe { membershipId, isAutoRenewal: true } en una op 'charge'
  // (los otros flujos de cobro guardan planId/cardId/kind, no membershipId), así que
  // estos dos filtros identifican unívocamente una renovación previa de ESTA membresía.
  const priorOp = await prisma.bancardOperation.findFirst({
    where: {
      userId: user.id,
      type: 'charge',
      // NEEDS_RECONCILIATION = una corrida YA COBRÓ la tarjeta pero la tx de renovación falló
      // (charged:true). Incluirlo evita el RE-COBRO al día siguiente: la membresía sigue ACTIVE y
      // priorOp la encuentra. (FAILED se omite a propósito: ahí NO se cobró → sí se puede reintentar.)
      status: { in: ['PENDING', 'COMPLETED', 'NEEDS_RECONCILIATION'] },
      AND: [
        { metadataJson: { path: ['membershipId'], equals: membership.id } },
        { metadataJson: { path: ['isAutoRenewal'], equals: true } },
      ],
    },
  });
  if (priorOp) {
    console.warn(`⏭️  Renovación ya iniciada/completada para membershipId=${membership.id} (op=${priorOp.shopProcessId}, status=${priorOp.status}); no se recobra.`);
    const reason = priorOp.status === 'COMPLETED' ? 'already_renewed'
      : priorOp.status === 'NEEDS_RECONCILIATION' ? 'renewal_needs_reconciliation'
      : 'renewal_in_progress';
    return { success: false, reason };
  }

  // 3.c OVERAGE — extras de turnos que el cliente difirió "al próximo mes" quedan como
  //     Payment PENDING con description 'overage:...'. En la renovación se cobran JUNTO con
  //     el precio del plan, en un único cargo a la tarjeta. Si el cobro falla, los overages
  //     siguen PENDING (no se tocan) y se reintentan en la próxima renovación.
  const pendingOverages = await prisma.payment.findMany({
    where: { userId: user.id, status: 'PENDING', description: { startsWith: 'overage:' } },
  });
  const overageIds = pendingOverages.map(o => o.id);
  const overageTotal = pendingOverages.reduce((s, o) => s + (o.amountGs || 0), 0);
  const chargeAmount = plan.priceGs + overageTotal;

  // 4. Generar shop_process_id y crear BancardOperation + Payment PENDING antes de cobrar
  const shopProcessId = bancardService.generateShopProcessId();
  await prisma.bancardOperation.create({
    data: {
      shopProcessId,
      userId: user.id,
      type: 'charge',
      status: 'PENDING',
      amountGs: chargeAmount,
      metadataJson: { membershipId: membership.id, planId: plan.id, isAutoRenewal: true, overageIds },
    },
  });

  const pendingPayment = await prisma.payment.create({
    data: {
      userId: user.id,
      amountGs: chargeAmount,
      paymentMethod: 'bancard_card',
      bancardShopProcessId: shopProcessId,
      status: 'PENDING',
      description: `Auto-renovación ${plan.name} - Luxury Garage`,
    },
  });

  // 5. Cobrar con Bancard (con factura electrónica si está habilitada).
  //    Ítems: renovación del plan + (si hay) los extras diferidos del mes anterior, para que la
  //    suma de details cuadre EXACTO con chargeAmount (regla dura de Bancard).
  const billingItems = [{ description: `Renovación ${plan.name}`, amountGs: plan.priceGs, ivaRate: 10, qty: 1 }];
  if (overageTotal > 0) billingItems.push({ description: 'Servicios extra del mes anterior', amountGs: overageTotal, ivaRate: 10, qty: 1 });
  const billing = bancardService.buildBilling({
    client: bancardService.billingClientFromUser(user),
    items: billingItems,
    totalGs: chargeAmount,
  });
  let chargeResult;
  try {
    chargeResult = await bancardService.charge({
      shopProcessId,
      amount: chargeAmount,
      aliasToken,
      description: `Renovacion ${plan.name}`,
      returnUrl: `${process.env.FRONTEND_URL || 'https://luxurygarage.arizar-ia.cloud'}/billetera`,
      billing,
    });
  } catch (err) {
    console.error(`❌ Error Bancard charge renovación userId=${membership.userId}:`, err.message);
    await prisma.payment.update({ where: { id: pendingPayment.id }, data: { status: 'FAILED' } });
    await prisma.bancardOperation.update({ where: { shopProcessId }, data: { status: 'FAILED' } });
    return { success: false, reason: 'charge_error', error: err.message };
  }

  if (!chargeResult.approved) {
    await prisma.payment.update({ where: { id: pendingPayment.id }, data: { status: 'FAILED' } });
    await prisma.bancardOperation.update({ where: { shopProcessId }, data: { status: 'FAILED' } });
    console.warn(`⚠️ Cobro rechazado en renovación userId=${membership.userId} code=${chargeResult.responseCode}`);
    return { success: false, reason: 'charge_rejected', code: chargeResult.responseCode };
  }

  // 6. Cobro exitoso → renovar membresía en $transaction.
  //    DINERO REAL: la tarjeta YA fue cobrada arriba. Si esta tx falla NO debemos
  //    re-cobrar; debemos preservar la traza para reconciliación manual (el Payment
  //    queda PENDING con ticket/auth de Bancard y la op marcada NEEDS_RECONCILIATION).
  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);

  try {
    await prisma.$transaction(async (tx) => {
      // Expirar membresía actual
      await tx.membership.update({
        where: { id: membership.id },
        data: { status: 'EXPIRED' },
      });

      // Crear nueva membresía
      const newMembership = await tx.membership.create({
        data: {
          userId: user.id,
          planId: plan.id,
          status: 'ACTIVE',
          startDate: start,
          endDate: end,
          autoRenew: true,
        },
      });

      // Completar payment
      await tx.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: 'COMPLETED',
          membershipId: newMembership.id,
          bancardTicketNumber: chargeResult.ticketNumber?.toString(),
          bancardAuthNumber: chargeResult.authorizationNumber?.toString(),
          ...bancardService.billingToPaymentData(chargeResult.billing), // nº factura + IVA si se emitió
        },
      });

      // Liquidar los overages cobrados junto con la renovación. El filtro status:'PENDING'
      // es la barrera de idempotencia: si una corrida previa ya los completó, no se vuelven a tocar.
      if (overageIds.length) {
        await tx.payment.updateMany({
          where: { id: { in: overageIds }, status: 'PENDING' },
          data: {
            status: 'COMPLETED',
            membershipId: newMembership.id,
            bancardTicketNumber: chargeResult.ticketNumber?.toString(),
            bancardAuthNumber: chargeResult.authorizationNumber?.toString(),
          },
        });
      }

      await tx.bancardOperation.update({
        where: { shopProcessId },
        data: { status: 'COMPLETED' },
      });
    });
  } catch (txErr) {
    // El cobro a Bancard YA ocurrió. NO perder la traza ni re-cobrar.
    // Guardamos ticket/auth en el Payment (queda PENDING = cobrado pero NO aplicado)
    // y marcamos la operación para que un humano la reconcilie (renovar o reembolsar).
    console.error(
      `🚨 RECONCILIACIÓN: cobro EXITOSO pero falló la tx de renovación. ` +
      `userId=${user.id} membershipId=${membership.id} shopProcessId=${shopProcessId} ` +
      `ticket=${chargeResult.ticketNumber || '-'} auth=${chargeResult.authorizationNumber || '-'}: ${txErr.message}`
    );
    try {
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          // Se deja en PENDING a propósito: cobrado en Bancard pero sin membresía aplicada.
          bancardTicketNumber: chargeResult.ticketNumber?.toString(),
          bancardAuthNumber: chargeResult.authorizationNumber?.toString(),
          description: `${pendingPayment.description} [RECONCILIAR: cobrado, renovación falló]`,
        },
      });
      await prisma.bancardOperation.update({
        where: { shopProcessId },
        data: {
          status: 'NEEDS_RECONCILIATION',
          metadataJson: {
            membershipId: membership.id,
            planId: plan.id,
            isAutoRenewal: true,
            charged: true,
            ticketNumber: chargeResult.ticketNumber || null,
            authorizationNumber: chargeResult.authorizationNumber || null,
            txError: txErr.message,
          },
        },
      });
    } catch (markErr) {
      console.error(`🚨 No se pudo marcar para reconciliación shopProcessId=${shopProcessId}:`, markErr.message);
    }
    return { success: false, reason: 'renewal_tx_failed_after_charge', charged: true, shopProcessId };
  }

  // Asientos contables (best-effort, POST-COMMIT, NO bloqueante). Renovación + overages cobrados.
  try {
    const { postPaymentCompleted } = require('../services/journalService');
    postPaymentCompleted(prisma, pendingPayment.id).catch(() => {});
    for (const oid of overageIds) postPaymentCompleted(prisma, oid).catch(() => {});
  } catch (e) { /* nunca romper la renovación por contabilidad */ }

  return { success: true, shopProcessId, ticketNumber: chargeResult.ticketNumber, newStart: start, newEnd: end, plan };
}

function initJobs(prisma) {
  console.log('⏰ Inicializando cron jobs...');

  // ═══════ MEMBRESÍAS ═══════

  // Diario 08:00 (Asunción) — Avisar membresías que vencen en 7 días
  cron.schedule('0 8 * * *', withLock('membership-7d', async () => {
    try {
      const startOfDay = startOfAsuncionDay(7);
      const endOfDay = endOfAsuncionDay(7);

      const expiring = await prisma.membership.findMany({
        where: { status: 'ACTIVE', endDate: { gte: startOfDay, lte: endOfDay } },
        include: { user: true, plan: true },
      });

      let sent = 0;
      for (const m of expiring) {
        try {
          // DEDUP idempotente: la notificación RENEWAL_REMINDER se "reclama" ANTES
          // de mandar el WhatsApp, con referenceId=membership.id. Si ya existe una
          // de las últimas 48h, se salta (evita WA duplicados ante re-corrida/solape).
          if (await reminderAlreadySent(prisma, m.userId, 'RENEWAL_REMINDER', m.id, 48)) continue;
          await prisma.notification.create({
            data: {
              userId: m.userId, type: 'RENEWAL_REMINDER', referenceId: m.id,
              title: 'Tu membresía vence pronto',
              message: `Tu plan ${m.plan.name} vence el ${m.endDate.toLocaleDateString('es-PY')}. ¡Renová ahora!`,
              channel: 'WHATSAPP',
            },
          });
          sent++;

          if (m.user.arizarContactId) {
            try {
              await arizarService.sendWhatsApp(m.user.arizarContactId,
                `🚗 Hola ${m.user.firstName}! Tu membresía ${m.plan.name} de Luxury Garage vence en 7 días (${m.endDate.toLocaleDateString('es-PY')}). Renová para seguir disfrutando tus beneficios. 💎`
              );
            } catch (e) { console.error('Error enviando aviso 7d:', e.message); }
          }
          // Por correo SIEMPRE: es el canal que no depende del CRM ni del teléfono.
          emailService.sendExpiringSoon(m.user, { planName: m.plan.name, endDate: m.endDate, days: 7 }).catch(() => {});
        } catch (err) {
          console.error(`Error procesando miembro ${m.userId} (aviso 7d):`, err.message);
        }
      }
      if (sent) console.log(`📨 Enviados ${sent} avisos de vencimiento (7 días)`);
    } catch (err) { console.error('❌ Error en job vencimiento 7d:', err.message); }
  }), CRON_OPTS);

  // Diario 08:00 (Asunción) — Avisar membresías que vencen mañana
  cron.schedule('0 8 * * *', withLock('membership-1d', async () => {
    try {
      const startOfDay = startOfAsuncionDay(1);
      const endOfDay = endOfAsuncionDay(1);

      const expiring = await prisma.membership.findMany({
        where: { status: 'ACTIVE', endDate: { gte: startOfDay, lte: endOfDay } },
        include: { user: true, plan: true },
      });

      let sent = 0;
      for (const m of expiring) {
        try {
          // DEDUP idempotente: reclamar la notificación antes de mandar el WA.
          if (await reminderAlreadySent(prisma, m.userId, 'RENEWAL_REMINDER_1D', m.id, 36)) continue;
          await prisma.notification.create({
            data: {
              userId: m.userId, type: 'RENEWAL_REMINDER_1D', referenceId: m.id,
              title: 'Tu membresía vence mañana',
              message: `Tu plan ${m.plan.name} vence mañana. ¡Renová ahora!`,
              channel: 'WHATSAPP',
            },
          });
          sent++;

          if (m.user.arizarContactId) {
            try {
              await arizarService.sendWhatsApp(m.user.arizarContactId,
                `⚠️ ${m.user.firstName}, tu membresía ${m.plan.name} vence MAÑANA. Renová ahora para no perder tus beneficios → https://luxurygarage.arizar-ia.cloud/client/membership`
              );
            } catch (e) { console.error('Error enviando aviso 1d:', e.message); }
          }
          emailService.sendExpiringSoon(m.user, { planName: m.plan.name, endDate: m.endDate, days: 1 }).catch(() => {});
        } catch (err) {
          console.error(`Error procesando miembro ${m.userId} (aviso 1d):`, err.message);
        }
      }
      if (sent) console.log(`📨 Enviados ${sent} avisos urgentes (1 día)`);
    } catch (err) { console.error('❌ Error en job vencimiento 1d:', err.message); }
  }), CRON_OPTS);

  // Diario 00:01 (Asunción) — Expirar membresías vencidas
  cron.schedule('1 0 * * *', withLock('membership-expire', async () => {
    try {
      const now = new Date();
      const expired = await prisma.membership.updateMany({
        where: { status: 'ACTIVE', endDate: { lt: now } },
        data: { status: 'EXPIRED' },
      });
      if (expired.count) console.log(`🔴 ${expired.count} membresías expiradas`);
    } catch (err) { console.error('❌ Error en job expiración:', err.message); }
  }), CRON_OPTS);

  // Diario 10:00 (Asunción) — Oferta a 3 días post-vencimiento
  cron.schedule('0 10 * * *', withLock('membership-offer-3d', async () => {
    try {
      const startOfDay = startOfAsuncionDay(-3);
      const endOfDay = endOfAsuncionDay(-3);

      const lapsed = await prisma.membership.findMany({
        where: { status: 'EXPIRED', endDate: { gte: startOfDay, lte: endOfDay } },
        include: { user: true, plan: true },
      });

      let sent = 0;
      for (const m of lapsed) {
        try {
          // DEDUP idempotente: reclamar la notificación antes de mandar el WA.
          if (await reminderAlreadySent(prisma, m.userId, 'WINBACK_OFFER_3D', m.id, 72)) continue;
          await prisma.notification.create({
            data: {
              userId: m.userId, type: 'WINBACK_OFFER_3D', referenceId: m.id,
              title: '¡Te extrañamos! 15% de descuento',
              message: `Renová tu plan ${m.plan.name} hoy con 15% de descuento.`,
              channel: 'WHATSAPP',
            },
          });
          sent++;

          if (m.user.arizarContactId) {
            try {
              await arizarService.sendWhatsApp(m.user.arizarContactId,
                `🎁 ${m.user.firstName}, te extrañamos! Renová tu membresía ${m.plan.name} HOY con 15% de descuento. Oferta válida por 48hs → https://luxurygarage.arizar-ia.cloud/client/membership`
              );
            } catch (e) { console.error('Error enviando oferta:', e.message); }
          }
        } catch (err) {
          console.error(`Error procesando miembro ${m.userId} (oferta 3d):`, err.message);
        }
      }
      if (sent) console.log(`🎁 Enviadas ${sent} ofertas de re-enganche`);
    } catch (err) { console.error('❌ Error en job oferta 3d:', err.message); }
  }), CRON_OPTS);

  // ═══════ TURNOS ═══════

  // Cada hora — Recordatorio turnos de mañana
  cron.schedule('0 * * * *', withLock('appointment-reminder', async () => {
    try {
      const startOfDay = startOfAsuncionDay(1);
      const endOfDay = endOfAsuncionDay(1);

      // Solo enviar entre 8:00-20:00 hora Asunción.
      const hourPy = asuncionHour();
      if (hourPy < 8 || hourPy > 20) return;

      const appointments = await prisma.appointment.findMany({
        where: { status: 'CONFIRMED', startTime: { gte: startOfDay, lte: endOfDay } },
        include: { user: true, service: true, vehicle: true },
      });

      for (const a of appointments) {
        try {
          // DEDUP idempotente (anti-TOCTOU): reclamar la notificación ANTES de
          // mandar el WhatsApp. Si ya existe una de las últimas 24h, se salta.
          if (await reminderAlreadySent(prisma, a.userId, 'APPOINTMENT_REMINDER', a.id, 24)) continue;

          const time = a.startTime.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
          await prisma.notification.create({
            data: { userId: a.userId, type: 'APPOINTMENT_REMINDER', title: 'Turno mañana', message: `Mañana a las ${time} - ${a.service.name}`, referenceId: a.id, channel: 'WHATSAPP' }
          });

          if (a.user.arizarContactId) {
            try {
              await arizarService.sendWhatsApp(a.user.arizarContactId,
                `📅 Recordatorio: Mañana tenés turno en Luxury Garage a las ${time}. Servicio: ${a.service.name}. Vehículo: ${a.vehicle.brand} ${a.vehicle.model}. ¡Te esperamos! 🚗`
              );
            } catch (e) { console.error('Error enviando recordatorio:', e.message); }
          }
          emailService.sendAppointmentReminder(a.user, {
            serviceName: a.service.name,
            when: `mañana a las ${time}`,
            vehicle: `${a.vehicle.brand} ${a.vehicle.model}`.trim(),
          }).catch(() => {});
        } catch (err) {
          console.error(`Error procesando turno ${a.id} (recordatorio):`, err.message);
        }
      }
    } catch (err) { console.error('❌ Error en job recordatorio turnos:', err.message); }
  }), CRON_OPTS);

  // ═══════ INACTIVIDAD ═══════

  // Diario 09:00 (Asunción) — Detectar clientes inactivos y sync a ARIZAR IA
  cron.schedule('0 9 * * *', withLock('inactivity', async () => {
    try {
      const ArizarSync = require('../services/arizarSync');
      const sync = new ArizarSync(prisma);

      const activeMembers = await prisma.membership.findMany({
        where: { status: 'ACTIVE' },
        include: { user: true },
      });

      for (const m of activeMembers) {
        try {
          if (!m.user.arizarContactId) continue;

          // Find last completed service
          const lastService = await prisma.serviceRecord.findFirst({
            where: { appointment: { userId: m.userId }, completedAt: { not: null } },
            orderBy: { completedAt: 'desc' },
          });

          if (lastService?.completedAt) {
            const daysSince = Math.floor((Date.now() - new Date(lastService.completedAt).getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince >= 15) {
              await sync.syncInactivity(m.user, daysSince);
            }
          }
        } catch (err) {
          console.error(`Error procesando miembro ${m.userId} (inactividad):`, err.message);
        }
      }
    } catch (err) { console.error('❌ Error en job inactividad:', err.message); }
  }), CRON_OPTS);

  // ═══════ RENOVACIÓN ═══════

  // Diario 09:30 (Asunción) — Tag renovación pendiente a 7 días del vencimiento
  cron.schedule('30 9 * * *', withLock('renewal-tag', async () => {
    try {
      const ArizarSync = require('../services/arizarSync');
      const sync = new ArizarSync(prisma);

      const startOfDay = startOfAsuncionDay(7);
      const endOfDay = endOfAsuncionDay(7);

      const expiring = await prisma.membership.findMany({
        where: { status: 'ACTIVE', endDate: { gte: startOfDay, lte: endOfDay } },
        include: { user: true },
      });

      for (const m of expiring) {
        try {
          if (m.user.arizarContactId) {
            await sync.syncRenewalReminder(m.user, m);
          }
        } catch (err) {
          console.error(`Error procesando miembro ${m.userId} (tag renovación):`, err.message);
        }
      }
      if (expiring.length) console.log(`📋 ${expiring.length} contactos marcados para renovación`);
    } catch (err) { console.error('❌ Error en job renovación:', err.message); }
  }), CRON_OPTS);

  // ═══════ AUTO-RENOVACIÓN ═══════

  // Diario 07:00 (Asunción) — Cobrar automáticamente membresías con autoRenew=true.
  // CATCH-UP: se procesan TODAS las que ya vencieron y siguen ACTIVE (endDate <= fin
  // de hoy), no solo las que vencen literalmente hoy. Si el job falló o el server
  // estuvo caído, esas membresías lapsarían en silencio sin cobrar. La idempotencia
  // (no recobrar la misma) la garantiza renewMembership() vía el chequeo priorOp.
  cron.schedule('0 7 * * *', withLock('auto-renewal', async () => {
    try {
      const ArizarSync = require('../services/arizarSync');
      const sync = new ArizarSync(prisma);

      const todayEnd = endOfAsuncionDay(0);

      const expiring = await prisma.membership.findMany({
        where: {
          status:    'ACTIVE',
          autoRenew: true,
          endDate:   { lte: todayEnd },
        },
        include: {
          plan: true,
          user: true,
        },
      });

      console.log(`🔄 Auto-renovación: ${expiring.length} membresía(s) por procesar`);

      for (const membership of expiring) {
        const { user, plan } = membership;

        try {
          // ─ Intentar el cobro con Bancard ──────────────────────────
          const result = await renewMembership(prisma, membership);

          if (result.success) {
            // ✔ Cobro exitoso
            const { newStart, newEnd } = result;

            // Buscar tarjeta primaria para mostrar últimos 4 dígitos en el mensaje
            const primaryCard = await prisma.paymentCard.findFirst({
              where: { userId: user.id, isPrimary: true },
            });

            // WhatsApp de confirmación
            if (user.arizarContactId) {
              try {
                await arizarService.sendWhatsApp(user.arizarContactId,
                  `✅ *¡Tu membresía fue renovada automáticamente!*\n\n` +
                  `📋 Plan: ${plan.name}\n` +
                  `📅 Nueva vigencia: ${newStart.toLocaleDateString('es-PY')} al ${newEnd.toLocaleDateString('es-PY')}\n` +
                  `💳 Cobrado: ₲${plan.priceGs.toLocaleString()} a tu tarjeta **** ${primaryCard?.maskedNumber?.slice(-4) || ''}\n\n` +
                  `🚗💎 ¡Seguís disfrutando de Luxury Garage!\n` +
                  `Agendá tu próximo turno: https://luxurygarage.arizar-ia.cloud/client/book`
                );
              } catch (e) { console.error('Error enviando WA confirmación renovación:', e.message); }
              // Sync a ARIZAR IA
              try {
                await sync.syncMembershipActivated(user, { ...membership, plan, endDate: newEnd, startDate: newStart });
              } catch (e) { console.error('Error sync ARIZAR renovación:', e.message); }
            }

            // Comprobante por correo del cobro — va SIEMPRE, tenga o no CRM/teléfono.
            emailService.sendRenewalOk(user, {
              planName: plan.name,
              amountGs: plan.priceGs,
              endDate: newEnd,
              cardLast4: primaryCard?.maskedNumber?.slice(-4) || null,
            }).catch(() => {});

            const emailRedactedOk = user.email ? user.email.substring(0, 3) + '***@***' : 'unknown';
            console.log(`✅ Auto-renovación OK: ${emailRedactedOk} → ${plan.name} hasta ${newEnd.toLocaleDateString()}`);

          } else {
            // ❌ Cobro fallido o sin tarjeta/usuario Bancard
            const reason = result.reason;
            const noCard = reason === 'no_card' || reason === 'no_bancard_user' || reason === 'card_not_found_in_bancard';

            // Casos que NO deben notificar "cobro rechazado" al cliente:
            //  • already_renewed / renewal_in_progress → idempotencia (otra corrida ya actuó).
            //  • renewal_tx_failed_after_charge → YA se cobró; queda en reconciliación
            //    manual (no decirle al cliente que el cobro falló ni mandarlo a re-pagar).
            const silentReasons = ['already_renewed', 'renewal_in_progress', 'renewal_tx_failed_after_charge', 'renewal_needs_reconciliation'];
            if (silentReasons.includes(reason)) {
              const emailRedactedSilent = user.email ? user.email.substring(0, 3) + '***@***' : 'unknown';
              console.warn(`ℹ️ Auto-renovación sin notificar (${reason}): ${emailRedactedSilent}`);
              continue;
            }

            if (user.arizarContactId) {
              try {
                if (noCard) {
                  await arizarService.sendWhatsApp(user.arizarContactId,
                    `⚠️ ${user.firstName}, tu membresía *${plan.name}* vence hoy y no pudimos renovarla porque no tenés una tarjeta registrada.\n\n` +
                    `💳 Registá tu tarjeta y renová acá:\nhttps://luxurygarage.arizar-ia.cloud/client/membership\n\n` +
                    `¿Necesitás ayuda? Respondé este mensaje.`
                  );
                } else {
                  await arizarService.sendWhatsApp(user.arizarContactId,
                    `❌ ${user.firstName}, no pudimos renovar tu membresía *${plan.name}* hoy.\n\n` +
                    `El cobro a tu tarjeta no fue aprobado.\n\n` +
                    `Para no perder tu membresía, renová manualmente acá:\n` +
                    `https://luxurygarage.arizar-ia.cloud/client/membership\n\n` +
                    `¿Necesitás ayuda? Respondé este mensaje. 🙏`
                  );
                }
              } catch (e) { console.error('Error enviando WA fallo renovación:', e.message); }
            }

            // Aviso por correo del cobro fallido — el cliente tiene que enterarse sí o sí.
            emailService.sendRenewalFailed(user, { planName: plan.name, noCard }).catch(() => {});

            const emailRedactedFail = user.email ? user.email.substring(0, 3) + '***@***' : 'unknown';
            console.error(`❌ Auto-renovación fallida (${reason}): ${emailRedactedFail}`);
          }

        } catch (err) {
          const emailRedactedErr = user.email ? user.email.substring(0, 3) + '***@***' : 'unknown';
          console.error(`❌ Error auto-renovación ${emailRedactedErr}:`, err.message);
          // Aún así notificar al usuario para que renueve manual
          if (user.arizarContactId) {
            try {
              await arizarService.sendWhatsApp(user.arizarContactId,
                `⚠️ Hubo un problema procesando la renovación de tu membresía *${plan.name}*.\n` +
                `Por favor renová manualmente: https://luxurygarage.arizar-ia.cloud/client/membership`
              );
            } catch (e) { /* silent */ }
          }
        }
      }
    } catch (err) {
      console.error('❌ Error en job auto-renovación:', err.message);
    }
  }), CRON_OPTS);

  console.log('✅ Cron jobs inicializados');
}

module.exports = { initJobs };


