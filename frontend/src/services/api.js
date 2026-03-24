import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

// ── In-memory GET cache ───────────────────────────────────────────────────
const memCache = new Map();
const CACHE_TTL = 45 * 1000; // 45 seconds — fast enough for fresh data, instant on re-visit

const defaultAdapter = axios.defaults.adapter;

const cachedAdapter = async (config) => {
  // Only cache authenticated GET requests
  if (config.method !== 'get' || config._noCache) {
    return defaultAdapter(config);
  }

  const key = `${config.url}||${JSON.stringify(config.params ?? {})}`;
  const hit = memCache.get(key);

  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    // Return a clone so callers can mutate without affecting cache
    return { ...hit.res };
  }

  const res = await defaultAdapter(config);
  memCache.set(key, { res, ts: Date.now() });
  return res;
};

const api = axios.create({ baseURL: API_URL, adapter: cachedAdapter });

// ── Request interceptor — attach JWT ─────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('luxury_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor — smart logout ───────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    // Solo hacer logout si el token de sesión está rechazado en /auth/me
    // Evita que un 401 de negocio (QR inválido, etc.) cierre la sesión
    if (status === 401 && url.includes('/auth/me')) {
      localStorage.removeItem('luxury_token');
      localStorage.removeItem('luxury_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Cache helpers ─────────────────────────────────────────────────────────
/**
 * Invalidate cache entries whose URL contains any of the provided patterns.
 * Call after POST/PUT/DELETE to ensure fresh data on next GET.
 * Example: api.invalidate('/appointments', '/luxury/profile')
 */
api.invalidate = (...patterns) => {
  for (const key of memCache.keys()) {
    if (patterns.some(p => key.includes(p))) {
      memCache.delete(key);
    }
  }
};

/** Clear the entire cache (e.g., on logout) */
api.clearCache = () => memCache.clear();

export default api;
