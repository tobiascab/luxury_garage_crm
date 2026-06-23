const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/credits — mi billetera (balance + historial)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [credits, total] = await Promise.all([
      req.prisma.credit.findMany({
        where: { userId: req.user.id },
        skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      req.prisma.credit.count({ where: { userId: req.user.id } }),
    ]);

    // Calculate balances
    const allCredits = await req.prisma.credit.findMany({
      where: { userId: req.user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });

    // Separate: referral credits vs wallet (loaded money)
    const referralBalance = allCredits.filter(c => c.type === 'REFERRAL_REWARD' || c.type === 'PROMOTION' || c.type === 'COMPENSATION').reduce((sum, c) => sum + c.amount, 0);
    const walletBalance = allCredits.filter(c => c.type === 'WALLET_TOPUP' || c.type === 'SHOP_PURCHASE' || c.type === 'WALLET_REFUND').reduce((sum, c) => sum + c.amount, 0);
    const totalBalance = allCredits.reduce((sum, c) => sum + c.amount, 0);

    res.json({
      success: true,
      data: {
        totalBalance,        // Balance total disponible
        walletBalance,       // Saldo cargado para shop/showroom
        referralBalance,     // Créditos de referidos y promos
        movements: credits,  // Historial de movimientos
      },
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
});

// POST /api/credits/topup — cargar saldo a la billetera
// SEGURIDAD: este endpoint NO acredita saldo gastable. Acreditar la billetera sin un
// pago real era una puerta trasera (cualquier cliente podía darse saldo). El camino
// legítimo para cargar saldo con tarjeta es POST /api/credits/topup-card (Bancard APPROVED).
// Para una carga por transferencia/efectivo, el cliente envía una SOLICITUD que un admin
// debe aprobar explícitamente (POST /api/credits/admin/approve-topup); recién ahí se acredita.
router.post('/topup', authenticate, async (req, res, next) => {
  try {
    const { amount, paymentMethod } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Monto inválido' });
    if (amount < 10000) return res.status(400).json({ success: false, message: 'Monto mínimo: ₲10.000' });

    // Registrar como solicitud PENDIENTE (no es saldo gastable hasta la aprobación del admin).
    const request = await req.prisma.bancardOperation.create({
      data: {
        shopProcessId: Date.now(),
        userId: req.user.id,
        type: 'wallet_topup_request',
        status: 'PENDING',
        amountGs: amount,
        metadataJson: { paymentMethod: paymentMethod || 'transferencia', requestedBy: req.user.id },
      },
    });

    res.status(202).json({
      success: true,
      data: { id: request.id, amount, status: 'PENDING' },
      message: 'Solicitud de recarga registrada. Un administrador la aprobará y se acreditará tu saldo. Para recarga inmediata, usá tu tarjeta.',
    });
  } catch (err) { next(err); }
});

// POST /api/credits/purchase — compra en el shop/showroom
router.post('/purchase', authenticate, async (req, res, next) => {
  try {
    const { amount, description, items } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Monto inválido' });
    if (!description) return res.status(400).json({ success: false, message: 'Descripción requerida' });

    let credit;
    let newBalance;

    await req.prisma.$transaction(async (tx) => {
      // Check balance inside transaction to prevent race conditions
      const allCredits = await tx.credit.findMany({
        where: { userId: req.user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      });
      const totalBalance = allCredits.reduce((sum, c) => sum + c.amount, 0);

      if (totalBalance < amount) {
        throw Object.assign(new Error(`Saldo insuficiente. Tenés ₲${totalBalance.toLocaleString()} disponibles`), { statusCode: 400 });
      }

      // Create negative credit (purchase)
      credit = await tx.credit.create({
        data: {
          userId: req.user.id,
          amount: -amount,
          type: 'SHOP_PURCHASE',
          description: description, // ej: "Café + Agua mineral"
        },
      });

      newBalance = totalBalance - amount;
    });

    res.json({
      success: true,
      data: credit,
      balance: newBalance,
      message: `Compra de ₲${amount.toLocaleString()} registrada. Saldo: ₲${newBalance.toLocaleString()}`,
    });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ success: false, message: err.message });
    next(err);
  }
});

// POST /api/credits/redeem — canjear créditos de referidos por servicio
router.post('/redeem', authenticate, async (req, res, next) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Monto inválido' });

    let credit;

    await req.prisma.$transaction(async (tx) => {
      const allCredits = await tx.credit.findMany({
        where: { userId: req.user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      });
      const totalBalance = allCredits.reduce((sum, c) => sum + c.amount, 0);

      if (totalBalance < amount) {
        throw Object.assign(new Error(`Saldo insuficiente. Tenés ₲${totalBalance.toLocaleString()} disponibles`), { statusCode: 400 });
      }

      credit = await tx.credit.create({
        data: { userId: req.user.id, amount: -amount, type: 'REDEMPTION', description: description || 'Canje de créditos por servicio' },
      });
    });

    res.json({ success: true, data: credit, message: `₲${amount.toLocaleString()} canjeados exitosamente` });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ success: false, message: err.message });
    next(err);
  }
});

// POST /api/credits/topup-card — DEPRECADO (410).
// Era un duplicado más viejo e INSEGURO de POST /api/payments/charge-topup: no tenía lock
// anti-doble-cobro, no verificaba el monto cobrado contra confirmation.amount, ni manejaba el
// challenge 3DS (un cobro que requería 3DS quedaba mal resuelto). El frontend usa el endpoint
// seguro (/payments/charge-topup). Se deja como 410 para cortar cualquier llamada legacy.
router.post('/topup-card', authenticate, (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Endpoint discontinuado. Usá /api/payments/charge-topup para recargar con tarjeta.',
  });
});

// ═══════ ADMIN: registrar compra de un cliente en el shop ═══════

// POST /api/credits/admin/charge — admin cobra compra del showroom a un cliente
router.post('/admin/charge', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'), async (req, res, next) => {
  try {
    const { userId, amount, description, items } = req.body;
    if (!userId || !amount || amount <= 0) return res.status(400).json({ success: false, message: 'userId y monto requeridos' });

    let credit;

    await req.prisma.$transaction(async (tx) => {
      // Check client balance inside transaction to prevent race conditions
      const allCredits = await tx.credit.findMany({
        where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      });
      const totalBalance = allCredits.reduce((sum, c) => sum + c.amount, 0);

      if (totalBalance < amount) {
        throw Object.assign(new Error(`Cliente no tiene saldo suficiente. Saldo: ₲${totalBalance.toLocaleString()}`), { statusCode: 400 });
      }

      credit = await tx.credit.create({
        data: {
          userId,
          amount: -amount,
          type: 'SHOP_PURCHASE',
          description: description || 'Compra en showroom',
        },
      });
    });

    // Audit log (outside transaction — non-critical)
    await req.prisma.auditLog.create({
      data: { userId: req.user.id, action: 'SHOP_CHARGE', entity: 'Credit', entityId: credit.id, detailsJson: { clientUserId: userId, amount, description, items } },
    });

    res.json({ success: true, data: credit, message: `Cobro de ₲${amount.toLocaleString()} registrado` });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ success: false, message: err.message });
    next(err);
  }
});

// GET /api/credits/admin/topup-requests — solicitudes de recarga manual pendientes
router.get('/admin/topup-requests', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const requests = await req.prisma.bancardOperation.findMany({
      where: { type: 'wallet_topup_request', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: requests });
  } catch (err) { next(err); }
});

// POST /api/credits/admin/approve-topup — el admin aprueba una solicitud y RECIÉN AHÍ se acredita el saldo
router.post('/admin/approve-topup', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { requestId, approve = true } = req.body;
    if (!requestId) return res.status(400).json({ success: false, message: 'requestId requerido' });

    let credit = null;
    let request;
    await req.prisma.$transaction(async (tx) => {
      request = await tx.bancardOperation.findFirst({
        where: { id: requestId, type: 'wallet_topup_request' },
      });
      if (!request) {
        throw Object.assign(new Error('Solicitud no encontrada'), { statusCode: 404 });
      }
      if (request.status !== 'PENDING') {
        throw Object.assign(new Error('La solicitud ya fue procesada'), { statusCode: 400 });
      }

      if (!approve) {
        await tx.bancardOperation.update({ where: { id: request.id }, data: { status: 'FAILED' } });
        return;
      }

      // Aprobada → acreditar saldo gastable recién ahora.
      credit = await tx.credit.create({
        data: {
          userId: request.userId,
          amount: request.amountGs,
          type: 'WALLET_TOPUP',
          description: `Recarga aprobada por admin (${request.metadataJson?.paymentMethod || 'transferencia'})`,
        },
      });
      await tx.bancardOperation.update({ where: { id: request.id }, data: { status: 'COMPLETED' } });
      await tx.auditLog.create({
        data: { userId: req.user.id, action: 'APPROVE_WALLET_TOPUP', entity: 'Credit', entityId: credit.id, detailsJson: { requestId, clientUserId: request.userId, amount: request.amountGs } },
      });
    });

    res.json({
      success: true,
      data: credit,
      message: approve ? `Recarga de ₲${request.amountGs.toLocaleString()} acreditada al cliente` : 'Solicitud de recarga rechazada',
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
});

module.exports = router;
