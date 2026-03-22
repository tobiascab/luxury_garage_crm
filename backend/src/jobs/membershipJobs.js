const cron = require('node-cron');
const arizarService = require('../services/arizarService');

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
        if (m.user.arizarContactId) {
          try {
            await arizarService.sendWhatsApp(m.user.arizarContactId,
              `⚠️ ${m.user.firstName}, tu membresía ${m.plan.name} vence MAÑANA. Renová ahora para no perder tus beneficios → https://luxurygarage.arizar-ia.cloud/client/membership`
            );
          } catch (e) { console.error('Error enviando aviso 1d:', e.message); }
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
        if (m.user.arizarContactId) {
          try {
            await arizarService.sendWhatsApp(m.user.arizarContactId,
              `🎁 ${m.user.firstName}, te extrañamos! Renová tu membresía ${m.plan.name} HOY con 15% de descuento. Oferta válida por 48hs → https://luxurygarage.arizar-ia.cloud/client/membership`
            );
          } catch (e) { console.error('Error enviando oferta:', e.message); }
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
        if (m.user.arizarContactId) {
          await sync.syncRenewalReminder(m.user, m);
        }
      }
      if (expiring.length) console.log(`📋 ${expiring.length} contactos marcados para renovación`);
    } catch (err) { console.error('❌ Error en job renovación:', err.message); }
  });

  console.log('✅ Cron jobs inicializados');
}

module.exports = { initJobs };

