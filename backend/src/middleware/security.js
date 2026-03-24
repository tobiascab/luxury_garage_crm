const rateLimit = require('express-rate-limit');
const slowDown  = require('express-slow-down');
const hpp       = require('hpp');
const crypto    = require('crypto');

// 1. General API limiter — 100 req / 15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' },
  skip: (req) => req.path === '/api/health',
});

// 2. Auth-specific limiter — 5 attempts / 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos de inicio de sesión. Esperá 15 minutos.' },
  skipSuccessfulRequests: true,
});

// 3. Slow-down after 30 req
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 30,
  delayMs: (hits) => hits * 200,
  maxDelayMs: 5000,
});

// 4. In-memory login lockout (10 failures = 30 min block)
const LOCKOUT_MAX = 10;
const LOCKOUT_MS  = 30 * 60 * 1000;
const failedMap   = new Map();

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
