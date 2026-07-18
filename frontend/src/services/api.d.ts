import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Tipos del cliente HTTP (`api.js`). Además de la instancia de Axios,
 * expone una caché GET en memoria (45s) y helpers para invalidarla.
 */
export interface LuxuryApi extends AxiosInstance {
  /**
   * `api.get` acepta un flag extra `_noCache` para saltear la caché en memoria.
   */
  get<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: AxiosRequestConfig<D> & { _noCache?: boolean }
  ): Promise<R>;
  /** Invalida las entradas de caché cuyo URL matchee alguno de los patrones. */
  invalidate(...patterns: string[]): void;
  /** Limpia toda la caché GET en memoria (p. ej. al cerrar sesión). */
  clearCache(): void;
}

declare const api: LuxuryApi;
export default api;
