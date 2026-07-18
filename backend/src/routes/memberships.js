const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ArizarSync = require('../services/arizarSync');
const { evaluatePlanChange, computeMembershipCharge, DOWNGRADE_MSG } = require('../services/membershipRules');

const adminOnly = [authenticate, authorize('SUPER_ADMIN', 'ADMIN')];

// Reemplaza la membresía activa de un usuario por una nueva con el plan dado (override del admin).
async function setUserPlan(prisma, userId, planId) {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) { const e = new Error('Plan no encontrado'); e.statusCode = 404; throw e; }
  await prisma.membership.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'REPLACED' } });
  const start = new Date(); const end = new Date(); end.setMonth(end.getMonth() + 1);
  return prisma.membership.create({
    data: { userId, planId, status: 'ACTIVE', startDate: start, endDate: end },
    include: { plan: true },
  });
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const memberships = await req.prisma.membership.findMany({ where: { userId: req.user.id }, include: { plan: true }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: memberships });
  } catch (err) { next(err); }
});

// Membresía ACTIVA del usuario (single object o null). La usa la página de Planes.
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const membership = await req.prisma.membership.findFirst({
      where: { userId: req.user.id, status: 'ACTIVE' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: membership });
  } catch (err) { next(err); }
});

// GET /api/memberships/upgrade-quote?planId=xxx — cotización de cambio de plan.
// Devuelve el monto EXACTO que se va a cobrar (prorrateado si es un upgrade a mitad de ciclo)
// para que el modal de pago muestre la cifra real. Es READ-ONLY (no cobra ni activa nada).
// La fuente de verdad del cobro sigue siendo /payments/charge-membership, que RE-CALCULA.
router.get('/upgrade-quote', authenticate, async (req, res, next) => {
  try {
    const planId = req.query.planId;
    if (!planId) return res.status(400).json({ success: false, message: 'planId requerido' });
    const targetPlan = await req.prisma.plan.findUnique({ where: { id: String(planId) } });
    if (!targetPlan) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

    const change = await evaluatePlanChange(req.prisma, req.user.id, targetPlan);
    const charge = computeMembershipCharge({
      activeMembership: change.membership || null,
      currentPlan: change.currentPlan || null,
      targetPlan,
    });

    res.json({
      success: true,
      data: {
        planId: targetPlan.id,
        planName: targetPlan.name,
        fullPrice: targetPlan.priceGs,
        currentPrice: charge.currentPrice,
        amountGs: charge.amountGs,
        prorated: charge.prorated,
        creditApplied: charge.creditApplied,
        daysRemaining: charge.daysRemaining,
        keepEndDate: charge.keepEndDate,
        isUpgrade: change.hasActive && !change.samePlan && (targetPlan.priceGs > (change.currentPlan?.priceGs ?? 0)),
        isRenewal: change.samePlan === true,
        samePlan: change.samePlan === true,
        allowed: change.allowed,
        currentPlanName: change.currentPlan?.name || null,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/memberships/pending-payment — ¿el usuario tiene un cobro de MEMBRESÍA pendiente?
// READ-ONLY: NO crea ni muta estados. Deriva de datos existentes (BancardOperation/Payment PENDING).
// Sirve para mostrarle al cliente un banner "tenés un pago pendiente" y que lo complete.
router.get('/pending-payment', authenticate, async (req, res, next) => {
  try {
    // Si ya tiene una membresía ACTIVE, no hay nada pendiente que mostrar.
    const active = await req.prisma.membership.findFirst({
      where: { userId: req.user.id, status: 'ACTIVE' },
      select: { id: true },
    });
    if (active) return res.json({ success: true, data: { hasPending: false } });

    // Traemos las operaciones 'charge' PENDING (excluyendo top-ups por kind) y filtramos en JS
    // las que sean de MEMBRESÍA: tienen planId en metadataJson (flujo /charge-membership) o
    // isAutoRenewal (renovación). Filtrar en JS evita ambigüedades del JSON-path-not-null de Prisma.
    // Los overages (Payment description 'overage:*') no generan op 'charge' con planId → quedan afuera.
    const candidates = await req.prisma.bancardOperation.findMany({
      where: {
        userId: req.user.id,
        type: 'charge',
        status: 'PENDING',
        NOT: { metadataJson: { path: ['kind'], equals: 'topup' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const op = candidates.find((o) => {
      const m = o.metadataJson || {};
      return (m.planId != null && m.planId !== '') || m.isAutoRenewal === true;
    });

    if (!op) return res.json({ success: true, data: { hasPending: false } });

    // Resolver el nombre del plan: preferimos el guardado en metadata; si no, lo buscamos por planId.
    const meta = op.metadataJson || {};
    let planName = meta.planName || null;
    if (!planName && meta.planId) {
      const plan = await req.prisma.plan.findUnique({ where: { id: meta.planId }, select: { name: true } });
      planName = plan?.name || null;
    }

    const since = op.createdAt;
    const stale = (Date.now() - new Date(since).getTime()) > 24 * 60 * 60 * 1000;

    res.json({
      success: true,
      data: {
        hasPending: true,
        planName,
        amountGs: op.amountGs ?? null,
        since,
        stale,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/memberships/upgrade — valida el cambio de plan y deriva al flujo de pago Bancard.
// SEGURIDAD: este endpoint NO activa la membresía ni la cancela. Activar una membresía sin un
// pago Bancard APPROVED era una puerta trasera. La activación ocurre SOLO tras el cobro real
// en POST /api/payments/charge-membership (o /charge-3ds-complete / webhook).
router.post('/upgrade', authenticate, async (req, res, next) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: 'planId requerido' });
    const targetPlan = await req.prisma.plan.findUnique({ where: { id: planId } });
    if (!targetPlan) return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    // Bloqueo de baja: no se puede pasar a un plan más barato sin autorización del admin.
    const change = await evaluatePlanChange(req.prisma, req.user.id, targetPlan);
    if (!change.allowed) return res.status(403).json({ success: false, code: 'DOWNGRADE_BLOCKED', message: DOWNGRADE_MSG });

    // Cambio válido → derivar al cobro Bancard. La membresía se activa al confirmarse el pago.
    res.json({
      success: true,
      requiresPayment: true,
      data: {
        planId: targetPlan.id,
        planName: targetPlan.name,
        priceGs: targetPlan.priceGs,
        isUpgrade: change.hasActive && !change.samePlan,
        isRenewal: change.samePlan === true,
      },
      message: 'Confirmá el pago para activar el plan.',
    });
  } catch (err) { next(err); }
});

router.post('/cancel', authenticate, async (req, res, next) => {
  try {
    const current = await req.prisma.membership.findFirst({
      where: { userId: req.user.id, status: 'ACTIVE' },
      include: { plan: true }
    });
    if (!current) return res.status(404).json({ success: false, message: 'No tenés membresía activa' });
    const membership = await req.prisma.membership.update({ where: { id: current.id }, data: { autoRenew: false } });

    // ── ARIZAR IA SYNC ──────────────────────────────────────────
    try {
      const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
      if (user?.arizarContactId) {
        const sync = new ArizarSync(req.prisma);
        await sync.syncMembershipExpired(user, { ...current, plan: current.plan });
        console.log(`✅ ARIZAR: Membresía cancelada sincronizada para ${user.email}`);
      }
    } catch (e) { console.error('ARIZAR sync error (cancel):', e.message); }
    // ────────────────────────────────────────────────────────────

    res.json({ success: true, data: membership, message: 'Tu membresía no se renovará automáticamente' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  ADMIN — Panel de gestión de membresías
// ════════════════════════════════════════════════════════════════

// GET /api/memberships/admin/list — todas las membresías ACTIVAS (con cliente y plan)
router.get('/admin/list', ...adminOnly, async (req, res, next) => {
  try {
    const memberships = await req.prisma.membership.findMany({
      where: { status: 'ACTIVE' },
      include: {
        plan: { select: { id: true, name: true, priceGs: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: memberships });
  } catch (err) { next(err); }
});

// POST /api/memberships/admin/change-plan — el admin cambia el plan de un cliente (cualquier dirección, incluye baja)
router.post('/admin/change-plan', ...adminOnly, async (req, res, next) => {
  try {
    const { userId, planId } = req.body;
    if (!userId || !planId) return res.status(400).json({ success: false, message: 'userId y planId requeridos' });
    const membership = await setUserPlan(req.prisma, userId, planId);
    await req.prisma.auditLog.create({
      data: { userId: req.user.id, action: 'ADMIN_CHANGE_PLAN', entity: 'Membership', entityId: membership.id, detailsJson: { targetUserId: userId, planId } },
    });
    res.json({ success: true, data: membership, message: 'Plan del cliente actualizado' });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
});

// POST /api/memberships/admin/authorize-downgrade — habilita/revoca que un cliente baje de plan (1 uso)
router.post('/admin/authorize-downgrade', ...adminOnly, async (req, res, next) => {
  try {
    const { userId, allowed = true } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId requerido' });
    const current = await req.prisma.membership.findFirst({ where: { userId, status: 'ACTIVE' } });
    if (!current) return res.status(404).json({ success: false, message: 'El cliente no tiene membresía activa' });
    const membership = await req.prisma.membership.update({
      where: { id: current.id }, data: { downgradeAllowed: !!allowed }, include: { plan: true },
    });
    await req.prisma.auditLog.create({
      data: { userId: req.user.id, action: allowed ? 'AUTHORIZE_DOWNGRADE' : 'REVOKE_DOWNGRADE', entity: 'Membership', entityId: membership.id, detailsJson: { targetUserId: userId } },
    });
    res.json({ success: true, data: membership, message: allowed ? 'Baja de plan habilitada para el cliente' : 'Habilitación de baja revocada' });
  } catch (err) { next(err); }
});

// POST /api/memberships/admin/cancel — el admin cancela la membresía activa de un cliente
router.post('/admin/cancel', ...adminOnly, async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId requerido' });
    const current = await req.prisma.membership.findFirst({ where: { userId, status: 'ACTIVE' } });
    if (!current) return res.status(404).json({ success: false, message: 'El cliente no tiene membresía activa' });
    const membership = await req.prisma.membership.update({ where: { id: current.id }, data: { status: 'CANCELLED' } });
    res.json({ success: true, data: membership, message: 'Membresía cancelada' });
  } catch (err) { next(err); }
});

module.exports = router;
