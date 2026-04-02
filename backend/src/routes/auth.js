const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate, authorize } = require('../middleware/auth');
const { authLimiter, loginLockout } = require('../middleware/security');
const ArizarSync = require('../services/arizarSync');

// Apply strict rate limiter on all auth write endpoints
router.post('/login', authLimiter);
router.post('/public-register', authLimiter);


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
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { passwordHash, ...userData } = user;
    res.json({ success: true, data: { token, user: userData } });
  } catch (err) { next(err); }
});


// POST /api/auth/register — Internal (webhook/admin) registration
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, role, arizarContactId, vehicle, planId, referralCode, sendCredentials } = req.body;
    if (!email || !password || !firstName || !lastName) return res.status(400).json({ success: false, message: 'Campos requeridos: email, password, firstName, lastName' });

    const exists = await req.prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ success: false, message: 'El email ya está registrado' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await req.prisma.user.create({
      data: { email, passwordHash, firstName, lastName, phone: phone || null, role: role || 'CLIENT', arizarContactId: arizarContactId || null }
    });

    // Vehicle
    let vehicleData = null;
    if (vehicle && vehicle.brand && vehicle.model) {
      vehicleData = await req.prisma.vehicle.create({
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
    if (planId) {
      const plan = await req.prisma.plan.findUnique({ where: { id: planId } });
      if (plan) {
        const start = new Date();
        const end = new Date(); end.setMonth(end.getMonth() + 1);
        membership = await req.prisma.membership.create({
          data: { userId: user.id, planId: plan.id, status: 'ACTIVE', startDate: start, endDate: end },
          include: { plan: true }
        });
      }
    }

    // Process referral code
    if (referralCode) {
      try {
        const referral = await req.prisma.referral.findFirst({ where: { code: referralCode, status: 'PENDING' } });
        if (referral) {
          await req.prisma.referral.update({ where: { id: referral.id }, data: { referredId: user.id, status: 'COMPLETED', completedAt: new Date() } });
          // Notify referrer
          const referrer = await req.prisma.user.findUnique({ where: { id: referral.referrerId } });
          if (referrer) {
            const sync = new ArizarSync(req.prisma);
            await sync.syncReferral(referrer, user);
          }
        }
      } catch (e) { console.error('Error procesando referido:', e.message); }
    }

    // ═══ ARIZAR IA SYNC ═══
    const sync = new ArizarSync(req.prisma);
    const plan = membership?.plan || null;
    const contactId = await sync.syncUserRegistration(user, plan);

    // Send credentials if requested (from admin creation)
    if (sendCredentials && contactId) {
      const arizarService = require('../services/arizarService');
      await arizarService.sendWhatsApp(contactId,
        `🚗 ¡Bienvenido a Luxury Garage, ${firstName}!\n\n` +
        `Tu cuenta ha sido creada:\n` +
        `📧 Email: ${email}\n` +
        `🔑 Contraseña: ${password}\n\n` +
        `Accedé a tu portal: https://luxurygarage.arizar-ia.cloud/login`
      );
    }

    const { passwordHash: _, ...userData } = user;
    res.status(201).json({ success: true, data: { ...userData, vehicle: vehicleData, membership } });
  } catch (err) { next(err); }
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
    const user = await req.prisma.user.create({
      data: { email, passwordHash, firstName, lastName, phone: phone || null, role: 'CLIENT' }
    });

    // Vehicle
    if (vehicle && vehicle.brand && vehicle.model) {
      await req.prisma.vehicle.create({
        data: {
          userId: user.id, brand: vehicle.brand, model: vehicle.model,
          year: vehicle.year || new Date().getFullYear(),
          color: vehicle.color || '', licensePlate: vehicle.licensePlate || '',
          isPrimary: true,
        }
      });
    }

    // Referral
    if (referralCode) {
      try {
        const referral = await req.prisma.referral.findFirst({ where: { code: referralCode, status: 'PENDING' } });
        if (referral) {
          await req.prisma.referral.update({ where: { id: referral.id }, data: { referredId: user.id, status: 'COMPLETED', completedAt: new Date() } });
          const referrer = await req.prisma.user.findUnique({ where: { id: referral.referrerId } });
          if (referrer) {
            const sync = new ArizarSync(req.prisma);
            await sync.syncReferral(referrer, user);
          }
        }
      } catch (e) { /* silent */ }
    }

    // ═══ ARIZAR IA SYNC ═══
    const sync = new ArizarSync(req.prisma);
    await sync.syncUserRegistration(user);

    // Auto-login
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    const { passwordHash: _, ...userData } = user;
    res.status(201).json({ success: true, data: { token, user: userData }, message: '¡Cuenta creada exitosamente!' });
  } catch (err) { next(err); }
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

    // Generate temporary password
    const tempPassword = firstName.substring(0, 3) + Math.random().toString(36).slice(-5) + '!1';
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await req.prisma.user.create({
      data: { email, passwordHash, firstName, lastName, phone: phone || null, role: 'CLIENT' }
    });

    // Vehicle
    let vehicle = null;
    if (vehicleBrand && vehicleModel) {
      vehicle = await req.prisma.vehicle.create({
        data: {
          userId: user.id, brand: vehicleBrand, model: vehicleModel,
          year: vehicleYear || new Date().getFullYear(),
          color: vehicleColor || '', licensePlate: vehiclePlate || '', isPrimary: true,
        }
      });
    }

    // Plan
    let membership = null;
    if (planId) {
      const plan = await req.prisma.plan.findUnique({ where: { id: planId } });
      if (plan) {
        const start = new Date();
        const end = new Date(); end.setMonth(end.getMonth() + 1);
        membership = await req.prisma.membership.create({
          data: { userId: user.id, planId: plan.id, status: 'ACTIVE', startDate: start, endDate: end },
          include: { plan: true }
        });
      }
    }

    // ═══ ARIZAR IA SYNC ═══
    const sync = new ArizarSync(req.prisma);
    const contactId = await sync.syncUserRegistration(user, membership?.plan);

    // Send credentials via WhatsApp if requested
    if (doSendWA && contactId && phone) {
      const arizarService = require('../services/arizarService');
      await arizarService.sendWhatsApp(contactId,
        `🚗 ¡Hola ${firstName}! Bienvenido a Luxury Garage\n\n` +
        `Te creamos una cuenta en nuestro portal premium:\n\n` +
        `📧 Email: ${email}\n` +
        `🔑 Contraseña: ${tempPassword}\n\n` +
        `Accedé acá: https://luxurygarage.arizar-ia.cloud/login\n\n` +
        `Desde ahí podés agendar turnos, ver tu membresía y más. 💎`
      );
    }

    // Audit
    await req.prisma.auditLog.create({
      data: { entity: 'user', action: 'admin_create', entityId: user.id, userId: req.user.id, details: { createdBy: req.user.email, clientEmail: email, plan: membership?.plan?.name, sentWhatsApp: !!doSendWA } }
    });

    const { passwordHash: _, ...userData } = user;
    // Nota: tempPassword NO se devuelve en la respuesta HTTP por seguridad
    // Se envía solo por WhatsApp/Email (ver líneas anteriores)
    res.status(201).json({
      success: true,
      data: { ...userData, vehicle, membership, arizarContactId: contactId },
      message: `Cliente creado${doSendWA ? ' y credenciales enviadas por WhatsApp' : ''}`
    });
  } catch (err) { next(err); }
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
      data: { ...(firstName && { firstName }), ...(lastName && { lastName }), ...(phone && { phone }), ...(avatarUrl !== undefined && { avatarUrl }) }
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
    const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ success: false, message: 'Contraseña actual incorrecta' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await req.prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (err) { next(err); }
});

module.exports = router;
