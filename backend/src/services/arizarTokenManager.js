const axios = require('axios');

/**
 * ArizarTokenManager — gestiona el ciclo de vida del OAuth 2.0 de GoHighLevel (ARIZAR IA).
 *
 * - Persiste access+refresh token en BD (tabla ArizarOAuthToken), NO en archivo.
 * - Refresca automáticamente el access token antes de expirar (~24h) y persiste el
 *   refresh token ROTADO (GHL rota el refresh en cada uso: hay que guardar el nuevo).
 * - Expone getValidToken() para que el cliente axios inyecte un token siempre vigente.
 * - Marca requiresReauth cuando el refresh token es inválido (invalid_grant) → el admin
 *   debe reconectar la app desde el panel.
 *
 * NOTA: el body usa snake_case (client_id/grant_type/refresh_token), que es lo que el
 * resto del código ya usa y funciona. El changelog 2026-06-11 introdujo camelCase en /oauth/token;
 * si GHL rechaza el refresh, probar con clientId/grantType/refreshToken. Verificar en staging.
 */
class ArizarTokenManager {
  constructor(prisma) {
    this.prisma = prisma;
    this.baseURL = process.env.ARIZAR_BASE_URL || 'https://services.leadconnectorhq.com';
    this.clientId = process.env.ARIZAR_CLIENT_ID;
    this.clientSecret = process.env.ARIZAR_CLIENT_SECRET;
    this._refreshing = null; // promesa en vuelo para coalescer refreshes concurrentes
  }

  /** ¿Hay credenciales OAuth para operar? */
  hasOAuthCredentials() {
    return Boolean(this.clientId && this.clientSecret);
  }

  /** Persiste un par de tokens nuevo (tras authorization_code o refresh). */
  async saveTokens({ access_token, refresh_token, expires_in, locationId, companyId, userType, scope }) {
    const expiresAt = new Date(Date.now() + (Number(expires_in) || 86399) * 1000);
    const data = {
      accessToken: access_token,
      refreshToken: refresh_token,
      companyId: companyId || null,
      userType: userType || null,
      scope: scope || null,
      expiresAt,
      lastRefreshedAt: new Date(),
      lastRefreshError: null,
      refreshAttempts: 0,
      isActive: true,
      requiresReauth: false,
    };
    return this.prisma.arizarOAuthToken.upsert({
      where: { locationId: locationId || process.env.ARIZAR_LOCATION_ID },
      create: { locationId: locationId || process.env.ARIZAR_LOCATION_ID, ...data },
      update: data,
    });
  }

  /** Devuelve un access token vigente; refresca si está por expirar (< 5 min). */
  async getValidToken() {
    const token = await this.prisma.arizarOAuthToken.findFirst({ where: { isActive: true } });
    if (!token) throw new Error('ARIZAR OAuth: no hay token configurado (instalá/reconectá la app)');
    if (token.requiresReauth) throw new Error('ARIZAR OAuth: refresh token inválido, requiere re-autorización');

    const minutesLeft = (new Date(token.expiresAt).getTime() - Date.now()) / 60000;
    if (minutesLeft < 5) return this.refreshToken();
    return token.accessToken;
  }

  /** Refresca el access token y persiste el refresh ROTADO. Coalesce llamadas concurrentes. */
  async refreshToken() {
    if (this._refreshing) return this._refreshing;
    this._refreshing = this._doRefresh().finally(() => { this._refreshing = null; });
    return this._refreshing;
  }

  async _doRefresh() {
    const token = await this.prisma.arizarOAuthToken.findFirst({ where: { isActive: true } });
    if (!token) throw new Error('ARIZAR OAuth: no hay token para refrescar');

    try {
      const { data } = await axios.post(
        `${this.baseURL}/oauth/token`,
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: token.refreshToken,
          user_type: token.userType || 'Location',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, timeout: 15000 }
      );

      await this.prisma.arizarOAuthToken.update({
        where: { id: token.id },
        data: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || token.refreshToken, // rotación
          expiresAt: new Date(Date.now() + (Number(data.expires_in) || 86399) * 1000),
          scope: data.scope || token.scope,
          lastRefreshedAt: new Date(),
          lastRefreshError: null,
          refreshAttempts: 0,
          requiresReauth: false,
        },
      });
      return data.access_token;
    } catch (err) {
      const code = err.response?.data?.error;
      const invalidGrant = code === 'invalid_grant';
      await this.prisma.arizarOAuthToken.update({
        where: { id: token.id },
        data: {
          lastRefreshError: err.response?.data?.error_description || err.message,
          refreshAttempts: (token.refreshAttempts || 0) + 1,
          requiresReauth: invalidGrant,
          isActive: !invalidGrant,
        },
      });
      throw err;
    }
  }

  /** ¿El admin necesita reconectar la app? (para mostrar aviso en el panel) */
  async needsReauth() {
    const token = await this.prisma.arizarOAuthToken.findFirst({ where: {} });
    return !token || token.requiresReauth || !token.isActive;
  }
}

module.exports = ArizarTokenManager;
