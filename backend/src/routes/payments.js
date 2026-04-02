const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const masfazzilService = require('../services/masfazzilService');

/**
 * MasFazzil Payment Routes
 * 
 * Endpoints:
 *  - POST   /api/payments/sync-customer         → Sync user with MasFazzil
 *  - POST   /api/payments/card/register          → Start card registration
 *  - GET    /api/payments/cards                  → List user's cards
 *  - POST   /api/payments/card/sync              → Sync cards from MasFazzil
 *  - DELETE /api/payments/card/:cardId            → Delete a card
 *  - POST   /api/payments/card/set-primary        → Set primary card
 *  - POST   /api/payments/charge-membership       → Charge membership payment
 *  - GET    /api/payments/history                  → Payment history
 *  - GET    /api/payments/status                   → MasFazzil config status
 */

// ─────────────────────────────────────────────────────
//  STATUS CHECK
// ─────────────────────────────────────────────────────

/**
 * GET /api/payments/status
 * Check if MasFazzil is configured
 */
router.get('/status', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      configured: true, /* Force true for Mock mode fallback */
      hasCustomerUuid: !!req.user?.masfazzilCustomerUuid,
      hasDocumentNumber: !!req.user?.documentNumber,
    },
  });
});

// ─────────────────────────────────────────────────────
//  CUSTOMER SYNC
// ─────────────────────────────────────────────────────

/**
 * POST /api/payments/sync-customer
 * Sync the logged-in user to MasFazzil (create or find)
 * Requires documentNumber to be set on user
 */
router.post('/sync-customer', authenticate, async (req, res, next) => {
  try {
    const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    // Update document number if provided
    const { documentNumber, documentType } = req.body;
    if (documentNumber) {
      await req.prisma.user.update({
        where: { id: user.id },
        data: {
          documentNumber: documentNumber,
          documentType: documentType || 'CI',
        },
      });
      user.documentNumber = documentNumber;
      user.documentType = documentType || 'CI';
    }

    if (!user.documentNumber) {
      return res.status(400).json({
        success: false,
        message: 'Necesitás agregar tu número de cédula (CI) antes de registrar una tarjeta',
      });
    }

    // Sync with MasFazzil
    const customerUuid = await masfazzilService.syncUser(user);

    if (customerUuid) {
      // Save the UUID to DB
      await req.prisma.user.update({
        where: { id: user.id },
        data: { masfazzilCustomerUuid: customerUuid },
      });
    }

    res.json({
      success: true,
      data: { customerUuid },
      message: customerUuid ? 'Cliente sincronizado con MasFazzil' : 'MasFazzil no configurado',
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
//  CARD MANAGEMENT
// ─────────────────────────────────────────────────────

/**
 * POST /api/payments/card/register
 * Start card registration process
 * Returns a redirect_url for the user to enter card details securely
 */
router.post('/card/register', authenticate, async (req, res, next) => {
  try {
    const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    // Ensure user is synced with MasFazzil
    if (!user.masfazzilCustomerUuid) {
      if (!user.documentNumber) {
        return res.status(400).json({
          success: false,
          message: 'Primero necesitás agregar tu cédula (CI) en tu perfil',
        });
      }

      // Auto-sync
      const customerUuid = await masfazzilService.syncUser(user);
      if (customerUuid && customerUuid !== 'mock-customer-uuid') {
        await req.prisma.user.update({
          where: { id: user.id },
          data: { masfazzilCustomerUuid: customerUuid },
        });
        user.masfazzilCustomerUuid = customerUuid;
      }
    }

    // Start card registration
    const result = await masfazzilService.registerCard({
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      document_number: user.documentNumber,
      document_type: user.documentType || 'CI',
      phone: user.phone || '',
    });

    // Log audit
    await req.prisma.auditLog.create({
      data: {
        entity: 'payment_card',
        action: 'register_started',
        entityId: result?.customer_uuid || user.id,
        userId: user.id,
        detailsJson: { redirect_url: result?.redirect_url ? 'generated' : 'failed' },
      },
    });

    res.json({
      success: true,
      data: {
        redirect_url: result?.redirect_url,
        customer_uuid: result?.customer_uuid,
      },
      message: 'Redirigí al usuario para completar el catastro de tarjeta',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/payments/cards
 * List the user's registered payment cards
 */
router.get('/cards', authenticate, async (req, res, next) => {
  try {
    // 1. Get cards from local DB
    const localCards = await req.prisma.paymentCard.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ success: true, data: localCards });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/payments/card/sync
 * Sync cards from MasFazzil to local DB
 * Call this after the user finishes registering a card on MasFazzil's page
 */
router.post('/card/sync', authenticate, async (req, res, next) => {
  try {
    const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.masfazzilCustomerUuid) {
      return res.status(400).json({
        success: false,
        message: 'Usuario no sincronizado con MasFazzil',
      });
    }

    // Get cards from MasFazzil
    const masfazzilCards = await masfazzilService.listCards(user.masfazzilCustomerUuid);

    // Get existing local cards
    const existingCards = await req.prisma.paymentCard.findMany({
      where: { userId: user.id },
    });
    const existingCardIds = new Set(existingCards.map(c => c.masfazzilCardId));

    // Upsert new cards
    const newCards = [];
    for (const card of masfazzilCards) {
      if (!existingCardIds.has(card.id)) {
        const created = await req.prisma.paymentCard.create({
          data: {
            userId: user.id,
            masfazzilCardId: card.id,
            alias: card.alias || `${card.brand} terminada en ${card.number?.slice(-4) || '****'}`,
            maskedNumber: card.number || card.masked_number || '****',
            brand: card.brand || 'Unknown',
            issuer: card.issuer || null,
            cardType: card.type || card.card_type || null,
            isPrimary: existingCards.length === 0 && newCards.length === 0,
          },
        });
        newCards.push(created);
      }
    }

    // Return all cards
    const allCards = await req.prisma.paymentCard.findMany({
      where: { userId: user.id },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({
      success: true,
      data: allCards,
      message: newCards.length > 0 ? `${newCards.length} tarjeta(s) sincronizada(s)` : 'Tarjetas ya sincronizadas',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/payments/card/:cardId
 * Delete a card (locally and from MasFazzil)
 */
router.delete('/card/:cardId', authenticate, async (req, res, next) => {
  try {
    const card = await req.prisma.paymentCard.findFirst({
      where: { id: req.params.cardId, userId: req.user.id },
    });

    if (!card) return res.status(404).json({ success: false, message: 'Tarjeta no encontrada' });

    // Delete from MasFazzil
    try {
      await masfazzilService.deleteCard(card.masfazzilCardId);
    } catch (e) {
      console.warn('⚠️ No se pudo eliminar tarjeta de MasFazzil:', e.message);
    }

    // Delete locally
    await req.prisma.paymentCard.delete({ where: { id: card.id } });

    // If deleted card was primary, set another as primary
    if (card.isPrimary) {
      const remaining = await req.prisma.paymentCard.findFirst({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
      });
      if (remaining) {
        await req.prisma.paymentCard.update({
          where: { id: remaining.id },
          data: { isPrimary: true },
        });
      }
    }

    // Audit
    await req.prisma.auditLog.create({
      data: {
        entity: 'payment_card',
        action: 'card_deleted',
        entityId: card.id,
        userId: req.user.id,
        detailsJson: { brand: card.brand, maskedNumber: card.maskedNumber },
      },
    });

    res.json({ success: true, message: 'Tarjeta eliminada' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/payments/card/set-primary
 * Set a card as the primary payment method
 */
router.post('/card/set-primary', authenticate, async (req, res, next) => {
  try {
    const { cardId } = req.body;
    if (!cardId) return res.status(400).json({ success: false, message: 'cardId requerido' });

    const card = await req.prisma.paymentCard.findFirst({
      where: { id: cardId, userId: req.user.id },
    });
    if (!card) return res.status(404).json({ success: false, message: 'Tarjeta no encontrada' });

    // Reset all cards to non-primary
    await req.prisma.paymentCard.updateMany({
      where: { userId: req.user.id },
      data: { isPrimary: false },
    });

    // Set this card as primary
    await req.prisma.paymentCard.update({
      where: { id: cardId },
      data: { isPrimary: true },
    });

    res.json({ success: true, message: 'Tarjeta principal actualizada' });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
//  MEMBERSHIP CHARGES
// ─────────────────────────────────────────────────────

/**
 * POST /api/payments/charge-membership
 * Charge a membership plan to a registered card
 * Body: { planId, cardId? }
 */
router.post('/charge-membership', authenticate, async (req, res, next) => {
  try {
    const { planId, cardId } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: 'planId requerido' });

    // Get plan
    const plan = await req.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

    // Get user with MasFazzil UUID
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      include: { paymentCards: true },
    });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    if (!user.isTestMode) {
      if (!user.masfazzilCustomerUuid) {
        return res.status(400).json({
          success: false,
          message: 'Primero necesitás registrar una tarjeta',
        });
      }

      // Select card
      let selectedCard;
      if (cardId) {
        selectedCard = user.paymentCards.find(c => c.id === cardId);
      } else {
        selectedCard = user.paymentCards.find(c => c.isPrimary) || user.paymentCards[0];
      }

      if (!selectedCard) {
        return res.status(400).json({
          success: false,
          message: 'No tenés tarjetas registradas. Agregá una tarjeta primero.',
        });
      }
    }

    // Generate reference
    const reference = masfazzilService.generateReference(user.id, 'MEM');

    // Charge card via MasFazzil
    let chargeResult;
    if (user.isTestMode) {
      chargeResult = {
        status: 'PAID',
        transaction_id: `test_${Math.random().toString(36).substring(7)}`,
      };
    } else {
      chargeResult = await masfazzilService.chargeCard({
        amount: plan.priceGs,
        currency: 'PYG',
        description: `Membresía ${plan.name} - Luxury Garage`,
        merchant_reference: reference,
        card_id: selectedCard.masfazzilCardId,
        customer_uuid: user.masfazzilCustomerUuid,
      });

      if (!chargeResult || chargeResult.status !== 'PAID') {
        // Create failed payment record
        await req.prisma.payment.create({
          data: {
            userId: user.id,
            amountGs: plan.priceGs,
            paymentMethod: 'masfazzil_card',
            status: 'FAILED',
            description: `Membresía ${plan.name} - Error: ${chargeResult?.status || 'unknown'}`,
          },
        });

        return res.status(402).json({
          success: false,
          message: 'El cobro no se pudo procesar. Verificá tu tarjeta o intentá con otra.',
          data: { status: chargeResult?.status },
        });
      }
    }

    // ── SUCCESS: Activate membership ──────────────────
    // Cancel existing active membership
    await req.prisma.membership.updateMany({
      where: { userId: user.id, status: 'ACTIVE' },
      data: { status: 'REPLACED' },
    });

    // Create new membership
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 1);

    const membership = await req.prisma.membership.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: 'ACTIVE',
        startDate: start,
        endDate: end,
        autoRenew: true,
      },
      include: { plan: true },
    });

    // Create payment record
    const payment = await req.prisma.payment.create({
      data: {
        userId: user.id,
        membershipId: membership.id,
        amountGs: plan.priceGs,
        paymentMethod: 'masfazzil_card',
        arizarTransactionId: chargeResult.transaction_id,
        status: 'COMPLETED',
        description: `Membresía ${plan.name} - ${reference}`,
      },
    });

    // Audit log
    await req.prisma.auditLog.create({
      data: {
        entity: 'payment',
        action: 'membership_charged',
        entityId: payment.id,
        userId: user.id,
        detailsJson: {
          planName: plan.name,
          amount: plan.priceGs,
          reference,
          transactionId: chargeResult.transaction_id,
          cardBrand: selectedCard.brand,
          cardMask: selectedCard.maskedNumber,
        },
      },
    });

    // Try to sync with ARIZAR IA (non-blocking)
    try {
      const arizarService = require('./../../services/arizarService');
      const ArizarSync = require('../services/arizarSync');
      if (user.arizarContactId) {
        const sync = new ArizarSync(req.prisma);
        await sync.syncMembershipActivated(user, membership);
      }
    } catch (e) {
      console.warn('⚠️ ARIZAR sync after payment:', e.message);
    }

    console.log(`✅ Membresía ${plan.name} activada para ${user.email} vía MasFazzil (${reference})`);

    res.json({
      success: true,
      data: {
        membership,
        payment: {
          id: payment.id,
          amount: plan.priceGs,
          reference,
          transactionId: chargeResult.transaction_id,
          status: 'COMPLETED',
        },
      },
      message: `¡Membresía ${plan.name} activada exitosamente!`,
    });
  } catch (err) {
    if (err.masfazzilError) {
      return res.status(402).json({
        success: false,
        message: err.message || 'Error procesando el pago',
      });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────
//  PAYMENT HISTORY
// ─────────────────────────────────────────────────────

/**
 * GET /api/payments/history
 * Get payment history for the current user (or all for admin)
 */
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
    const where = isAdmin ? {} : { userId: req.user.id };

    const payments = await req.prisma.payment.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        membership: { include: { plan: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/payments/admin/stats
 * Get payment statistics (admin only)
 */
router.get('/admin/stats', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalPayments, monthPayments, completedMonth, failedMonth] = await Promise.all([
      req.prisma.payment.count(),
      req.prisma.payment.findMany({
        where: { createdAt: { gte: startOfMonth } },
      }),
      req.prisma.payment.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: startOfMonth } },
        _sum: { amountGs: true },
        _count: true,
      }),
      req.prisma.payment.count({
        where: { status: 'FAILED', createdAt: { gte: startOfMonth } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalPayments,
        monthRevenue: completedMonth._sum.amountGs || 0,
        monthTransactions: completedMonth._count || 0,
        monthFailed: failedMonth,
        successRate: monthPayments.length > 0
          ? Math.round((completedMonth._count / monthPayments.length) * 100)
          : 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
