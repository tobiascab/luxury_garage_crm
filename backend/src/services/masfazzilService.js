const axios = require('axios');
const crypto = require('crypto');

/**
 * MasFazzil Payment Service
 * Integración completa con la pasarela de pagos MasFazzil
 *
 * API Documentation:
 *  - Auth:    POST https://auth.masfazzil.com.py/oauth2/token
 *  - Gateway: https://gateway.masfazzil.com.py/{stage}/api/v2/...
 *
 * Endpoints:
 *  1. OAuth2 Authentication
 *  2. Card Register / List / Charge / Delete
 *  3. Client CRUD
 *  4. Operations (Debit) + Installments
 */
class MasFazzilService {
    constructor() {
        this.authURL = process.env.MASFAZZIL_AUTH_URL || 'https://auth.masfazzil.com.py';
        this.gatewayURL = process.env.MASFAZZIL_GATEWAY_URL || 'https://gateway.masfazzil.com.py';
        this.stage = process.env.MASFAZZIL_STAGE || 'prod';
        this.clientId = process.env.MASFAZZIL_CLIENT_ID;
        this.clientSecret = process.env.MASFAZZIL_CLIENT_SECRET;
        this.merchantUuid = process.env.MASFAZZIL_MERCHANT_UUID;
        this.webhookSecret = process.env.MASFAZZIL_WEBHOOK_SECRET;

        // Token cache
        this._token = null;
        this._tokenExpiresAt = 0;

        // Base URL for gateway
        this._baseURL = `${this.gatewayURL}/${this.stage}/api/v2`;
    }

    // ─────────────────────────────────────────────────────
    //  Configuration check
    // ─────────────────────────────────────────────────────
    isConfigured() {
        return !!(
            this.clientId &&
            this.clientId !== 'pending_configuration' &&
            this.clientSecret &&
            this.clientSecret !== 'pending_configuration'
        );
    }

    // ─────────────────────────────────────────────────────
    //  1. AUTHENTICATION (OAuth2 Client Credentials)
    // ─────────────────────────────────────────────────────

    /**
     * Obtain or refresh OAuth2 access token
     * Caches the token and auto-refreshes 60s before expiry
     */
    async getAccessToken() {
        // Return cached token if still valid (with 60s buffer)
        if (this._token && Date.now() < this._tokenExpiresAt - 60000) {
            return this._token;
        }

        try {
            const response = await axios.post(
                `${this.authURL}/oauth2/token`,
                new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'client_credentials',
                }).toString(),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 15000,
                }
            );

            this._token = response.data.access_token;
            this._tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);

            console.log('🔑 MasFazzil: Token OAuth2 obtenido correctamente');
            return this._token;
        } catch (err) {
            console.error('❌ MasFazzil auth error:', err.response?.data || err.message);
            throw new Error('Error de autenticación con MasFazzil');
        }
    }

    /**
     * Create an authenticated axios instance with current token
     */
    async _getClient() {
        const token = await this.getAccessToken();
        return axios.create({
            baseURL: this._baseURL,
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Client-Id': this.clientId,
                'Content-Type': 'application/json',
            },
            timeout: 20000,
        });
    }

    /**
     * Safe wrapper — logs errors, returns fallback on failure
     */
    async _safe(fn, fallback = null, mockReturn = null) {
        if (!this.isConfigured()) {
            console.log('⚠️ MasFazzil no configurado, modo mock activado');
            if (mockReturn !== null) return mockReturn;
            return fallback;
        }
        try {
            return await fn();
        } catch (err) {
            const msg = err.response?.data?.message || err.response?.data?.error || err.message;
            const status = err.response?.status;
            console.error(`❌ MasFazzil error [${status || 'N/A'}]:`, msg);
            // Re-throw with clean message for caller
            const error = new Error(msg);
            error.statusCode = status;
            error.masfazzilError = true;
            throw error;
        }
    }

    // ─────────────────────────────────────────────────────
    //  2. CARD MANAGEMENT
    // ─────────────────────────────────────────────────────

    /**
     * Register a new card (catastro)
     * Returns a redirect_url where the user enters card data securely
     *
     * @param {Object} customer - { name, email, document_number, document_type, phone }
     * @returns {Object} { customer_uuid, redirect_url }
     */
    async registerCard(customer) {
        return this._safe(async () => {
            const client = await this._getClient();
            const response = await client.post('/card/register', {
                merchant_uuid: this.merchantUuid,
                customer: {
                    name: customer.name,
                    email: customer.email,
                    document_number: customer.document_number,
                    document_type: customer.document_type || 'CI',
                    phone: customer.phone,
                },
            });
            console.log('💳 MasFazzil: Catastro de tarjeta iniciado');
            return response.data?.data || response.data;
        }, null, { redirect_url: 'https://masfazzil.com.py/mock-catastro', customer_uuid: 'mock-customer-uuid' });
    }

    /**
     * List cards registered for a customer
     *
     * @param {string} customerUuid - UUID del cliente en MasFazzil
     * @returns {Array} Lista de tarjetas
     */
    async listCards(customerUuid) {
        return this._safe(async () => {
            const client = await this._getClient();
            const response = await client.get('/card/list', {
                params: { customer_uuid: customerUuid },
            });
            return response.data?.data || [];
        }, [], [{ id: 'mock-card-1', brand: 'Visa', masked_number: '1234', isPrimary: true }]);
    }

    /**
     * Charge a registered card
     *
     * @param {Object} chargeData - { amount, currency, description, merchant_reference, card_id, customer_uuid }
     * @returns {Object} { transaction_id, operation_detail_id, provider_reference, status }
     */
    async chargeCard(chargeData) {
        return this._safe(async () => {
            const client = await this._getClient();
            const response = await client.post('/card/charge', {
                amount: chargeData.amount,
                currency: chargeData.currency || 'PYG',
                description: chargeData.description,
                merchant_uuid: this.merchantUuid,
                merchant_reference: chargeData.merchant_reference,
                card_id: chargeData.card_id,
                customer_uuid: chargeData.customer_uuid,
            });
            console.log(`💰 MasFazzil: Cobro de ₲${chargeData.amount.toLocaleString()} procesado`);
            return response.data?.payment || response.data;
        }, null, { transaction_id: 'mock-tx-123', status: 'PAID' });
    }

    /**
     * Delete a registered card
     *
     * @param {string} cardId - ID de la tarjeta en MasFazzil
     * @returns {Object} { success, message }
     */
    async deleteCard(cardId) {
        return this._safe(async () => {
            const client = await this._getClient();
            const response = await client.delete('/card', {
                params: { card_id: cardId },
            });
            console.log('🗑️ MasFazzil: Tarjeta eliminada');
            return response.data;
        }, null, { success: true });
    }

    // ─────────────────────────────────────────────────────
    //  3. CLIENT MANAGEMENT (Debit System)
    // ─────────────────────────────────────────────────────

    /**
     * Create a new client in MasFazzil
     *
     * @param {Object} clientData - { code, full_name, document_type, document_number, email, phone }
     * @returns {Object} Created client with UUID
     */
    async createClient(clientData) {
        return this._safe(async () => {
            const client = await this._getClient();
            const response = await client.post('/debit/clients', {
                code: clientData.code,
                full_name: clientData.full_name,
                document_type: clientData.document_type || 'CI',
                document_number: clientData.document_number,
                email: clientData.email,
                phone: clientData.phone,
            });
            console.log(`👤 MasFazzil: Cliente creado - ${clientData.full_name}`);
            return response.data?.data || response.data;
        });
    }

    /**
     * Get client UUID by document number
     *
     * @param {string} documentNumber - CI or RUC number
     * @returns {Object|null} Client data with UUID
     */
    async getClientByDocument(documentNumber) {
        return this._safe(async () => {
            const client = await this._getClient();
            const response = await client.get(
                `/debit/clients/by-document/${documentNumber}`
            );
            return response.data;
        });
    }

    /**
     * Get payment tokens (registered cards) for a client
     *
     * @param {string} clientUuid - UUID del cliente
     * @returns {Array} Payment tokens
     */
    async getClientPaymentTokens(clientUuid) {
        return this._safe(async () => {
            const client = await this._getClient();
            const response = await client.get(
                `/debit/clients/${clientUuid}/payment-tokens`
            );
            return response.data || [];
        }, []);
    }

    /**
     * Delete a client from MasFazzil
     * WARNING: This also deletes all payment tokens and operations
     *
     * @param {string} clientUuid - UUID del cliente
     * @returns {Object} Deleted client data
     */
    async deleteClient(clientUuid) {
        return this._safe(async () => {
            const client = await this._getClient();
            const response = await client.delete(`/debit/clients/${clientUuid}`);
            console.log(`🗑️ MasFazzil: Cliente eliminado - ${clientUuid}`);
            return response.data;
        });
    }

    // ─────────────────────────────────────────────────────
    //  4. OPERATIONS (Debit / Installments)
    // ─────────────────────────────────────────────────────

    /**
     * Create a debit operation (recurring charges)
     *
     * @param {Object} opData - { client_uuid, institution, description, installments,
     *                           start_date, amount_per_installment, first_due_date, code }
     * @returns {Object} Operation result
     */
    async createOperation(opData) {
        return this._safe(async () => {
            const client = await this._getClient();
            const response = await client.post('/debit/operations', {
                client_uuid: opData.client_uuid,
                institution: opData.institution || 'Luxury Garage',
                description: opData.description,
                installments: opData.installments,
                start_date: opData.start_date,
                amount_per_installment: opData.amount_per_installment,
                first_due_date: opData.first_due_date,
                code: opData.code,
            });
            console.log(`📋 MasFazzil: Operación de débito creada - ${opData.code}`);
            return response.data;
        });
    }

    /**
     * Search operation by code
     *
     * @param {string} code - Unique operation code
     * @returns {Object} Operation data
     */
    async getOperationByCode(code) {
        return this._safe(async () => {
            const client = await this._getClient();
            const response = await client.get('/debit/operations', {
                params: { search: code },
            });
            return response.data;
        });
    }

    /**
     * Get operation status by UUID
     *
     * @param {string} operationUuid - UUID de la operación
     * @returns {Object} Operation status and details
     */
    async getOperationStatus(operationUuid) {
        return this._safe(async () => {
            const client = await this._getClient();
            const response = await client.get(`/operations/${operationUuid}`);
            return response.data;
        });
    }

    /**
     * Get operation preview (installments summary: pending, paid, overdue, cancelled)
     *
     * @param {string} operationUuid - UUID de la operación
     * @returns {Object} { pending, paid, overdue, cancelled, totals, client, commerce }
     */
    async getOperationPreview(operationUuid) {
        return this._safe(async () => {
            const client = await this._getClient();
            const response = await client.get(`/operations/${operationUuid}/preview`);
            return response.data;
        });
    }

    /**
     * Get all installments for an operation
     *
     * @param {string} operationUuid - UUID de la operación
     * @returns {Array} Installment details
     */
    async getInstallments(operationUuid) {
        return this._safe(async () => {
            const client = await this._getClient();
            const response = await client.get(`/operations/${operationUuid}/installments`);
            return response.data || [];
        }, []);
    }

    // ─────────────────────────────────────────────────────
    //  5. WEBHOOK VERIFICATION
    // ─────────────────────────────────────────────────────

    /**
     * Verify webhook signature
     *
     * @param {string} signature - From X-MasFazzil-Signature header
     * @param {Object} body - Request body
     * @returns {boolean}
     */
    verifyWebhookSignature(signature, body) {
        if (!this.webhookSecret) return true; // Skip if no secret configured
        const hash = crypto
            .createHmac('sha256', this.webhookSecret)
            .update(JSON.stringify(body))
            .digest('hex');
        return signature === hash;
    }

    // ─────────────────────────────────────────────────────
    //  6. HELPER METHODS
    // ─────────────────────────────────────────────────────

    /**
     * Generate a unique payment reference
     *
     * @param {string} userId - User ID
     * @param {string} type - Reference type (MEM, TOP, SRV, etc.)
     * @returns {string} Reference like "LG-MEM-abc123-1711352166"
     */
    generateReference(userId, type = 'PAY') {
        const short = userId.substring(0, 8);
        return `LG-${type}-${short}-${Date.now()}`;
    }

    /**
     * Generate a unique operation code
     *
     * @param {string} userId - User ID
     * @param {string} planSlug - Plan slug
     * @returns {string} Code like "LG-OP-basic-abc123-1711352166"
     */
    generateOperationCode(userId, planSlug) {
        const short = userId.substring(0, 8);
        return `LG-OP-${planSlug}-${short}-${Date.now()}`;
    }

    /**
     * Sync a Luxury Garage user to MasFazzil
     * Creates or finds the client in MasFazzil and returns the customer UUID
     *
     * @param {Object} user - Prisma user object
     * @returns {string|null} MasFazzil customer UUID
     */
    async syncUser(user) {
        if (!this.isConfigured()) return 'mock-customer-uuid';

        // If user already has a MasFazzil UUID, return it
        if (user.masfazzilCustomerUuid) {
            return user.masfazzilCustomerUuid;
        }

        // If user has a document number, try to find them in MasFazzil
        if (user.documentNumber) {
            try {
                const existing = await this.getClientByDocument(user.documentNumber);
                if (existing?.id) {
                    return existing.id;
                }
            } catch (e) {
                // Not found, create new
            }
        }

        // Create new client in MasFazzil
        if (user.documentNumber) {
            try {
                const created = await this.createClient({
                    code: `LG-${user.id.substring(0, 8)}`,
                    full_name: `${user.firstName} ${user.lastName}`,
                    document_type: user.documentType || 'CI',
                    document_number: user.documentNumber,
                    email: user.email,
                    phone: user.phone || '',
                });
                return created?.id || null;
            } catch (e) {
                console.error('❌ MasFazzil: Error sincronizando usuario:', e.message);
                return null;
            }
        }

        return null;
    }
}

module.exports = new MasFazzilService();
