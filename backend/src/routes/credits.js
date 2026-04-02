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
router.post('/topup', authenticate, async (req, res, next) => {
  try {
    const { amount, paymentMethod } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Monto inválido' });
    if (amount < 10000) return res.status(400).json({ success: false, message: 'Monto mínimo: ₲10.000' });

    const credit = await req.prisma.credit.create({
      data: {
        userId: req.user.id,
        amount: amount,
        type: 'WALLET_TOPUP',
        description: `Carga de saldo${paymentMethod ? ` (${paymentMethod})` : ''}`,
      },
    });

    // Calculate new total
    const allCredits = await req.prisma.credit.findMany({
      where: { userId: req.user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    const totalBalance = allCredits.reduce((sum, c) => sum + c.amount, 0);

    res.status(201).json({
      success: true,
      data: credit,
      balance: totalBalance,
      message: `₲${amount.toLocaleString()} cargados exitosamente. Saldo: ₲${totalBalance.toLocaleString()}`,
    });
  } catch (err) { next(err); }
});

// POST /api/credits/purchase — compra en el shop/showroom
router.post('/purchase', authenticate, async (req, res, next) => {
  try {
    const { amount, description, items } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Monto inválido' });
    if (!description) return res.status(400).json({ success: false, message: 'Descripción requerida' });

    // Check balance
    const allCredits = await req.prisma.credit.findMany({
      where: { userId: req.user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    const totalBalance = allCredits.reduce((sum, c) => sum + c.amount, 0);

    if (totalBalance < amount) {
      return res.status(400).json({ success: false, message: `Saldo insuficiente. Tenés ₲${totalBalance.toLocaleString()} disponibles` });
    }

    // Create negative credit (purchase)
    const credit = await req.prisma.credit.create({
      data: {
        userId: req.user.id,
        amount: -amount,
        type: 'SHOP_PURCHASE',
        description: description, // ej: "Café + Agua mineral"
      },
    });

    const newBalance = totalBalance - amount;

    res.json({
      success: true,
      data: credit,
      balance: newBalance,
      message: `Compra de ₲${amount.toLocaleString()} registrada. Saldo: ₲${newBalance.toLocaleString()}`,
    });
  } catch (err) { next(err); }
});

// POST /api/credits/redeem — canjear créditos de referidos por servicio
router.post('/redeem', authenticate, async (req, res, next) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Monto inválido' });

    const allCredits = await req.prisma.credit.findMany({
      where: { userId: req.user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    const totalBalance = allCredits.reduce((sum, c) => sum + c.amount, 0);

    if (totalBalance < amount) {
      return res.status(400).json({ success: false, message: `Saldo insuficiente. Tenés ₲${totalBalance.toLocaleString()} disponibles` });
    }

    const credit = await req.prisma.credit.create({
      data: { userId: req.user.id, amount: -amount, type: 'REDEMPTION', description: description || 'Canje de créditos por servicio' },
    });

    res.json({ success: true, data: credit, message: `₲${amount.toLocaleString()} canjeados exitosamente` });
  } catch (err) { next(err); }
});

// POST /api/credits/topup-card — cargar saldo via tarjeta MasFazzil
router.post('/topup-card', authenticate, async (req, res, next) => {
  try {
    const { amount, cardId } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Monto inválido' });
    if (amount < 10000) return res.status(400).json({ success: false, message: 'Monto mínimo: ₲10.000' });
    if (!cardId) return res.status(400).json({ success: false, message: 'Seleccioná una tarjeta' });

    // Find card
    const card = await req.prisma.paymentCard.findFirst({ where: { id: cardId, userId: req.user.id } });
    if (!card) return res.status(404).json({ success: false, message: 'Tarjeta no encontrada' });

    const masfazzilService = require('../services/masfazzilService');

    // Charge card via MasFazzil
    const chargeRef = `TOPUP-${req.user.id.slice(-6)}-${Date.now()}`;
    const chargeResult = await masfazzilService.chargeCard({
      card_id: card.masfazzilCardId,
      amount: amount,
      currency: 'PYG',
      description: `Recarga Wallet LUXU - ${chargeRef}`,
      reference: chargeRef,
    });

    if (!chargeResult.success) {
      return res.status(400).json({ success: false, message: chargeResult.message || 'Error procesando el cobro' });
    }

    // Charge successful — create credit
    const credit = await req.prisma.credit.create({
      data: {
        userId: req.user.id,
        amount: amount,
        type: 'WALLET_TOPUP',
        description: `Recarga vía tarjeta ${card.brand} ****${card.maskedNumber?.slice(-4) || ''}`,
      },
    });

    // Record payment
    await req.prisma.payment.create({
      data: {
        userId: req.user.id,
        amount: amount,
        status: 'COMPLETED',
        method: 'CARD',
        externalId: chargeResult.data?.transaction_id || chargeRef,
        details: { type: 'WALLET_TOPUP', cardId, cardBrand: card.brand, ref: chargeRef },
      },
    });

    // Calculate new total
    const allCredits = await req.prisma.credit.findMany({
      where: { userId: req.user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    const totalBalance = allCredits.reduce((sum, c) => sum + c.amount, 0);

    res.status(201).json({
      success: true,
      data: credit,
      balance: totalBalance,
      message: `₲${amount.toLocaleString()} cargados desde tu tarjeta. Saldo: ₲${totalBalance.toLocaleString()}`,
    });
  } catch (err) { next(err); }
});

// ═══════ ADMIN: registrar compra de un cliente en el shop ═══════

// POST /api/credits/admin/charge — admin cobra compra del showroom a un cliente
router.post('/admin/charge', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'), async (req, res, next) => {
  try {
    const { userId, amount, description, items } = req.body;
    if (!userId || !amount || amount <= 0) return res.status(400).json({ success: false, message: 'userId y monto requeridos' });

    // Check client balance
    const allCredits = await req.prisma.credit.findMany({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    const totalBalance = allCredits.reduce((sum, c) => sum + c.amount, 0);

    if (totalBalance < amount) {
      return res.status(400).json({ success: false, message: `Cliente no tiene saldo suficiente. Saldo: ₲${totalBalance.toLocaleString()}` });
    }

    const credit = await req.prisma.credit.create({
      data: {
        userId,
        amount: -amount,
        type: 'SHOP_PURCHASE',
        description: description || 'Compra en showroom',
      },
    });

    // Audit log
    await req.prisma.auditLog.create({
      data: { userId: req.user.id, action: 'SHOP_CHARGE', entity: 'Credit', entityId: credit.id, details: { clientUserId: userId, amount, description, items } },
    });

    res.json({ success: true, data: credit, message: `Cobro de ₲${amount.toLocaleString()} registrado` });
  } catch (err) { next(err); }
});

module.exports = router;
