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

// POST /api/credits/topup-card — Cargar saldo via tarjeta Bancard
router.post('/topup-card', authenticate, async (req, res, next) => {
  try {
    const bancardService = require('../services/bancardService');

    const { amount, cardId } = req.body;
    if (!amount || amount < 10000) {
      return res.status(400).json({ success: false, message: 'Monto mínimo: ₲10.000' });
    }

    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      include: { paymentCards: true },
    });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (!user.bancardUserId) {
      return res.status(400).json({ success: false, message: 'Primero registrá una tarjeta Bancard' });
    }

    // Seleccionar tarjeta
    let selectedCard;
    if (cardId) {
      selectedCard = user.paymentCards.find(c => c.id === cardId);
    } else {
      selectedCard = user.paymentCards.find(c => c.isPrimary) || user.paymentCards[0];
    }
    if (!selectedCard || !selectedCard.bancardCardId) {
      return res.status(400).json({ success: false, message: 'No tenés tarjetas Bancard registradas' });
    }

    // Obtener alias_token fresco
    const bancardCards = await bancardService.getUserCards(user.bancardUserId);
    const matchingCard = bancardCards.find(c => parseInt(c.card_id) === selectedCard.bancardCardId);
    if (!matchingCard) {
      return res.status(400).json({ success: false, message: 'Tarjeta no disponible en Bancard. Sincronizá tus tarjetas.' });
    }

    // Generar shop_process_id y cobrar
    const shopProcessId = bancardService.generateShopProcessId();

    await req.prisma.bancardOperation.create({
      data: { shopProcessId, userId: user.id, type: 'charge', status: 'PENDING', amountGs: amount },
    });

    const chargeResult = await bancardService.charge({
      shopProcessId,
      amount,
      aliasToken: matchingCard.alias_token,
      description: 'Recarga billetera LG',
      returnUrl: `${process.env.APP_URL || 'https://luxurygarage.com.py'}/billetera`,
    });

    if (!chargeResult.approved) {
      await req.prisma.bancardOperation.update({ where: { shopProcessId }, data: { status: 'FAILED' } });
      return res.status(402).json({ success: false, message: 'El cobro fue rechazado. Verificá tu tarjeta.' });
    }

    // Cobro exitoso → acreditar créditos en $transaction
    let newCredit;
    await req.prisma.$transaction(async (tx) => {
      newCredit = await tx.credit.create({
        data: { userId: user.id, amount, type: 'WALLET_TOPUP', description: `Recarga Bancard ****${selectedCard.maskedNumber?.slice(-4) || '****'}` },
      });
      await tx.payment.create({
        data: { userId: user.id, amountGs: amount, paymentMethod: 'bancard_card', bancardShopProcessId: shopProcessId, bancardTicketNumber: chargeResult.ticketNumber?.toString(), bancardAuthNumber: chargeResult.authorizationNumber?.toString(), status: 'COMPLETED', description: `Recarga billetera ₲${amount.toLocaleString()}` },
      });
      await tx.bancardOperation.update({ where: { shopProcessId }, data: { status: 'COMPLETED' } });
    });

    const allCredits = await req.prisma.credit.findMany({
      where: { userId: user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    const newBalance = allCredits.reduce((sum, c) => sum + c.amount, 0);

    res.json({ success: true, data: newCredit, balance: newBalance, message: `¡Recarga de ₲${amount.toLocaleString()} acreditada!` });
  } catch (err) {
    if (err.message?.startsWith('Bancard:')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
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

module.exports = router;
