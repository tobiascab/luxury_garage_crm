const pushService = require('./pushService');

/**
 * Catálogo de TIPOS de notificación de Luxury Garage.
 * El front mapea cada `type` a un ícono/color; mantener sincronizado con
 * frontend/src/luxury-design/lib/notificationTypes.ts
 */
const NOTIFICATION_TYPES = {
  WASH_DONE: 'wash_done',          // Lavado registrado/terminado
  APPOINTMENT: 'appointment',       // Turno próximo / confirmado
  PAYMENT: 'payment',               // Pago / recarga acreditada
  MEMBERSHIP: 'membership',         // Estado / vencimiento de membresía
  REFERRAL: 'referral',             // Bono por referido
  PROMO: 'promo',                   // Promoción / novedad
  WALLET_LOW: 'wallet_low',         // Saldo bajo
  INFO: 'info',                     // Genérica
  SUCCESS: 'success',
  ALERT: 'alert',
};

/**
 * Crea una notificación: la persiste en la tabla `notifications` (para el panel
 * in-app) y, best-effort, dispara una push a los dispositivos del usuario.
 *
 * @param {*} prisma  instancia de Prisma (req.prisma o el singleton)
 * @param {object} opts { userId, type, title, message, referenceId?, url?, push? }
 */
async function createNotification(prisma, {
  userId,
  type = NOTIFICATION_TYPES.INFO,
  title,
  message,
  referenceId = null,
  url = '/',
  push = true,
}) {
  if (!userId || !title || !message) {
    throw new Error('createNotification: userId, title y message son obligatorios');
  }

  const notif = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      referenceId,
      channel: push ? 'push' : 'app',
      sentAt: new Date(),
    },
  });

  if (push) {
    // Best-effort: nunca bloquea ni rompe el flujo principal si el push falla.
    pushService
      .sendToUser(prisma, userId, { title, body: message, type, url, tag: notif.id })
      .catch((e) => console.error('[notif] push falló:', e.message));
  }

  return notif;
}

module.exports = { createNotification, NOTIFICATION_TYPES };
