const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { authLimiter, loginLockout } = require('../middleware/security');
const ArizarSync = require('../services/arizarSync');
const { provisionClient } = require('../services/clientProvisioning');

// Apply strict rate limiter on all auth write endpoints
router.post('/login', authLimiter);
router.post('/public-register', authLimiter);
router.post('/register', authLimiter);


// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });

    // ── Lockout check ────────────────────────────────────────────────────
    if (loginLockout.isLocked(email)) {
      const mins = loginLockout.minutesLeft(email);
      return res.status(429).json({ success: false, message: `Cuenta bloqueada temporalmente. Intentá de nuevo en ${mins} minuto(s).` });
    }

    const user = await req.prisma.user.findUnique({ where: { email }, include: { memberships: { where: { status: 'ACTIVE' }, include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 } } });

    // ── Always run bcrypt to avoid timing attacks ─────────────────────────
    const dummyHash = '$2a$12$invalidhashtopreventtimingattack1234567890';
    const valid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (!user || !valid) {
      loginLockout.recordFailure(email);
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Cuenta suspendida. Contactá al administrador.' });
    }

    // ── Success ───────────────────────────────────────────────────────────
    loginLockout.clearFailures(email);
    await req.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    const { passwordHash, ...userData } = user;
    res.json({ success: true, data: { token, user: userData } });
  } catch (err) { next(err); }
});


// POST /api/auth/register — Internal (admin) registration.
// SEGURIDAD: requiere auth + rol elevado. El alta pública de clientes va por /public-register.
// El rol NUNCA se toma del body: este endpoint sólo crea CLIENTE. Para EMPLOYEE/ADMIN/SUPER_ADMIN
// usar /members/staff o /admin-create, que validan la jerarquía de roles.
router.post('/register', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, arizarContactId, vehicle, planId, referralCode, sendCredentials } = req.body;
    if (!email || !password || !firstName || !lastName) return res.status(400).json({ success: false, message: 'Campos requeridos: email, password, firstName, lastName' });

    const exists = await req.prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ success: false, message: 'El email ya está registrado' });

    // Validate planId before creating the user
    let planRecord = null;
    if (planId) {
      planRecord = await req.prisma.plan.findUnique({ where: { id: planId } });
      if (!planRecord) {
        return res.status(400).json({ success: false, message: 'Plan no válido' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Escrituras de BD atómicas: user + vehicle + membership + referral. Si algo falla a mitad,
    // se revierte todo y no quedan cuentas en estado parcial.
    // IMPORTANTE: el sync con ARIZAR (HTTP) y el WhatsApp se ejecutan DESPUÉS del commit (best-effort).
    let referrerToNotify = null;
    const { user, vehicleData, membership } = await req.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        // role forzado a 'CLIENT': el registro nunca asigna roles elevados desde el body (escalación de privilegios).
        data: { email, passwordHash, firstName, lastName, phone: phone || null, role: 'CLIENT', arizarContactId: arizarContactId || null }
      });

      // Vehicle
      let vehicleData = null;
      if (vehicle && vehicle.brand && vehicle.model) {
        vehicleData = await tx.vehicle.create({
          data: {
            userId: user.id, brand: vehicle.brand, model: vehicle.model,
            year: vehicle.year || new Date().getFullYear(),
            color: vehicle.color || '', licensePlate: vehicle.licensePlate || '',
            notes: vehicle.notes || null, isPrimary: true,
          }
        });
      }

      // Auto-assign plan if provided
      let membership = null;
      if (planRecord) {
        const start = new Date();
        const end = new Date(); end.setMonth(end.getMonth() + 1);
        membership = await tx.membership.create({
          data: { userId: user.id, planId: planRecord.id, status: 'ACTIVE', startDate: start, endDate: end },
          include: { plan: true }
        });
      }

      // Process referral code (parte de BD dentro de la transacción)
      if (referralCode) {
        const referral = await tx.referral.findFirst({ where: { code: referralCode, status: 'PENDING' } });
        if (referral) {
          await tx.referral.update({ where: { id: referral.id }, data: { referredId: user.id, status: 'COMPLETED', completedAt: new Date() } });
          // Diferir la notificación al referidor (HTTP) hasta después del commit.
          referrerToNotify = await tx.user.findUnique({ where: { id: referral.referrerId } });
        }
      }

      return { user, vehicleData, membership };
    });

    // ─── A partir de acá, todo es best-effort fuera de la transacción ───
    const sync = new ArizarSync(req.prisma);

    // Notify referrer (HTTP externo)
    if (referrerToNotify) {
      try {
        await sync.syncReferral(referrerToNotify, user);
      } catch (e) { console.error('Error procesando referido:', e.message); }
    }

    // ═══ ARIZAR IA SYNC ═══
    let contactId = null;
    try {
      const plan = membership?.plan || null;
      contactId = await sync.syncUserRegistration(user, plan);
    } catch (e) { console.error('Error sincronizando con ARIZAR:', e.message); }

    // Send credentials if requested (from admin creation)
    if (sendCredentials && contactId) {
      try {
        const arizarService = require('../services/arizarService');
        await arizarService.sendWhatsApp(contactId,
          `🚗 ¡Bienvenido a Luxury Garage, ${firstName}!\n\n` +
          `Tu cuenta ha sido creada:\n` +
          `📧 Email: ${email}\n` +
          `🔑 Contraseña: ${password}\n\n` +
          `Accedé a tu portal: https://luxurygarage.arizar-ia.cloud/login`
        );
      } catch (e) { console.error('Error enviando credenciales por WhatsApp:', e.message); }
    }

    const { passwordHash: _, ...userData } = user;
    res.status(201).json({ success: true, data: { ...userData, vehicle: vehicleData, membership } });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'El email ya está registrado' });
    next(err);
  }
});

// POST /api/auth/public-register — Public self-registration (from shared link)
router.post('/public-register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, vehicle, referralCode } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Completá todos los campos' });
    }
    // ── Password strength ────────────────────────────────────────────────
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ success: false, message: 'La contraseña debe incluir al menos una letra y un número' });
    }
    // ── Email format ─────────────────────────────────────────────────────
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Formato de email inválido' });
    }

    const exists = await req.prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ success: false, message: 'El email ya está registrado. Intentá iniciar sesión.' });

    const passwordHash = await bcrypt.hash(password, 12);

    // Escrituras de BD atómicas: user + vehicle + referral. Si algo falla a mitad, se revierte
    // todo. El sync con ARIZAR (HTTP) se ejecuta DESPUÉS del commit (best-effort).
    let referrerToNotify = null;
    const user = await req.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, firstName, lastName, phone: phone || null, role: 'CLIENT' }
      });

      // Vehicle
      if (vehicle && vehicle.brand && vehicle.model) {
        await tx.vehicle.create({
          data: {
            userId: user.id, brand: vehicle.brand, model: vehicle.model,
            year: vehicle.year || new Date().getFullYear(),
            color: vehicle.color || '', licensePlate: vehicle.licensePlate || '',
            isPrimary: true,
          }
        });
      }

      // Referral (parte de BD dentro de la transacción)
      if (referralCode) {
        const referral = await tx.referral.findFirst({ where: { code: referralCode, status: 'PENDING' } });
        if (referral) {
          await tx.referral.update({ where: { id: referral.id }, data: { referredId: user.id, status: 'COMPLETED', completedAt: new Date() } });
          referrerToNotify = await tx.user.findUnique({ where: { id: referral.referrerId } });
        }
      }

      return user;
    });

    // ─── best-effort fuera de la transacción ───
    const sync = new ArizarSync(req.prisma);

    // Notify referrer (HTTP externo)
    if (referrerToNotify) {
      try {
        await sync.syncReferral(referrerToNotify, user);
      } catch (e) { /* silent */ }
    }

    // ═══ ARIZAR IA SYNC ═══
    try {
      await sync.syncUserRegistration(user);
    } catch (e) { console.error('Error sincronizando con ARIZAR:', e.message); }

    // Auto-login
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });

    const { passwordHash: _, ...userData } = user;
    res.status(201).json({ success: true, data: { token, user: userData }, message: '¡Cuenta creada exitosamente!' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'El email ya está registrado. Intentá iniciar sesión.' });
    next(err);
  }
});

// POST /api/auth/admin-create — Admin/Employee creates a client (syncs to CRM)
router.post('/admin-create', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'), async (req, res, next) => {
  try {
    const { email, firstName, lastName, phone, planId, vehicleBrand, vehicleModel, vehicleYear, vehicleColor, vehiclePlate, sendWhatsApp: doSendWA } = req.body;
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Email, nombre y apellido son requeridos' });
    }

    const exists = await req.prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ success: false, message: 'El email ya está registrado' });

    // Validar plan (si vino) antes de abrir la transacción.
    let planRecord = null;
    if (planId) {
      planRecord = await req.prisma.plan.findUnique({ where: { id: planId } });
    }

    // Aprovisionamiento atómico: user + vehicle + membership + audit. Si algo falla a mitad,
    // se revierte todo. El sync con ARIZAR (HTTP) y el WhatsApp van DESPUÉS del commit (best-effort).
    const { user, vehicle, membership, tempPassword } = await provisionClient(req.prisma, {
      email, firstName, lastName, phone,
      plan: planRecord,
      vehicle: (vehicleBrand && vehicleModel)
        ? { brand: vehicleBrand, model: vehicleModel, year: vehicleYear, color: vehicleColor, licensePlate: vehiclePlate }
        : null,
    }, req.user.id);

    // ─── best-effort fuera de la transacción ───
    // ═══ ARIZAR IA SYNC ═══
    let contactId = null;
    try {
      const sync = new ArizarSync(req.prisma);
      contactId = await sync.syncUserRegistration(user, membership?.plan);
    } catch (e) { console.error('Error sincronizando con ARIZAR:', e.message); }

    // Send credentials via WhatsApp if requested
    if (doSendWA && contactId && phone) {
      try {
        const arizarService = require('../services/arizarService');
        await arizarService.sendWhatsApp(contactId,
          `🚗 ¡Hola ${firstName}! Bienvenido a Luxury Garage\n\n` +
          `Te creamos una cuenta en nuestro portal premium:\n\n` +
          `📧 Email: ${email}\n` +
          `🔑 Contraseña: ${tempPassword}\n\n` +
          `Accedé acá: https://luxurygarage.arizar-ia.cloud/login\n\n` +
          `Desde ahí podés agendar turnos, ver tu membresía y más. 💎`
        );
      } catch (e) { console.error('Error enviando credenciales por WhatsApp:', e.message); }
    }

    const { passwordHash: _, ...userData } = user;
    // Nota: tempPassword NO se devuelve en la respuesta HTTP por seguridad
    // Se envía solo por WhatsApp/Email (ver líneas anteriores)
    res.status(201).json({
      success: true,
      data: { ...userData, vehicle, membership, arizarContactId: contactId },
      message: `Cliente creado${doSendWA ? ' y credenciales enviadas por WhatsApp' : ''}`
    });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'El email ya está registrado' });
    next(err);
  }
});

// GET /api/auth/registration-link — Generate shareable registration link
router.get('/registration-link', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'), async (req, res) => {
  const baseUrl = 'https://luxurygarage.arizar-ia.cloud';
  const link = `${baseUrl}/register`;

  // Get referral code for the requesting employee/admin
  let referralLink = link;
  const referral = await req.prisma.referral.findFirst({ where: { referrerId: req.user.id, status: 'PENDING' } });
  if (referral) {
    referralLink = `${link}?ref=${referral.code}`;
  }

  res.json({
    success: true,
    data: {
      registrationLink: link,
      referralLink,
      whatsappMessage: `🚗 ¡Registrate en Luxury Garage!\n\nCreá tu cuenta gratis y accedé a nuestros planes de membresía premium:\n\n${link}\n\n✨ Beneficios: Lavados ilimitados, agenda prioritaria, descuentos exclusivos y más.\n\n¿Consultas? Respondé a este mensaje.`,
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        memberships: { where: { status: 'ACTIVE' }, include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        vehicles: { where: { isPrimary: true }, take: 1 }
      }
    });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const { passwordHash, ...userData } = user;
    res.json({ success: true, data: userData });
  } catch (err) { next(err); }
});

// PUT /api/auth/me — Update profile (syncs to CRM)
router.put('/me', authenticate, async (req, res, next) => {
  try {
    const { firstName, lastName, phone, avatarUrl } = req.body;
    const user = await req.prisma.user.update({
      where: { id: req.user.id },
      // phone usa `!== undefined` (no truthy) para permitir vaciarlo: enviar null/'' borra el teléfono.
      data: { ...(firstName && { firstName }), ...(lastName && { lastName }), ...(phone !== undefined && { phone: phone || null }), ...(avatarUrl !== undefined && { avatarUrl }) }
    });

    // ═══ ARIZAR IA SYNC ═══
    if (user.arizarContactId) {
      const sync = new ArizarSync(req.prisma);
      await sync.syncProfileUpdate(user);
    }

    const { passwordHash, ...userData } = user;
    res.json({ success: true, data: userData });
  } catch (err) { next(err); }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe incluir al menos una mayúscula' });
    }
    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe incluir al menos un número' });
    }
    const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
    // Si el JWT referencia un usuario ya borrado, evitamos un 500 en bcrypt.compare(.., undefined).
    if (!user) return res.status(401).json({ success: false, message: 'Usuario no encontrado o sesión inválida' });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ success: false, message: 'Contraseña actual incorrecta' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await req.prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (err) { next(err); }
});

module.exports = router;
