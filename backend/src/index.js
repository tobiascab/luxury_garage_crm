require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { errorHandler } = require('./middleware/errorHandler');
const { initJobs } = require('./jobs/membershipJobs');
const {
  generalLimiter,
  speedLimiter,
  requestId,
  hppProtection,
} = require('./middleware/security');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const app = express();

// Inyecta el prisma singleton al servicio ARIZAR/GHL para habilitar OAuth (token persistido en BD).
// Sin esto, arizarService cae al ARIZAR_API_TOKEN estático (comportamiento legado, no rompe nada).
require('./services/arizarService').setPrisma(prisma);

// Confiar en el proxy (Nginx) para que el rate-limiter identifique bien las IPs
app.set('trust proxy', 1);

// ── 1. Request ID (traceability) ──────────────────────────────────────────
app.use(requestId);
app.use(compression());

// ── 2. Security headers (Helmet) ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'wss://luxurygarage.arizar-ia.cloud', 'ws://localhost:*', 'https:'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  xssFilter: true,
  noSniff: true,
  hidePoweredBy: true,
}));

// ── 3. CORS ───────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      console.warn(`🚫 CORS bloqueado: ${origin}`);
      cb(new Error('CORS: origen no permitido'));
    }
    : (origin, cb) => cb(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// ── 4. HTTP Parameter Pollution ───────────────────────────────────────────
app.use(hppProtection);

// ── Prisma on request (movido arriba: los webhooks de Bancard lo necesitan) ───
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// ── 5. Body parsing (strict limits) ──────────────────────────────────────
app.use(express.json({
  limit: '1mb',
  // Captura el cuerpo CRUDO (bytes originales) para verificar firmas de webhooks
  // (GHL/ARIZAR firma el raw body, no el JSON re-serializado). Ver middleware/webhookVerify.js.
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── 6. Logging ────────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── 7. General rate limiter + slow-down (on all /api/* routes) ───────────
app.use('/api', generalLimiter);
app.use('/api', speedLimiter);

// ── 8. Static files ───────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/services', require('./routes/services'));
app.use('/api/vehicle-sizes', require('./routes/vehicle-sizes'));
app.use('/api/members', require('./routes/members'));
app.use('/api/memberships', require('./routes/memberships'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/payments', require('./routes/payments')); // Bancard VPOS: tarjetas, cobros, recargas
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/chat', require('./routes/chat')); // Chat bidireccional (buzón admin) + asistente IA del cliente
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/credits', require('./routes/credits'));
app.use('/api/membership-requests', require('./routes/membership-requests')); // Solicitudes de membresía (lead público + admin + ARIZAR)
app.use('/api/push', require('./routes/push'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/accounting', require('./routes/accounting'));
app.use('/api/scans', require('./routes/scans'));
app.use('/api/arizar/oauth', require('./routes/arizar-oauth'));
app.use('/api/arizar', require('./routes/arizar-admin'));
app.use('/api/bancard', require('./routes/bancard-webhooks'));
app.use('/api/invoices-crm', require('./routes/invoices-arizar'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/luxury', require('./routes/luxury'));
app.use('/', require('./routes/luxury'));
app.use('/api', require('./routes/luxury'));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Luxury Garage API', timestamp: new Date().toISOString() });
});

// ── 404 — no leakamos rutas internas (antes del errorHandler) ────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Recurso no encontrado' });
});

// ── Error handler (DEBE ser el último middleware de la cadena) ───────────
app.use(errorHandler);

// ── Resiliencia: una promesa sin catch o una excepción async NO debe tumbar el proceso.
//    Con jobs cron async, un error que escape el try/catch terminaría el proceso en Node moderno.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? (reason.stack || reason.message) : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err?.stack || err);
});

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3002;

const server = app.listen(PORT, () => {
  console.log(`🚗 Luxury Garage API corriendo en puerto ${PORT}`);
  console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
  initJobs(prisma);

  // Reconciliación de cobros Bancard PENDING — red de seguridad para pagos huérfanos (timeout de
  // red, navegador cerrado tras 3DS, webhook perdido). Cada 5 min, idempotente (lock + re-check).
  const { reconcilePendingCharges } = require('./services/paymentReconciliation');
  setInterval(() => {
    reconcilePendingCharges(prisma).catch((e) => console.error('[Reconciliación] error:', e.message));
  }, 5 * 60 * 1000);
});

process.on('SIGTERM', async () => {
  server.close();
  await pool.end();
  await prisma.$disconnect();
  process.exit(0);
});
