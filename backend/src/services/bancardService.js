const crypto = require('crypto');
const axios = require('axios');

class BancardService {
  constructor() {
    this.publicKey = process.env.BANCARD_PUBLIC_KEY;
    this.privateKey = process.env.BANCARD_PRIVATE_KEY;
    this.baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://vpos.infonet.com.py'
      : 'https://vpos.infonet.com.py:8888';
    this.jsLibUrl = process.env.NODE_ENV === 'production'
      ? 'https://vpos.infonet.com.py/checkout/javascript/dist/bancard-checkout-4.0.0.js'
      : 'https://vpos.infonet.com.py:8888/checkout/javascript/dist/bancard-checkout-4.0.0.js';
  }

  isConfigured() {
    return !!(
      this.publicKey && this.publicKey !== 'pending_configuration' &&
      this.privateKey && this.privateKey !== 'pending_configuration'
    );
  }

  _generateToken(...parts) {
    // IDs and strings as-is; callers must pre-format amounts with .toFixed(2)
    const str = parts.map(p => String(p)).join('');
    return crypto.createHash('md5').update(str).digest('hex');
  }

  generateShopProcessId() {
    return Date.now();
  }

  async singleBuy({ shopProcessId, amount, currency = 'PYG', description, returnUrl, cancelUrl }) {
    const amountStr = Number(amount).toFixed(2);
    const token = this._generateToken(this.privateKey, shopProcessId, amountStr, currency);

    try {
      const { data } = await axios.post(`${this.baseUrl}/vpos/api/0.3/single_buy`, {
        public_key: this.publicKey,
        operation: {
          token,
          shop_process_id: shopProcessId,
          amount: amountStr,
          currency,
          additional_data: '', // SOLO para códigos de promoción Bancard (ej: "099VS ORO000045"); vacío = pago normal. NO poner la descripción acá.
          description: description || '',
          return_url: returnUrl,
          cancel_url: cancelUrl
        }
      });

      if (data.status === 'error') {
        const msg = data.messages && data.messages[0] ? data.messages[0].dsc : 'Error desconocido';
        throw new Error('Bancard: ' + msg);
      }

      return {
        processId: data.process_id,
        shopProcessId
      };
    } catch (err) {
      if (err.response) {
        console.error('Bancard singleBuy error:', err.response.status, err.response.data?.messages?.[0]?.dsc);
      }
      if (err.message.startsWith('Bancard:')) throw err;
      throw new Error('Bancard: No se pudo iniciar el pago');
    }
  }

  async registerCard({ cardId, userId, userEmail, userPhone, returnUrl }) {
    const token = this._generateToken(this.privateKey, cardId, userId, 'request_new_card');

    try {
      const { data } = await axios.post(`${this.baseUrl}/vpos/api/0.3/cards/new`, {
        public_key: this.publicKey,
        operation: {
          token,
          card_id: cardId,
          user_id: userId,
          user_mail: userEmail,
          user_cell_phone: userPhone || '0000000000',
          return_url: returnUrl
        }
      });

      if (data.status === 'error') {
        const msg = data.messages && data.messages[0] ? data.messages[0].dsc : 'Error desconocido';
        throw new Error('Bancard: ' + msg);
      }

      return { processId: data.process_id };
    } catch (err) {
      if (err.response) {
        console.error('Bancard registerCard error:', err.response.status, err.response.data?.messages?.[0]?.dsc);
      }
      if (err.message.startsWith('Bancard:')) throw err;
      throw new Error('Bancard: No se pudo registrar la tarjeta');
    }
  }

  async getUserCards(userId) {
    const token = this._generateToken(this.privateKey, userId, 'request_user_cards');

    try {
      const { data } = await axios.post(`${this.baseUrl}/vpos/api/0.3/users/${userId}/cards`, {
        public_key: this.publicKey,
        operation: { token }
      });

      if (data.status !== 'success' || !data.cards || data.cards.length === 0) {
        return [];
      }

      return data.cards.map(c => ({
        alias_token: c.alias_token,
        card_masked_number: c.card_masked_number,
        expiration_date: c.expiration_date,
        card_brand: c.card_brand,
        card_id: c.card_id,
        card_type: c.card_type
      }));
    } catch (err) {
      if (err.response) {
        console.error('Bancard getUserCards error:', err.response.status, err.response.data?.messages?.[0]?.dsc);
      }
      return [];
    }
  }

  async charge({ shopProcessId, amount, currency = 'PYG', description, aliasToken, returnUrl }) {
    const amountStr = Number(amount).toFixed(2);
    const token = this._generateToken(this.privateKey, shopProcessId, 'charge', amountStr, currency, aliasToken);

    try {
      const { data } = await axios.post(`${this.baseUrl}/vpos/api/0.3/charge`, {
        public_key: this.publicKey,
        operation: {
          token,
          shop_process_id: shopProcessId,
          amount: amountStr,
          number_of_payments: 1,
          currency,
          additional_data: '', // SOLO para códigos de promoción Bancard (ej: "099VS ORO000045"); vacío = pago normal. NO poner la descripción acá.
          description: description || '',
          alias_token: aliasToken,
          return_url: returnUrl || ''
          // NOTA: NO enviar `extra_response_attributes: ['confirmation.process_id']`.
          // Bancard aclaró (certificación 2026-07-16) que ese parámetro es EXCLUSIVO de la
          // integración 3DS Token, que Luxury Garage NO usa (pago con token/alias, sin 3DS).
          // Enviarlo hace fallar la certificación de "Pago con Token".
        }
      });

      if (data.status === 'error') {
        const msg = data.messages && data.messages[0] ? data.messages[0].dsc : 'Error desconocido';
        throw new Error('Bancard: ' + msg);
      }

      const confirmation = data.confirmation || {};
      // Bancard devuelve response='S' (request PROCESADO) incluso cuando DENIEGA el cobro
      // (ej. response_code='12' "Transacción denegada"). La aprobación REAL exige AMBOS:
      // response 'S' y response_code '00'. Sin el code, un cobro rechazado se trataría como
      // aprobado → membresía/saldo gratis. Mismo predicado que el webhook y get_confirmation.
      const approved = confirmation.response === 'S' && String(confirmation.response_code) === '00';
      const threeDsProcessId = confirmation.process_id || null;
      const threeDsRequired = !!(
        threeDsProcessId &&
        confirmation.authorization_number == null &&
        confirmation.ticket_number == null
      );

      return {
        approved,
        processId: threeDsProcessId,
        authorizationNumber: confirmation.authorization_number || null,
        ticketNumber: confirmation.ticket_number || null,
        responseCode: confirmation.response_code || null,
        response: confirmation.response || null,
        threeDsRequired
      };
    } catch (err) {
      if (err.response) {
        console.error('Bancard charge error:', err.response.status, err.response.data?.messages?.[0]?.dsc);
      }
      if (err.message.startsWith('Bancard:')) throw err;
      throw new Error('Bancard: No se pudo procesar el cobro');
    }
  }

  async deleteCard(userId, cardToken) {
    const token = this._generateToken(this.privateKey, 'delete_card', userId, cardToken);

    try {
      const { data } = await axios.delete(`${this.baseUrl}/vpos/api/0.3/users/${userId}/cards`, {
        data: {
          public_key: this.publicKey,
          operation: { token, alias_token: cardToken }
        }
      });

      if (data.status === 'error') {
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      if (err.response) {
        console.error('Bancard deleteCard error:', err.response.status, err.response.data?.messages?.[0]?.dsc);
      }
      return { success: false };
    }
  }

  async rollback(shopProcessId) {
    const token = this._generateToken(this.privateKey, shopProcessId, 'rollback', '0.00');

    try {
      const { data } = await axios.post(`${this.baseUrl}/vpos/api/0.3/single_buy/rollback`, {
        public_key: this.publicKey,
        operation: { token, shop_process_id: shopProcessId }
      });

      if (data.status === 'error') {
        const msg = data.messages && data.messages[0] ? data.messages[0].dsc : 'Error desconocido';
        return { success: false, message: msg };
      }

      return { success: true, message: 'Rollback exitoso' };
    } catch (err) {
      if (err.response) {
        console.error('Bancard rollback error:', err.response.status, err.response.data?.messages?.[0]?.dsc);
      }
      return { success: false, message: 'No se pudo realizar el rollback' };
    }
  }

  async getConfirmation(shopProcessId) {
    const token = this._generateToken(this.privateKey, shopProcessId, 'get_confirmation');

    try {
      const { data } = await axios.post(`${this.baseUrl}/vpos/api/0.3/single_buy/confirmations`, {
        public_key: this.publicKey,
        operation: { token, shop_process_id: shopProcessId }
      });

      if (data.status === 'error') {
        const msg = data.messages && data.messages[0] ? data.messages[0].dsc : 'Error desconocido';
        throw new Error('Bancard: ' + msg);
      }

      return data.confirmation || data;
    } catch (err) {
      if (err.response) {
        console.error('Bancard getConfirmation error:', err.response.status, err.response.data?.messages?.[0]?.dsc);
      }
      if (err.message.startsWith('Bancard:')) throw err;
      throw new Error('Bancard: No se pudo obtener la confirmación');
    }
  }

  verifyWebhookToken({ shopProcessId, amount, currency, token }) {
    const expected = this._generateToken(this.privateKey, shopProcessId, 'confirm', amount, currency);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'utf8'),
        Buffer.from(token, 'utf8')
      );
    } catch {
      return false;
    }
  }

  formatAmount(amount) {
    return Number(amount).toFixed(2);
  }
}

module.exports = new BancardService();
