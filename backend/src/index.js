require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { errorHandler } = require('./middleware/errorHandler');
const { initJobs } = require('./jobs/membershipJobs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : (origin, cb) => cb(null, true),
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Make prisma available on requests
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/services', require('./routes/services'));
app.use('/api/members', require('./routes/members'));
app.use('/api/memberships', require('./routes/memberships'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/credits', require('./routes/credits'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/arizar/oauth', require('./routes/arizar-oauth')); // Must be BEFORE arizar-admin
app.use('/api/arizar', require('./routes/arizar-admin'));
app.use('/api/masfacil', require('./routes/masfacil-webhooks'));
app.use('/api/invoices-crm', require('./routes/invoices-arizar'));
app.use('/api/luxury', require('./routes/luxury'));


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Luxury Garage API', timestamp: new Date().toISOString() });
});

// Centralized error handler (MUST be after routes)
app.use(errorHandler);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Ruta no encontrada: ${req.method} ${req.path}` });
});

const PORT = process.env.PORT || 3002;

const server = app.listen(PORT, () => {
  console.log(`🚗 Luxury Garage API corriendo en puerto ${PORT}`);
  console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);

  // Initialize cron jobs
  initJobs(prisma);
});

process.on('SIGTERM', async () => {
  server.close();
  await pool.end();
  await prisma.$disconnect();
  process.exit(0);
});

