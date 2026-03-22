const axios = require('axios');

/**
 * MasFacil Payment Service
 * Procesador de pagos de Paraguay
 * 
 * Endpoints principales:
 * - Generar link de pago
 * - Verificar estado de pago
 * - Cancelar pago pendiente
 */
class MasFacilService {
  constructor() {
    this.baseURL = process.env.MASFACIL_BASE_URL || 'https://api.masfacil.com.py';
    this.apiKey = process.env.MASFACIL_API_KEY;
    this.secret = process.env.MASFACIL_SECRET;
    this.webhookSecret = process.env.MASFACIL_WEBHOOK_SECRET;

    if (this.apiKey && this.apiKey !== 'pending_configuration') {
      this.client = axios.create({
        baseURL: this.baseURL,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });
    }
  }

  isConfigured() {
    return !!(this.apiKey && this.apiKey !== 'pending_configuration');
  }

  /**
   * Safe wrapper — no crashea si MasFacil no está configurado
   */
  async _safe(fn, fallback = null) {
    if (!this.isConfigured()) {
      console.log('⚠️ MasFacil no configurado, operación omitida');
      return fallback;
    }
    try {
      return await fn();
    } catch (err) {
      console.error('❌ MasFacil error:', err.response?.data?.message || err.message);
      return fallback;
    }
  }

  /**
   * Generar link de pago para membresía
   * @param {Object} data - { userId, email, name, amount, planName, planId, description }
   * @returns {Object} { paymentUrl, paymentId }
   */
  async generatePaymentLink(data) {
    return this._safe(async () => {
      const payload = {
        amount: data.amount,
        currency: 'PYG',
        description: data.description || `Membresía ${data.planName} - Luxury Garage`,
        reference: `LG-${data.userId}-${data.planId}-${Date.now()}`,
        customer: {
          email: data.email,
          name: data.name,
        },
        callback_url: 'https://luxurygarage.arizar-ia.cloud/api/masfacil/webhook',
        success_url: 'https://luxurygarage.arizar-ia.cloud/client/membership?payment=success',
        cancel_url: 'https://luxurygarage.arizar-ia.cloud/client/membership?payment=cancelled',
        metadata: {
          userId: data.userId,
          planId: data.planId,
          planName: data.planName,
          source: 'luxury-garage-portal',
        },
      };

      const response = await this.client.post('/payments/create', payload);
      return {
        paymentUrl: response.data?.payment_url || response.data?.url,
        paymentId: response.data?.payment_id || response.data?.id,
        reference: payload.reference,
      };
    });
  }

  /**
   * Verificar estado de un pago
   */
  async checkPaymentStatus(paymentId) {
    return this._safe(async () => {
      const response = await this.client.get(`/payments/${paymentId}/status`);
      return response.data;
    });
  }

  /**
   * Verificar firma del webhook
   */
  verifyWebhookSignature(signature, body) {
    if (!this.webhookSecret) return true; // Skip if no secret
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');
    return signature === hash;
  }
}

module.exports = new MasFacilService();
