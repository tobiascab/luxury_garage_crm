const crypto = require('crypto');

/**
 * Verificación de firma de webhooks de ARIZAR IA / GoHighLevel.
 *
 * GHL firma el RAW body (los bytes originales, NO el JSON re-serializado). Por eso
 * index.js captura `req.rawBody` en el verify callback de express.json(). Soportamos
 * tres esquemas, en orden de preferencia:
 *
 *   1. `x-ghl-signature`     → Ed25519 sobre raw body   (esquema ACTUAL de GHL)
 *   2. `x-wh-signature`      → RSA-SHA256 sobre raw body (LEGACY de GHL, se apaga 2026-07-01)
 *   3. `x-webhook-signature` → HMAC-SHA256 con ARIZAR_WEBHOOK_SECRET sobre raw body
 *                              (webhooks disparados desde workflows custom de GHL)
 *
 * Las claves públicas de GHL se cargan por env var (copialas de la doc oficial en vivo,
 * NO de una transcripción: un solo carácter mal y toda verificación falla):
 *   ARIZAR_WEBHOOK_ED25519_PUBLIC_KEY  (PEM)
 *   ARIZAR_WEBHOOK_RSA_PUBLIC_KEY      (PEM, legacy)
 */

const ED25519_PUBLIC_KEY = process.env.ARIZAR_WEBHOOK_ED25519_PUBLIC_KEY;
const RSA_PUBLIC_KEY = process.env.ARIZAR_WEBHOOK_RSA_PUBLIC_KEY;

function reject(res, msg) {
  console.error(`❌ Webhook rechazado: ${msg}`);
  return res.status(401).json({ success: false, message: 'Firma inválida' });
}

function verifyWebhookSignature(req, res, next) {
  const raw = req.rawBody;
  if (!raw || !raw.length) {
    console.error('❌ Webhook sin rawBody — revisar el verify callback de express.json en index.js');
    return res.status(500).json({ success: false, message: 'rawBody no disponible' });
  }

  // 1) GHL Ed25519 (preferido)
  const ghlSig = req.headers['x-ghl-signature'];
  if (ghlSig) {
    if (!ED25519_PUBLIC_KEY) return reject(res, 'x-ghl-signature presente pero falta ARIZAR_WEBHOOK_ED25519_PUBLIC_KEY');
    try {
      const ok = crypto.verify(null, raw, ED25519_PUBLIC_KEY, Buffer.from(String(ghlSig), 'base64'));
      return ok ? next() : reject(res, 'Ed25519 inválida');
    } catch (e) {
      return reject(res, `Ed25519 error: ${e.message}`);
    }
  }

  // 2) GHL RSA legacy
  const whSig = req.headers['x-wh-signature'];
  if (whSig) {
    if (!RSA_PUBLIC_KEY) return reject(res, 'x-wh-signature presente pero falta ARIZAR_WEBHOOK_RSA_PUBLIC_KEY');
    try {
      const v = crypto.createVerify('SHA256');
      v.update(raw);
      return v.verify(RSA_PUBLIC_KEY, String(whSig), 'base64') ? next() : reject(res, 'RSA inválida');
    } catch (e) {
      return reject(res, `RSA error: ${e.message}`);
    }
  }

  // 3) HMAC propio (workflows custom de GHL con ARIZAR_WEBHOOK_SECRET)
  const secret = process.env.ARIZAR_WEBHOOK_SECRET;
  const hmacSig = req.headers['x-webhook-signature'];
  if (hmacSig) {
    if (!secret || secret === 'pending_configuration') return reject(res, 'x-webhook-signature presente pero falta ARIZAR_WEBHOOK_SECRET');
    const hash = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(String(hmacSig), 'hex');
    const b = Buffer.from(hash, 'hex');
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
    return valid ? next() : reject(res, 'HMAC inválido');
  }

  console.warn('❌ Webhook rechazado: sin header de firma reconocido (x-ghl-signature / x-wh-signature / x-webhook-signature)');
  return res.status(401).json({ success: false, message: 'Firma requerida' });
}

module.exports = { verifyWebhookSignature };
