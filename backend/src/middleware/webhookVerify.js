const crypto = require('crypto');

/**
 * Middleware para verificar la firma de webhooks de ARIZAR IA
 */
function verifyWebhookSignature(req, res, next) {
  const secret = process.env.ARIZAR_WEBHOOK_SECRET;
  
  // Reject if no secret configured
  if (!secret || secret === 'pending_configuration') {
    console.error('❌ Webhook rechazado: ARIZAR_WEBHOOK_SECRET no configurado');
    return res.status(503).json({ success: false, message: 'Webhook no configurado' });
  }

  const signature = req.headers['x-webhook-signature'];
  if (!signature) {
    console.warn('❌ Webhook rechazado: sin header de firma');
    return res.status(401).json({ success: false, message: 'Firma requerida' });
  }

  // ⚠️ LIMITACIÓN CONOCIDA — firma sobre body RE-SERIALIZADO, no sobre el RAW body.
  // El HMAC se calcula sobre JSON.stringify(req.body), que es una RE-serialización del
  // body ya parseado por express.json(), NO los bytes originales recibidos. Si el emisor
  // (ARIZAR/GHL) firma el cuerpo RAW, la verificación puede fallar ante cualquier
  // diferencia de serialización: orden de claves, espacios, escape de unicode, números,
  // etc. La forma correcta es firmar sobre el raw body capturado en el body-parser
  // (p. ej. express.json({ verify: (req, _res, buf) => { req.rawBody = buf } }) y luego
  // .update(req.rawBody)). Eso requiere modificar el montaje del body-parser en index.js,
  // fuera del alcance de este cambio, por lo que se documenta aquí en lugar de aplicarlo
  // a ciegas. NO debilitar la verificación: si se observan fallos con webhooks reales,
  // migrar a raw body en vez de relajar la comprobación.
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  // Comparación en tiempo constante para evitar timing attacks sobre la firma.
  // timingSafeEqual exige buffers de igual longitud; comparamos longitudes primero
  // (la longitud no es secreta) para no lanzar y tratar el mismatch como firma inválida.
  const sigBuf = Buffer.from(String(signature), 'hex');
  const hashBuf = Buffer.from(hash, 'hex');
  const valid = sigBuf.length === hashBuf.length && crypto.timingSafeEqual(sigBuf, hashBuf);

  if (!valid) {
    console.error('❌ Webhook con firma inválida rechazado');
    return res.status(401).json({ success: false, message: 'Firma inválida' });
  }

  next();
}

module.exports = { verifyWebhookSignature };
