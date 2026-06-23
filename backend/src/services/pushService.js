const webpush = require('web-push');

/**
 * Push Service — Web Push (VAPID) para notificaciones del navegador/celular.
 * ------------------------------------------------------------------
 * Convenciones (mismo patrón que bancardService.js):
 *  - Singleton: `module.exports = new PushService()`.
 *  - Env vars leídas SOLO en el constructor.
 *  - Si faltan las claves VAPID, el servicio queda "no configurado" y
 *    todos los envíos son no-op (la app sigue funcionando sin push).
 *
 * El prisma client se recibe por parámetro (igual que el resto de helpers),
 * para poder enviar tanto desde un request como desde jobs/webhooks.
 */
class PushService {
  constructor() {
    this.publicKey = process.env.VAPID_PUBLIC_KEY;
    this.privateKey = process.env.VAPID_PRIVATE_KEY;
    this.subject = process.env.VAPID_SUBJECT || 'mailto:soporte@luxurygarage.com.py';
    this.configured = !!(this.publicKey && this.privateKey);

    if (this.configured) {
      try {
        webpush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
      } catch (err) {
        console.error('[push] Claves VAPID inválidas:', err.message);
        this.configured = false;
      }
    } else {
      console.warn('[push] VAPID no configurado — las notificaciones push quedan deshabilitadas');
    }
  }

  isConfigured() {
    return this.configured;
  }

  getPublicKey() {
    return this.publicKey || null;
  }

  /**
   * Envía una notificación push a TODOS los dispositivos suscritos de un usuario.
   * Limpia automáticamente las suscripciones muertas (404/410).
   * @returns {Promise<{ sent: number, skipped?: boolean }>}
   */
  async sendToUser(prisma, userId, payload) {
    if (!this.configured) return { sent: 0, skipped: true };

    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (!subs.length) return { sent: 0 };

    const body = JSON.stringify(payload);
    let sent = 0;

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
          sent++;
        } catch (err) {
          // 404 (Not Found) / 410 (Gone) → suscripción expirada: la eliminamos.
          if (err.statusCode === 404 || err.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          } else {
            console.error('[push] Error enviando:', err.statusCode, err.body || err.message);
          }
        }
      })
    );

    return { sent };
  }
}

module.exports = new PushService();
