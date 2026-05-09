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

  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== hash) {
    console.error('❌ Webhook con firma inválida rechazado');
    return res.status(401).json({ success: false, message: 'Firma inválida' });
  }

  next();
}

module.exports = { verifyWebhookSignature };
