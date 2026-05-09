const cron = require('node-cron');
const arizarService = require('../services/arizarService');

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

  // 3. Generar shop_process_id y obtener plan
  const shopProcessId = bancardService.generateShopProcessId();
  const plan = await prisma.plan.findUnique({ where: { id: membership.planId } });

  // 4. Crear BancardOperation y Payment PENDING antes de cobrar
  await prisma.bancardOperation.create({
    data: {
      shopProcessId,
      userId: user.id,
      type: 'charge',
      status: 'PENDING',
      amountGs: plan.priceGs,
      metadataJson: { membershipId: membership.id, planId: plan.id, isAutoRenewal: true },
    },
  });

  const pendingPayment = await prisma.payment.create({
    data: {
      userId: user.id,
      amountGs: plan.priceGs,
      paymentMethod: 'bancard_card',
      bancardShopProcessId: shopProcessId,
      status: 'PENDING',
      description: `Auto-renovación ${plan.name} - Luxury Garage`,
    },
  });

  // 5. Cobrar con Bancard
  let chargeResult;
  try {
    chargeResult = await bancardService.charge({
      shopProcessId,
      amount: plan.priceGs,
      aliasToken,
      description: `Renovacion ${plan.name}`,
      returnUrl: `${process.env.FRONTEND_URL || 'https://luxurygarage.arizar-ia.cloud'}/billetera`,
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

  // 6. Cobro exitoso → renovar membresía en $transaction
  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);

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
      },
    });

    await tx.bancardOperation.update({
      where: { shopProcessId },
      data: { status: 'COMPLETED' },
    });
  });

  return { success: true, shopProcessId, ticketNumber: chargeResult.ticketNumber, newStart: start, newEnd: end, plan };
}

function initJobs(prisma) {
  console.log('⏰ Inicializando cron jobs...');

  // ═══════ MEMBRESÍAS ═══════

  // Diario 08:00 — Avisar membresías que vencen en 7 días
  cron.schedule('0 8 * * *', async () => {
    try {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const startOfDay = new Date(sevenDaysFromNow); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(sevenDaysFromNow); endOfDay.setHours(23, 59, 59, 999);

      const expiring = await prisma.membership.findMany({
        where: { status: 'ACTIVE', endDate: { gte: startOfDay, lte: endOfDay } },
        include: { user: true, plan: true },
      });

      for (const m of expiring) {
        try {
          if (m.user.arizarContactId) {
            try {
              await arizarService.sendWhatsApp(m.user.arizarContactId,
                `🚗 Hola ${m.user.firstName}! Tu membresía ${m.plan.name} de Luxury Garage vence en 7 días (${m.endDate.toLocaleDateString('es-PY')}). Renová para seguir disfrutando tus beneficios. 💎`
              );
            } catch (e) { console.error('Error enviando aviso 7d:', e.message); }
          }
          await prisma.notification.create({
            data: { userId: m.userId, type: 'RENEWAL_REMINDER', title: 'Tu membresía vence pronto', message: `Tu plan ${m.plan.name} vence el ${m.endDate.toLocaleDateString('es-PY')}. ¡Renová ahora!`, channel: 'WHATSAPP' }
          });
        } catch (err) {
          console.error(`Error procesando miembro ${m.userId} (aviso 7d):`, err.message);
        }
      }
      if (expiring.length) console.log(`📨 Enviados ${expiring.length} avisos de vencimiento (7 días)`);
    } catch (err) { console.error('❌ Error en job vencimiento 7d:', err.message); }
  });

  // Diario 08:00 — Avisar membresías que vencen mañana
  cron.schedule('0 8 * * *', async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startOfDay = new Date(tomorrow); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(tomorrow); endOfDay.setHours(23, 59, 59, 999);

      const expiring = await prisma.membership.findMany({
        where: { status: 'ACTIVE', endDate: { gte: startOfDay, lte: endOfDay } },
        include: { user: true, plan: true },
      });

      for (const m of expiring) {
        try {
          if (m.user.arizarContactId) {
            try {
              await arizarService.sendWhatsApp(m.user.arizarContactId,
                `⚠️ ${m.user.firstName}, tu membresía ${m.plan.name} vence MAÑANA. Renová ahora para no perder tus beneficios → https://luxurygarage.arizar-ia.cloud/client/membership`
              );
            } catch (e) { console.error('Error enviando aviso 1d:', e.message); }
          }
        } catch (err) {
          console.error(`Error procesando miembro ${m.userId} (aviso 1d):`, err.message);
        }
      }
      if (expiring.length) console.log(`📨 Enviados ${expiring.length} avisos urgentes (1 día)`);
    } catch (err) { console.error('❌ Error en job vencimiento 1d:', err.message); }
  });

  // Diario 00:01 — Expirar membresías vencidas
  cron.schedule('1 0 * * *', async () => {
    try {
      const now = new Date();
      const expired = await prisma.membership.updateMany({
        where: { status: 'ACTIVE', endDate: { lt: now } },
        data: { status: 'EXPIRED' },
      });
      if (expired.count) console.log(`🔴 ${expired.count} membresías expiradas`);
    } catch (err) { console.error('❌ Error en job expiración:', err.message); }
  });

  // Diario 10:00 — Oferta a 3 días post-vencimiento
  cron.schedule('0 10 * * *', async () => {
    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const startOfDay = new Date(threeDaysAgo); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(threeDaysAgo); endOfDay.setHours(23, 59, 59, 999);

      const lapsed = await prisma.membership.findMany({
        where: { status: 'EXPIRED', endDate: { gte: startOfDay, lte: endOfDay } },
        include: { user: true, plan: true },
      });

      for (const m of lapsed) {
        try {
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
      if (lapsed.length) console.log(`🎁 Enviadas ${lapsed.length} ofertas de re-enganche`);
    } catch (err) { console.error('❌ Error en job oferta 3d:', err.message); }
  });

  // ═══════ TURNOS ═══════

  // Cada hora — Recordatorio turnos de mañana
  cron.schedule('0 * * * *', async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startOfDay = new Date(tomorrow); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(tomorrow); endOfDay.setHours(23, 59, 59, 999);
      const now = new Date();

      // Solo enviar entre 8:00-20:00
      if (now.getHours() < 8 || now.getHours() > 20) return;

      const appointments = await prisma.appointment.findMany({
        where: { status: 'CONFIRMED', startTime: { gte: startOfDay, lte: endOfDay } },
        include: { user: true, service: true, vehicle: true },
      });

      for (const a of appointments) {
        try {
          // Check if reminder already sent
          const alreadySent = await prisma.notification.findFirst({
            where: { userId: a.userId, type: 'APPOINTMENT_REMINDER', referenceId: a.id,
              createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }
          });
          if (alreadySent) continue;

          const time = a.startTime.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
          if (a.user.arizarContactId) {
            try {
              await arizarService.sendWhatsApp(a.user.arizarContactId,
                `📅 Recordatorio: Mañana tenés turno en Luxury Garage a las ${time}. Servicio: ${a.service.name}. Vehículo: ${a.vehicle.brand} ${a.vehicle.model}. ¡Te esperamos! 🚗`
              );
            } catch (e) { console.error('Error enviando recordatorio:', e.message); }
          }
          await prisma.notification.create({
            data: { userId: a.userId, type: 'APPOINTMENT_REMINDER', title: 'Turno mañana', message: `Mañana a las ${time} - ${a.service.name}`, referenceId: a.id, channel: 'WHATSAPP' }
          });
        } catch (err) {
          console.error(`Error procesando turno ${a.id} (recordatorio):`, err.message);
        }
      }
    } catch (err) { console.error('❌ Error en job recordatorio turnos:', err.message); }
  });

  // ═══════ INACTIVIDAD ═══════

  // Diario 09:00 — Detectar clientes inactivos y sync a ARIZAR IA
  cron.schedule('0 9 * * *', async () => {
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
  });

  // ═══════ RENOVACIÓN ═══════

  // Diario 09:30 — Tag renovación pendiente a 7 días del vencimiento
  cron.schedule('30 9 * * *', async () => {
    try {
      const ArizarSync = require('../services/arizarSync');
      const sync = new ArizarSync(prisma);

      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const startOfDay = new Date(sevenDaysFromNow); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(sevenDaysFromNow); endOfDay.setHours(23, 59, 59, 999);

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
  });

  // ═══════ AUTO-RENOVACIÓN ═══════

  // Diario 07:00 — Cobrar automáticamente membresías con autoRenew=true que vencen hoy
  cron.schedule('0 7 * * *', async () => {
    try {
      const ArizarSync = require('../services/arizarSync');
      const sync = new ArizarSync(prisma);

      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

      const expiring = await prisma.membership.findMany({
        where: {
          status:    'ACTIVE',
          autoRenew: true,
          endDate:   { gte: todayStart, lte: todayEnd },
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
          // Modo test: extender sin cobrar
          if (user.isTestMode) {
            const newEnd = new Date(membership.endDate);
            newEnd.setMonth(newEnd.getMonth() + 1);
            await prisma.membership.update({
              where: { id: membership.id },
              data: { endDate: newEnd, startDate: new Date(membership.endDate) },
            });
            const emailRedactedTest = user.email ? user.email.substring(0, 3) + '***@***' : 'unknown';
            console.log(`🧪 [TEST] Auto-renovación simulada: ${emailRedactedTest}`);
            continue;
          }

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

            const emailRedactedOk = user.email ? user.email.substring(0, 3) + '***@***' : 'unknown';
            console.log(`✅ Auto-renovación OK: ${emailRedactedOk} → ${plan.name} hasta ${newEnd.toLocaleDateString()}`);

          } else {
            // ❌ Cobro fallido o sin tarjeta/usuario Bancard
            const reason = result.reason;
            const noCard = reason === 'no_card' || reason === 'no_bancard_user' || reason === 'card_not_found_in_bancard';

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
  });

  console.log('✅ Cron jobs inicializados');
}

module.exports = { initJobs };


