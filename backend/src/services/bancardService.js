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

  // ─── Factura Electrónica (Bancard emite la factura SIFEN junto al pago) ───────────────
  // Doc Bancard eCommerce Compra Simple v1.23.1, págs. 12-16/37-39/45-47/66-71.
  // El objeto `billing` viaja DENTRO de la operación de pago (charge/single_buy). Si sale
  // aprobado y los datos son válidos, Bancard emite la factura y envía el KuDE al client_email.

  /**
   * La facturación solo se activa si el flag está en "on" Y están cargados los 3 datos del
   * emisor (timbrado/establecimiento/punto de expedición). Con cualquiera de ellos ausente,
   * los cobros van SIN factura, exactamente como antes (cero cambio de comportamiento).
   */
  facturacionEnabled() {
    return (
      String(process.env.BANCARD_FACTURACION || '').toLowerCase() === 'on' &&
      !!process.env.BANCARD_TIMBRADO &&
      !!process.env.BANCARD_ESTABLECIMIENTO &&
      !!process.env.BANCARD_PUNTO_EXPEDICION
    );
  }

  /**
   * Arma el objeto `billing` para emitir factura electrónica junto al pago.
   * Devuelve null (⇒ pago sin factura) si la facturación está desactivada, faltan ítems, o la
   * suma de los ítems no cuadra EXACTO con el monto (regla dura de Bancard: de lo contrario
   * rechaza el pago). NUNCA lanza: un problema de facturación jamás debe impedir un cobro.
   *
   * @param {object}  opts
   * @param {object}  opts.client   { ruc?, name, email } — ruc null/vacío ⇒ factura innominada
   * @param {Array}   opts.items    [{ description, amountGs, ivaRate?=10, qty?=1 }]
   * @param {number}  opts.totalGs  monto total del cobro (Gs, entero) para validar el cuadre
   */
  buildBilling({ client, items, totalGs } = {}) {
    try {
      if (!this.facturacionEnabled()) return null;
      if (!Array.isArray(items) || items.length === 0) return null;

      const ivaDefault = Number(process.env.BANCARD_IVA_RATE || 10);
      const details = items
        .filter((it) => it && Number(it.amountGs) > 0)
        .map((it) => ({
          description: String(it.description || 'Servicio').slice(0, 255),
          // PYG es zero-decimal pero Bancard pide Decimal(15,2) con separador '.'
          amount: Number(it.amountGs).toFixed(2),
          iva_rate: it.ivaRate != null ? Number(it.ivaRate) : ivaDefault,
          total_items: it.qty != null ? Number(it.qty) : 1,
        }));

      if (details.length === 0) return null;

      // El costo total de details debe coincidir con operation.amount (doc pág. 13). Si no cuadra,
      // omitimos la factura en vez de arriesgar que Bancard rechace el cobro entero.
      const sum = details.reduce((s, d) => s + Math.round(parseFloat(d.amount) * d.total_items), 0);
      if (totalGs != null && sum !== Math.round(Number(totalGs))) {
        console.error(`[Bancard billing] suma de ítems (${sum}) ≠ monto (${totalGs}); se OMITE la factura para no romper el cobro (sp pendiente)`);
        return null;
      }

      const ruc = client?.ruc ? String(client.ruc).trim() : null;
      return {
        client_ruc: ruc || null, // null ⇒ factura innominada (tope Gs 7.000.000 por DNIT)
        client_name: String(client?.name || '').slice(0, 100),
        client_email: String(client?.email || ''), // NO truncar: 32 de la doc rompería emails reales
        commerce_stamp: process.env.BANCARD_TIMBRADO,
        commerce_expedition_point: process.env.BANCARD_PUNTO_EXPEDICION,
        commerce_establishment: process.env.BANCARD_ESTABLECIMIENTO,
        details,
      };
    } catch (e) {
      console.error('[Bancard billing] buildBilling falló, se omite factura:', e.message);
      return null;
    }
  }

  /**
   * Arma el bloque `client` de facturación a partir de un `user`. Nombre = razón social si el
   * cliente la cargó; si no, su nombre completo; si no, el email. RUC opcional (null ⇒ innominada).
   */
  billingClientFromUser(user) {
    if (!user) return null;
    const name = (user.razonSocial && String(user.razonSocial).trim())
      || `${user.firstName || ''} ${user.lastName || ''}`.trim()
      || user.email;
    return { ruc: user.ruc || null, name, email: user.email || '' };
  }

  /**
   * Extrae el resultado de facturación de un `confirmation` de Bancard (viene tanto en la
   * respuesta del charge directo como en get_confirmation). Tolerante a ausencia (pago sin factura).
   */
  extractBillingResult(confirmation) {
    if (!confirmation) return null;
    const br = confirmation.billing_response;
    const ivaAmount = confirmation.iva_amount != null && confirmation.iva_amount !== ''
      ? Math.round(parseFloat(confirmation.iva_amount))
      : null;
    const ivaTicket = confirmation.iva_ticket_number ? String(confirmation.iva_ticket_number) : null;
    if (!br && ivaAmount == null && !ivaTicket) return null; // el pago no llevaba facturación
    return {
      invoiceNumber: br?.data?.invoice_number || null,
      status: br?.status || null,               // 'success' | 'error'
      description: br?.description || null,
      ivaAmountGs: Number.isFinite(ivaAmount) ? ivaAmount : null,
      ivaTicketNumber: ivaTicket,
    };
  }

  /**
   * Traduce el resultado de facturación a las columnas de la tabla `payments`. Devuelve {} si
   * no hubo factura (así se puede hacer spread seguro en cualquier payment.update/create).
   */
  billingToPaymentData(confirmationOrResult) {
    const r = confirmationOrResult && confirmationOrResult.invoiceNumber !== undefined
      ? confirmationOrResult
      : this.extractBillingResult(confirmationOrResult);
    if (!r) return {};
    const data = {};
    if (r.invoiceNumber) data.bancardInvoiceNumber = r.invoiceNumber;
    if (r.ivaAmountGs != null) data.ivaAmountGs = r.ivaAmountGs;
    if (r.ivaTicketNumber) data.bancardIvaTicketNumber = r.ivaTicketNumber;
    if (r.status) data.billingStatus = r.status;
    return data;
  }

  _generateToken(...parts) {
    // IDs and strings as-is; callers must pre-format amounts with .toFixed(2)
    const str = parts.map(p => String(p)).join('');
    return crypto.createHash('md5').update(str).digest('hex');
  }

  generateShopProcessId() {
    return Date.now();
  }

  async singleBuy({ shopProcessId, amount, currency = 'PYG', description, returnUrl, cancelUrl, billing }) {
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
          cancel_url: cancelUrl,
          ...(billing ? { billing } : {}), // factura electrónica (opcional): Bancard emite el DTE SIFEN
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

  async charge({ shopProcessId, amount, currency = 'PYG', description, aliasToken, returnUrl, billing }) {
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
          return_url: returnUrl || '',
          ...(billing ? { billing } : {}), // factura electrónica (opcional): Bancard emite el DTE SIFEN y envía el KuDE al client_email
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
        threeDsRequired,
        billing: this.extractBillingResult(confirmation) // resultado de la factura (null si el pago no llevaba billing)
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

  /**
   * Cancela una factura electrónica ya emitida (doc pág. 69). Requisitos de Bancard: el
   * comprobante debe estar aprobado y la cancelación se permite hasta 24 hs después de emitida.
   * Se usa al reembolsar un cobro que ya generó factura.
   * @returns {Promise<{success:boolean, message:string}>}
   */
  async cancelInvoice(shopProcessId) {
    const token = this._generateToken(this.privateKey, shopProcessId, 'billing_cancel');
    try {
      const { data } = await axios.post(`${this.baseUrl}/vpos/api/0.3/billing/cancel`, {
        public_key: this.publicKey,
        operation: { token, shop_process_id: String(shopProcessId) }
      });
      if (data.status === 'error') {
        const msg = data.messages && data.messages[0] ? data.messages[0].dsc : 'No se pudo cancelar la factura';
        return { success: false, message: msg };
      }
      const msg = data.messages && data.messages[0] ? data.messages[0].dsc : 'Factura cancelada';
      return { success: true, message: msg };
    } catch (err) {
      if (err.response) {
        console.error('Bancard cancelInvoice error:', err.response.status, err.response.data?.messages?.[0]?.dsc);
      }
      return { success: false, message: 'No se pudo cancelar la factura electrónica' };
    }
  }

  /**
   * Consulta nombre/razón social y correo de un cliente por RUC (doc pág. 67, operación opcional).
   * Útil para autocompletar los datos de facturación cuando el cliente carga su RUC.
   * @returns {Promise<{name:string, email:string}|null>}
   */
  async getClientInfo(clientRuc) {
    const token = this._generateToken(this.privateKey, 'billing_client_info');
    try {
      const { data } = await axios.post(`${this.baseUrl}/vpos/api/0.3/billing/client_info`, {
        public_key: this.publicKey,
        operation: { token, client_ruc: String(clientRuc) }
      });
      if (data.status !== 'success' || !data.client) return null;
      return { name: data.client.name || '', email: data.client.email || '' };
    } catch (err) {
      if (err.response) {
        console.error('Bancard getClientInfo error:', err.response.status, err.response.data?.messages?.[0]?.dsc);
      }
      return null;
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
