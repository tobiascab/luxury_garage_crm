import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const api = axios.create({ baseURL: API_URL });

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
    if (status === 401 && url.includes('/auth/me')) {
      localStorage.removeItem('luxury_token');
      localStorage.removeItem('luxury_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── In-memory GET cache (safe wrapper — no Axios internals) ───────────────
const memCache = new Map();
const CACHE_TTL = 45 * 1000; // 45 seconds

const _originalGet = api.get.bind(api);

api.get = async (url, config = {}) => {
  // Skip cache when explicitly requested
  if (config._noCache) return _originalGet(url, config);

  const key = `${url}||${JSON.stringify(config.params ?? {})}`;
  const hit = memCache.get(key);

  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return hit.res;
  }

  const res = await _originalGet(url, config);
  memCache.set(key, { res, ts: Date.now() });
  return res;
};

/** Invalidate cache entries whose URL matches any of the given patterns */
api.invalidate = (...patterns) => {
  for (const key of memCache.keys()) {
    if (patterns.some(p => key.includes(p))) memCache.delete(key);
  }
};

/** Clear entire cache (e.g., on logout) */
api.clearCache = () => memCache.clear();

export default api;
