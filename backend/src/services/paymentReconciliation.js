const bancardService = require('./bancardService');
const { postPaymentCompleted } = require('./journalService');

/**
 * Convierte un "startTime" local de Paraguay (UTC-4) en {start, end} (Date UTC).
 * Duplicado de appointments.js para que la reconciliación sea autónoma.
 */
function parseLocalRange(startTime, durationMinutes) {
  const localStartTime = startTime.includes('+') || startTime.includes('Z') || /T.*-\d{2}:\d{2}$/.test(startTime)
    ? startTime
    : `${startTime}-04:00`;
  const start = new Date(localStartTime);
  const end = new Date(start.getTime() + (durationMinutes || 60) * 60000);
  return { start, end };
}

/**
 * Materializa el EFECTO de un pago Bancard (membresía / recarga de billetera / turno) de forma
 * IDEMPOTENTE, derivando todo del `BancardOperation` persistido (metadataJson) y verificando el
 * estado REAL con get_confirmation (server-to-server, firmado con nuestra private key).
 *
 * Es la RED DE SEGURIDAD para que un pago APROBADO siempre entregue su valor, aunque el frontend
 * nunca haya llamado al `*-3ds-complete` (navegador cerrado, red caída, etc.). La usan el webhook
 * `/confirm` y el job de reconciliación.
 *
 * Idempotencia: la materialización corre dentro de una transacción que toma un lock de la fila del
 * usuario (`SELECT ... FOR UPDATE`) y RE-VERIFICA que la operación no esté ya COMPLETED. Si el
 * `*-3ds-complete` (que también toma el mismo lock) ya la completó, esta función no duplica nada.
 *
 * @returns {Promise<{status:'completed'|'failed'|'pending'|'noop', reason?:string, kind?:string}>}
 */
async function materializeApprovedPayment(prisma, shopProcessId) {
  const sp = Number(shopProcessId);
  if (!Number.isFinite(sp)) return { status: 'noop', reason: 'bad_sp' };

  const op = await prisma.bancardOperation.findUnique({ where: { shopProcessId: sp } });
  if (!op || op.type !== 'charge') return { status: 'noop', reason: 'not_charge_op' };
  if (op.status === 'COMPLETED') return { status: 'noop', reason: 'already_completed' };
  if (op.status === 'FAILED') return { status: 'noop', reason: 'already_failed' };

  // Estado REAL desde Bancard (la fuente de verdad, no el payload del webhook).
  let confirmation;
  try {
    confirmation = await bancardService.getConfirmation(sp);
  } catch (e) {
    // No determinable aún (timeout / el pago todavía no existe en Bancard) → dejar PENDING y
    // reintentar luego (el job de reconciliación lo vuelve a tomar). NUNCA marcar FAILED a ciegas.
    return { status: 'pending', reason: 'confirmation_unavailable' };
  }

  const approved = confirmation?.response === 'S' && String(confirmation?.response_code) === '00';
  const meta = op.metadataJson || {};

  // Rechazado → marcar FAILED (idempotente; nunca toca filas ya COMPLETED).
  if (!approved) {
    await prisma.$transaction(async (tx) => {
      await tx.bancardOperation.updateMany({ where: { shopProcessId: sp, status: { not: 'COMPLETED' } }, data: { status: 'FAILED' } });
      await tx.payment.updateMany({ where: { bancardShopProcessId: sp, status: { not: 'COMPLETED' } }, data: { status: 'FAILED' } });
    });
    return { status: 'failed', reason: 'declined' };
  }

  // SEGURIDAD: el monto cobrado debe coincidir con el persistido (anti "pagar ₲1 por plan caro").
  const expectedAmount = op.amountGs ?? meta.amountGs ?? meta.appointmentDraft?.totalPriceGs ?? null;
  const confirmedAmount = Math.round(parseFloat(confirmation.amount));
  if (expectedAmount != null && (!Number.isFinite(confirmedAmount) || confirmedAmount !== Number(expectedAmount))) {
    await prisma.$transaction(async (tx) => {
      await tx.bancardOperation.updateMany({ where: { shopProcessId: sp, status: { not: 'COMPLETED' } }, data: { status: 'FAILED' } });
      await tx.payment.updateMany({
        where: { bancardShopProcessId: sp, status: { not: 'COMPLETED' } },
        data: { status: 'FAILED', description: `Monto no coincide (cobrado ${confirmation.amount}, esperado ${expectedAmount})` },
      });
    });
    return { status: 'failed', reason: 'amount_mismatch' };
  }

  // Reserva con slot AGOTADO durante el 3DS: el pago se capturó pero el horario se llenó (el
  // 3ds-complete dejó slotTaken:true y el Payment COMPLETED con nota de reembolso). NO materializar
  // la cita (sería overbooking): la dejamos en NEEDS_RECONCILIATION para reembolso manual.
  if (meta.slotTaken) {
    await prisma.bancardOperation.updateMany({
      where: { shopProcessId: sp, status: { not: 'COMPLETED' } },
      data: { status: 'NEEDS_RECONCILIATION' },
    });
    return { status: 'noop', reason: 'slot_taken_needs_refund' };
  }

  const ticketNumber = confirmation.ticket_number ? String(confirmation.ticket_number) : null;
  const authNumber = confirmation.authorization_number ? String(confirmation.authorization_number) : null;

  const result = await prisma.$transaction(async (tx) => {
    // Lock de la fila del usuario: serializa con el *-3ds-complete y con otra materialización
    // concurrente del mismo usuario. Tras el lock, re-verificar el estado (idempotencia real).
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${op.userId} FOR UPDATE`;
    const fresh = await tx.bancardOperation.findUnique({ where: { shopProcessId: sp } });
    if (!fresh || fresh.status === 'COMPLETED') return { status: 'noop', reason: 'race_completed' };
    if (fresh.status === 'FAILED') return { status: 'noop', reason: 'race_failed' };

    const existingPayment = await tx.payment.findUnique({ where: { bancardShopProcessId: sp } });
    const isTopup = meta.kind === 'topup';
    const isAppointment = meta.kind === 'appointment';
    const isMembership = !!meta.planId && !isTopup && !isAppointment;
    let kind = 'unknown';

    if (isMembership) {
      kind = 'membership';
      const plan = await tx.plan.findUnique({ where: { id: meta.planId } });
      if (!plan) throw new Error('plan_not_found');
      const startD = new Date();
      const endD = new Date(); endD.setMonth(endD.getMonth() + 1);
      await tx.membership.updateMany({ where: { userId: op.userId, status: 'ACTIVE' }, data: { status: 'REPLACED' } });
      const membership = await tx.membership.create({
        data: { userId: op.userId, planId: plan.id, status: 'ACTIVE', startDate: startD, endDate: endD, autoRenew: true },
      });
      if (existingPayment) {
        await tx.payment.update({ where: { id: existingPayment.id }, data: { status: 'COMPLETED', membershipId: membership.id, bancardTicketNumber: ticketNumber, bancardAuthNumber: authNumber } });
      } else {
        await tx.payment.create({ data: { userId: op.userId, amountGs: plan.priceGs, paymentMethod: 'bancard_card', bancardShopProcessId: sp, status: 'COMPLETED', membershipId: membership.id, bancardTicketNumber: ticketNumber, bancardAuthNumber: authNumber, description: `Membresía ${plan.name}` } });
      }
    } else if (isTopup) {
      kind = 'topup';
      const amt = Number(meta.amountGs ?? op.amountGs);
      await tx.credit.create({ data: { userId: op.userId, amount: amt, type: 'WALLET_TOPUP', description: 'Recarga de billetera' } });
      if (existingPayment) {
        await tx.payment.update({ where: { id: existingPayment.id }, data: { status: 'COMPLETED', bancardTicketNumber: ticketNumber, bancardAuthNumber: authNumber } });
      } else {
        await tx.payment.create({ data: { userId: op.userId, amountGs: amt, paymentMethod: 'bancard_card', bancardShopProcessId: sp, status: 'COMPLETED', bancardTicketNumber: ticketNumber, bancardAuthNumber: authNumber, description: 'Recarga de billetera' } });
      }
    } else if (isAppointment && meta.appointmentDraft) {
      kind = 'appointment';
      const d = meta.appointmentDraft;
      const service = await tx.service.findUnique({ where: { id: d.serviceId } });
      const { start, end } = parseLocalRange(d.startTime, service?.durationMinutes || 60);
      // Re-validar disponibilidad del slot (pudo llenarse entre el draft y la reconciliación):
      // si excede la capacidad de bahías, NO crear la cita (overbooking) → dejar para reembolso.
      let baysCount = 3;
      try {
        const row = await tx.setting.findUnique({ where: { key: 'bays_count' } });
        const n = Math.trunc(Number(row?.value));
        if (Number.isFinite(n) && n >= 1) baysCount = n;
      } catch (e) { /* fallback 3 */ }
      const overlapping = await tx.appointment.count({
        where: { status: { not: 'CANCELLED' }, startTime: { lt: end }, endTime: { gt: start } },
      });
      if (overlapping >= baysCount) {
        await tx.payment.updateMany({
          where: { bancardShopProcessId: sp, status: { not: 'COMPLETED' } },
          data: { status: 'COMPLETED', description: 'Turno no disponible (slot lleno) — requiere reembolso' },
        });
        await tx.bancardOperation.update({ where: { shopProcessId: sp }, data: { status: 'NEEDS_RECONCILIATION', metadataJson: { ...meta, slotTaken: true } } });
        return { status: 'noop', reason: 'slot_taken_needs_refund' };
      }
      const appointment = await tx.appointment.create({
        data: {
          userId: op.userId, vehicleId: d.vehicleId, serviceId: d.serviceId,
          date: new Date(d.date), startTime: start, endTime: end,
          status: 'CONFIRMED', notes: d.notes || null,
          vehicleSize: d.vehicleSize || null, selectedAddons: d.selectedAddons || null,
          totalPriceGs: d.totalPriceGs, coveredByMembership: d.coveredByMembership, billingMode: d.billingMode,
        },
      });
      if (existingPayment) {
        await tx.payment.update({ where: { id: existingPayment.id }, data: { status: 'COMPLETED', bancardTicketNumber: ticketNumber, bancardAuthNumber: authNumber } });
      } else {
        await tx.payment.create({ data: { userId: op.userId, amountGs: d.totalPriceGs, paymentMethod: 'bancard_card', bancardShopProcessId: sp, status: 'COMPLETED', bancardTicketNumber: ticketNumber, bancardAuthNumber: authNumber, description: `appointment:${service?.slug || ''}` } });
      }
      meta.appointmentId = appointment.id;
    } else if (existingPayment) {
      // Tipo desconocido: completar el pago pero NO entregar valor que no sabemos materializar.
      await tx.payment.update({ where: { id: existingPayment.id }, data: { status: 'COMPLETED', bancardTicketNumber: ticketNumber, bancardAuthNumber: authNumber } });
    }

    await tx.bancardOperation.update({ where: { shopProcessId: sp }, data: { status: 'COMPLETED', metadataJson: { ...meta, materializedBy: 'reconciliation' } } });
    return { status: 'completed', kind };
  });

  // Asiento contable (best-effort, POST-COMMIT, FUERA de la $transaction) para membership/topup/appointment.
  if (result?.status === 'completed') {
    try {
      const payment = await prisma.payment.findUnique({ where: { bancardShopProcessId: sp } });
      if (payment?.id) await postPaymentCompleted(prisma, payment.id);
    } catch (e) {
      console.error(`[Reconciliación] asiento contable falló sp=${sp}:`, e?.message || e);
    }
  }

  return result;
}

/**
 * Reconcilia operaciones de cobro Bancard que quedaron PENDING (frontend que no completó,
 * timeout de red, webhook perdido). Las que tengan cierta antigüedad se re-consultan en Bancard
 * y se materializan o marcan FAILED según el estado real. Idempotente y seguro de correr seguido.
 *
 * @param {number} olderThanMs  Solo reconcilia operaciones creadas hace más de este tiempo.
 */
async function reconcilePendingCharges(prisma, olderThanMs = 2 * 60 * 1000) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const pending = await prisma.bancardOperation.findMany({
    where: { type: 'charge', status: 'PENDING', createdAt: { lt: cutoff } },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });
  const summary = { checked: pending.length, completed: 0, failed: 0, stillPending: 0 };
  for (const op of pending) {
    try {
      const r = await materializeApprovedPayment(prisma, op.shopProcessId);
      if (r.status === 'completed') summary.completed++;
      else if (r.status === 'failed') summary.failed++;
      else if (r.status === 'pending') summary.stillPending++;
    } catch (e) {
      console.error(`[Reconciliación] Error en shop_process_id=${op.shopProcessId}:`, e.message);
    }
  }
  if (summary.completed || summary.failed) {
    console.log(`[Reconciliación] ${JSON.stringify(summary)}`);
  }
  return summary;
}

module.exports = { materializeApprovedPayment, reconcilePendingCharges };
