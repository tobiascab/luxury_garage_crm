const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

// Valida fuerza de contraseña: >=8 chars, >=1 mayúscula, >=1 número.
function validatePasswordStrength(pwd) {
  if (!pwd || typeof pwd !== 'string' || pwd.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }
  if (!/[A-Z]/.test(pwd)) return 'La contraseña debe incluir al menos una mayúscula';
  if (!/[0-9]/.test(pwd)) return 'La contraseña debe incluir al menos un número';
  return null;
}

// Jerarquía de roles: impide que un usuario actúe sobre pares o superiores
// (p.ej. que un ADMIN resetee/elimine/edite a un SUPER_ADMIN u otro ADMIN).
const ROLE_RANK = { CLIENT: 0, EMPLOYEE: 1, ADMIN: 2, SUPER_ADMIN: 3 };

// `actor` puede gestionar a `target` solo si es estrictamente de mayor rango,
// o si es su propia cuenta. Usar antes de password/edit/delete/status sobre otros.
function canManageTarget(actor, target) {
  if (!actor || !target) return false;
  if (target.id === actor.id) return true; // acciones sobre la propia cuenta
  return (ROLE_RANK[actor.role] ?? -1) > (ROLE_RANK[target.role] ?? 0);
}

router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { status, plan, search, role, page = 1, limit = 20 } = req.query;
    if (search && search.length > 100) {
      return res.status(400).json({ success: false, message: 'Búsqueda demasiado larga' });
    }
    const sanitizedSearch = search?.trim().slice(0, 100);
    const VALID_ROLES = ['CLIENT', 'EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'];
    const where = { role: VALID_ROLES.includes(role) ? role : 'CLIENT' };
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (plan) where.memberships = { some: { status: 'ACTIVE', planId: plan } };
    if (sanitizedSearch) { where.OR = [{ firstName: { contains: sanitizedSearch, mode: 'insensitive' } }, { lastName: { contains: sanitizedSearch, mode: 'insensitive' } }, { email: { contains: sanitizedSearch, mode: 'insensitive' } }, { phone: { contains: sanitizedSearch } }]; }

    const [members, total] = await Promise.all([
      req.prisma.user.findMany({
        where, include: { memberships: { where: { status: 'ACTIVE' }, include: { plan: true }, take: 1 }, vehicles: true, _count: { select: { appointments: true, reviews: true } } },
        skip: (page - 1) * limit, take: parseInt(limit), orderBy: { createdAt: 'desc' }
      }),
      req.prisma.user.count({ where })
    ]);
    res.json({ success: true, data: members.map(m => { const { passwordHash, ...u } = m; return u; }), pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

router.get('/stats', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const [total, active, newThisMonth, byPlan] = await Promise.all([
      req.prisma.user.count({ where: { role: 'CLIENT' } }),
      req.prisma.membership.count({ where: { status: 'ACTIVE' } }),
      req.prisma.user.count({ where: { role: 'CLIENT', createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
      req.prisma.membership.groupBy({ by: ['planId'], where: { status: 'ACTIVE' }, _count: true }),
    ]);
    res.json({ success: true, data: { total, active, newThisMonth, byPlan } });
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const member = await req.prisma.user.findUnique({
      where: { id: req.params.id },
      include: { memberships: { include: { plan: true }, orderBy: { createdAt: 'desc' } }, vehicles: true, appointments: { include: { service: true }, orderBy: { date: 'desc' }, take: 10 }, payments: { orderBy: { createdAt: 'desc' }, take: 10 }, reviews: { orderBy: { createdAt: 'desc' }, take: 5 } }
    });
    if (!member) return res.status(404).json({ success: false, message: 'Miembro no encontrado' });
    const { passwordHash, ...userData } = member;
    res.json({ success: true, data: userData });
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    const { email, firstName, lastName, phone, planId } = req.body;
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Email, nombre y apellido son requeridos' });
    }
    // Validar plan (si vino) antes de crear nada, fuera de la transacción.
    let plan = null;
    if (planId) {
      plan = await req.prisma.plan.findUnique({ where: { id: planId } });
    }
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    // user + membership atómicos: si falla el create de la membresía no queda usuario huérfano.
    const user = await req.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email, passwordHash, firstName, lastName, phone, role: 'CLIENT' } });
      if (plan) {
        // El plan que elige el admin queda PENDING, NO activo: la membresía se activa recién
        // cuando el cliente entra, carga su tarjeta y se le debita (cobro por adelantado).
        // Una membresía PENDING es inerte en todo el sistema (cobertura, cupos, renovación y
        // reportes filtran por status ACTIVE), así que no da beneficios hasta estar paga.
        const start = new Date();
        const end = new Date(); end.setMonth(end.getMonth() + 1);
        await tx.membership.create({ data: { userId: created.id, planId: plan.id, status: 'PENDING', startDate: start, endDate: end } });
      }
      return created;
    });
    const { passwordHash: _, ...userData } = user;
    res.status(201).json({ success: true, data: { ...userData, tempPassword } });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'El email ya está registrado' });
    next(err);
  }
});

// Crear un empleado (EMPLOYEE). Solo admins; el rol ADMIN requiere SUPER_ADMIN.
router.post('/staff', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    const { email, firstName, lastName, phone, password, role } = req.body;
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Email, nombre y apellido son requeridos' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Formato de email inválido' });
    }
    const strengthError = validatePasswordStrength(password);
    if (strengthError) return res.status(400).json({ success: false, message: strengthError });

    const targetRole = role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE';
    if (targetRole === 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Solo un Super Admin puede crear administradores' });
    }

    const exists = await req.prisma.user.findUnique({ where: { email: cleanEmail } });
    if (exists) return res.status(409).json({ success: false, message: 'El email ya está registrado' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await req.prisma.user.create({
      data: { email: cleanEmail, passwordHash, firstName: String(firstName).trim(), lastName: String(lastName).trim(), phone: phone ? String(phone).trim() : null, role: targetRole }
    });

    await req.prisma.auditLog.create({
      data: { entity: 'user', action: 'create_staff', entityId: user.id, userId: req.user.id, detailsJson: { by: req.user.email, email: cleanEmail, role: targetRole } }
    }).catch(() => {});

    const { passwordHash: _, ...userData } = user;
    res.status(201).json({ success: true, data: userData });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'El email ya está registrado' });
    next(err);
  }
});

// Editar datos básicos de un usuario (cliente o empleado)
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const target = await req.prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (!canManageTarget(req.user, target)) {
      return res.status(403).json({ success: false, message: 'No podés editar un usuario con privilegios iguales o superiores' });
    }
    const { firstName, lastName, phone, email, documentNumber, documentType, role } = req.body;
    const data = {};
    if (firstName !== undefined) {
      if (!String(firstName).trim()) return res.status(400).json({ success: false, message: 'El nombre no puede estar vacío' });
      data.firstName = String(firstName).trim();
    }
    if (lastName !== undefined) {
      if (!String(lastName).trim()) return res.status(400).json({ success: false, message: 'El apellido no puede estar vacío' });
      data.lastName = String(lastName).trim();
    }
    if (phone !== undefined) data.phone = phone ? String(phone).trim() : null;
    if (email !== undefined) {
      const e = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ success: false, message: 'Formato de email inválido' });
      data.email = e;
    }
    if (documentNumber !== undefined) data.documentNumber = documentNumber ? String(documentNumber).trim() : null;
    if (documentType !== undefined) data.documentType = documentType ? String(documentType).trim() : null;
    // Cambio de rol: solo SUPER_ADMIN puede asignar ADMIN/SUPER_ADMIN; nadie cambia su propio rol.
    if (role !== undefined) {
      const VALID = ['CLIENT', 'EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'];
      if (!VALID.includes(role)) return res.status(400).json({ success: false, message: 'Rol no válido' });
      if (req.params.id === req.user.id) return res.status(400).json({ success: false, message: 'No puedes cambiar tu propio rol' });
      if ((role === 'ADMIN' || role === 'SUPER_ADMIN') && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, message: 'Solo un Super Admin puede asignar roles administrativos' });
      }
      data.role = role;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'Nada para actualizar' });
    }
    const user = await req.prisma.user.update({ where: { id: req.params.id }, data });
    await req.prisma.auditLog.create({
      data: { entity: 'user', action: 'update', entityId: user.id, userId: req.user.id, detailsJson: { fields: Object.keys(data), by: req.user.email } }
    }).catch(() => {});
    const { passwordHash, ...userData } = user;
    res.json({ success: true, data: userData });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'Ese correo ya está en uso por otro usuario' });
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    next(err);
  }
});

// Resetear/cambiar la contraseña de OTRO usuario (admin no conoce la actual).
// Convención fija del contrato: PUT /api/members/:id/password { newPassword, sendCredentials? }
router.put('/:id/password', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    const { newPassword, sendCredentials } = req.body;
    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) return res.status(400).json({ success: false, message: strengthError });

    const target = await req.prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (!canManageTarget(req.user, target)) {
      return res.status(403).json({ success: false, message: 'No podés modificar la contraseña de un usuario con privilegios iguales o superiores' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await req.prisma.user.update({ where: { id: target.id }, data: { passwordHash } });

    await req.prisma.auditLog.create({
      data: { entity: 'user', action: 'RESET_PASSWORD', entityId: target.id, userId: req.user.id, detailsJson: { by: req.user.email, target: target.email, sentCredentials: !!sendCredentials } }
    }).catch(() => {});

    // Reenvío opcional de credenciales. Por correo va siempre que se pida (el correo es
    // obligatorio); el WhatsApp solo si el contacto está sincronizado en el CRM.
    let enviadoPorCorreo = false;
    if (sendCredentials) {
      const emailService = require('../services/emailService');
      const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://luxurygarage.arizar-ia.cloud';
      const r = await emailService.send({
        to: target.email,
        subject: 'Tu contraseña de Luxury Garage fue restablecida',
        html: `<!doctype html><html lang="es"><body style="margin:0;padding:32px 16px;background:#F4F2ED;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:10px;overflow:hidden;">
            <tr><td style="background:#141210;padding:22px 28px;"><div style="color:#C9A227;font-size:15px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">Luxury Garage</div></td></tr>
            <tr><td style="padding:32px 28px;">
              <h1 style="margin:0 0 16px;font-size:21px;color:#141210;">Tu contraseña fue restablecida</h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3D3831;">Hola ${String(target.firstName || '').replace(/[<>&"']/g, '')}, un administrador generó una contraseña nueva para tu cuenta:</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#F7F5F0;border-radius:8px;margin:0 0 16px;"><tr><td style="padding:16px 18px;">
                <p style="margin:0;font-size:17px;color:#141210;font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace;">${String(newPassword).replace(/[<>&"']/g, '')}</p>
              </td></tr></table>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#3D3831;">Entrá con ella y cambiala desde tu perfil apenas puedas.</p>
              <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#141210;border-radius:6px;">
                <a href="${appUrl}/login" style="display:inline-block;padding:13px 26px;color:#C9A227;font-size:14px;font-weight:700;text-decoration:none;">Entrar a mi cuenta</a>
              </td></tr></table>
            </td></tr>
            <tr><td style="padding:18px 28px;border-top:1px solid #EAE6DD;"><p style="margin:0;font-size:12px;color:#8A8175;">Si no pediste este cambio, avisanos respondiendo este correo.</p></td></tr>
          </table></td></tr></table></body></html>`,
      });
      enviadoPorCorreo = r.ok;

      if (target.arizarContactId && target.phone) {
        try {
          const arizarService = require('../services/arizarService');
          await arizarService.sendWhatsApp(target.arizarContactId,
            `🔐 Luxury Garage — Restablecimiento de contraseña\n\n` +
            `Hola ${target.firstName}, tu nueva contraseña es:\n` +
            `🔑 ${newPassword}\n\n` +
            `Ingresá en: ${appUrl}/login`
          );
        } catch (e) { console.error('Error enviando credenciales por WhatsApp:', e.message); }
      }
    }

    res.json({
      success: true,
      message: sendCredentials
        ? (enviadoPorCorreo ? 'Contraseña actualizada y enviada por correo' : 'Contraseña actualizada, pero NO se pudo enviar el correo. Pasásela vos.')
        : 'Contraseña actualizada',
    });
  } catch (err) { next(err); }
});

// ── Gestión de membresía de un usuario (admin actuando sobre otro cliente) ──
// Asignar / cambiar de plan. Cancela la membresía ACTIVE previa y crea una nueva.
router.post('/:id/membership', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { planId, months } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: 'planId requerido' });

    const [user, plan] = await Promise.all([
      req.prisma.user.findUnique({ where: { id: req.params.id } }),
      req.prisma.plan.findUnique({ where: { id: planId } }),
    ]);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (!plan) return res.status(400).json({ success: false, message: 'Plan no válido' });

    const durationMonths = Number.isInteger(months) && months > 0 ? months : 1;
    const start = new Date();
    const end = new Date(); end.setMonth(end.getMonth() + durationMonths);

    // Cancelar la membresía activa previa y crear la nueva de forma atómica:
    // si el create falla, el cliente no queda sin membresía activa (pierde cobertura).
    const membership = await req.prisma.$transaction(async (tx) => {
      await tx.membership.updateMany({
        where: { userId: user.id, status: { in: ['ACTIVE', 'PENDING'] } },
        data: { status: 'REPLACED' },
      });
      return tx.membership.create({
        data: { userId: user.id, planId: plan.id, status: 'ACTIVE', startDate: start, endDate: end },
        include: { plan: true },
      });
    });

    await req.prisma.auditLog.create({
      data: { entity: 'membership', action: 'admin_assign', entityId: membership.id, userId: req.user.id, detailsJson: { by: req.user.email, target: user.email, plan: plan.name, months: durationMonths } }
    }).catch(() => {});

    res.status(201).json({ success: true, data: membership });
  } catch (err) { next(err); }
});

// Cancelar la membresía activa de un usuario.
router.delete('/:id/membership', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const current = await req.prisma.membership.findFirst({ where: { userId: req.params.id, status: 'ACTIVE' } });
    if (!current) return res.status(404).json({ success: false, message: 'El cliente no tiene una membresía activa' });
    const membership = await req.prisma.membership.update({ where: { id: current.id }, data: { status: 'CANCELLED', autoRenew: false } });
    await req.prisma.auditLog.create({
      data: { entity: 'membership', action: 'admin_cancel', entityId: membership.id, userId: req.user.id, detailsJson: { by: req.user.email } }
    }).catch(() => {});
    res.json({ success: true, data: membership });
  } catch (err) { next(err); }
});

// Eliminar un usuario. Si tiene historial (registros de servicio u otras
// relaciones protegidas), se desactiva en vez de borrarse para preservar datos.
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'No puedes eliminar tu propia cuenta' });
    }
    const target = await req.prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (!canManageTarget(req.user, target)) {
      return res.status(403).json({ success: false, message: 'No podés eliminar a un usuario con privilegios iguales o superiores' });
    }
    await req.prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, softDeleted: false, message: 'Usuario eliminado' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    // P2003: clave foránea (p.ej. tiene registros de servicio) -> desactivar
    if (err.code === 'P2003' || err.code === 'P2014') {
      try {
        const user = await req.prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
        const { passwordHash, ...userData } = user;
        return res.json({ success: true, softDeleted: true, data: userData, message: 'El usuario tiene historial; se desactivó en lugar de borrarse' });
      } catch (e2) { return next(e2); }
    }
    next(err);
  }
});

router.put('/:id/status', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive debe ser un booleano' });
    }
    const target = await req.prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (!canManageTarget(req.user, target)) {
      return res.status(403).json({ success: false, message: 'No podés cambiar el estado de un usuario con privilegios iguales o superiores' });
    }
    const user = await req.prisma.user.update({ where: { id: req.params.id }, data: { isActive } });
    const { passwordHash, ...userData } = user;
    res.json({ success: true, data: userData });
  } catch (err) { next(err); }
});

module.exports = router;
