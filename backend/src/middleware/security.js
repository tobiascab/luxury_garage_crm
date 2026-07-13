const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const hpp = require('hpp');
const crypto = require('crypto');

// 1. General API limiter — 1200 req / 15 min per IP (~80/min).
// Antes eran 100/15min y era DEMASIADO bajo: el panel admin/cliente hace polling de
// notificaciones cada 30s + carga varios endpoints por pantalla, así que una sola persona
// (o una oficina detrás de un mismo NAT/IP) agotaba el cupo y hasta el login caía con 429.
// 1200/15min sigue frenando scrapers/fuerza bruta (>80 req/min) pero no molesta al uso real.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' },
  // No contar health ni el polling liviano de notificaciones contra el cupo general.
  skip: (req) => req.path === '/api/health' || req.path === '/api/luxury/notifications',
});

// 2. Auth-specific limiter — 5 attempts / 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Limita los intentos FALLIDOS por IP (skipSuccessfulRequests: true). Los logins exitosos
  // NO cuentan, así que este techo solo lo alcanza quien erra la contraseña muchas veces.
  // La defensa principal anti-fuerza-bruta es loginLockout por cuenta.
  max: process.env.NODE_ENV === 'production' ? 40 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos de inicio de sesión. Esperá 15 minutos.' },
  skipSuccessfulRequests: true,
});

// 3. Slow-down: recién agrega latencia pasadas 600 requests (antes 50, molestaba al panel).
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 600,
  delayMs: (hits) => (hits - 600) * 100,
  maxDelayMs: 2000, // Máximo 2 segundos en lugar de 5
});

// 4. In-memory login lockout (20 fallos por cuenta = 15 min de bloqueo).
// Más permisivo que antes (eran 10 fallos = 30 min) para no bloquear a quien simplemente
// se equivoca varias veces; sigue frenando fuerza bruta real (20 intentos y a esperar).
const LOCKOUT_MAX = 20;
const LOCKOUT_MS = 15 * 60 * 1000;
const failedMap = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of failedMap) {
    if (v.lockedUntil && v.lockedUntil < now) failedMap.delete(k);
  }
}, 10 * 60 * 1000);

const loginLockout = {
  isLocked(email) {
    const e = email?.toLowerCase();
    const entry = failedMap.get(e);
    if (!entry) return false;
    return !!(entry.lockedUntil && Date.now() < entry.lockedUntil);
  },
  recordFailure(email) {
    const e = email?.toLowerCase();
    const entry = failedMap.get(e) || { count: 0, lockedUntil: null };
    entry.count += 1;
    if (entry.count >= LOCKOUT_MAX) {
      entry.lockedUntil = Date.now() + LOCKOUT_MS;
      console.warn(`�� Lockout: ${e} bloqueado 30 min (${entry.count} intentos)`);
    }
    failedMap.set(e, entry);
  },
  clearFailures(email) { failedMap.delete(email?.toLowerCase()); },
  minutesLeft(email) {
    const entry = failedMap.get(email?.toLowerCase());
    if (!entry?.lockedUntil) return 0;
    return Math.ceil((entry.lockedUntil - Date.now()) / 60000);
  }
};

// 5. Request ID
const requestId = (req, res, next) => {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};

// 6. HPP
const hppProtection = hpp();

module.exports = { generalLimiter, authLimiter, speedLimiter, loginLockout, requestId, hppProtection };
