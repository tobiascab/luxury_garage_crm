const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const bancardService = require('../services/bancardService');

/**
 * Bancard Payment Routes
 *
 * Endpoints:
 *  - GET    /api/payments/status                  → Estado de configuración
 *  - POST   /api/payments/card/register            → Iniciar catastro de tarjeta (retorna process_id para iframe)
 *  - POST   /api/payments/card/sync               → Sincronizar tarjetas desde Bancard API
 *  - GET    /api/payments/cards                   → Listar tarjetas del usuario
 *  - DELETE /api/payments/card/:cardId             → Eliminar tarjeta
 *  - POST   /api/payments/card/set-primary         → Establecer tarjeta principal
 *  - POST   /api/payments/charge-membership        → Cobrar membresía
 *  - POST   /api/payments/charge-3ds-complete      → Completar pago 3DS
 *  - GET    /api/payments/history                  → Historial de pagos
 *  - GET    /api/payments/admin/stats              → Stats admin
 */

// ─────────────────────────────────────────────────────
//  STATUS CHECK
// ─────────────────────────────────────────────────────

/**
 * GET /api/payments/status
 * Check if Bancard is configured and user's Bancard setup state
 */
router.get('/status', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      configured: bancardService.isConfigured(),
      bancardConfigured: bancardService.isConfigured(),
      hasBancardUserId: !!req.user?.bancardUserId,
    },
  });
});

// ─────────────────────────────────────────────────────
//  CARD MANAGEMENT
// ─────────────────────────────────────────────────────

/**
 * POST /api/payments/card/register
 * Initiate Bancard card registration (catastro).
 * Assigns a bancardUserId if the user doesn't have one, generates a bancardCardId,
 * calls bancardService.registerCard() and returns the process_id for the frontend iframe.
 */
router.post('/card/register', authenticate, async (req, res, next) => {
  try {
    let user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      include: { paymentCards: { select: { id: true } } },
    });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    // 1. Assign bancardUserId if the user doesn't have one yet
    let bancardUserId = user.bancardUserId;
    if (!bancardUserId) {
      // Combine a time-based component with a hash of the user's id for uniqueness
      const timePart = Math.floor(Date.now() / 1000) % 999999999;
      const idPart = parseInt(user.id.slice(-6), 16) % 1000;
      bancardUserId = timePart + idPart;

      user = await req.prisma.user.update({
        where: { id: user.id },
        data: { bancardUserId },
        include: { paymentCards: { select: { id: true } } },
      });
    }

    // 2. Generate a unique bancardCardId — timestamp-based so retries don't collide with pending Bancard registrations
    const userIndex = parseInt(user.id.slice(-3), 16) % 1000;
    const bancardCardId = (Math.floor(Date.now() / 1000) % 2000000000) + userIndex;

    // 3. Build a returnUrl (Bancard pings this after iframe completion)
    const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://luxurygarage.com.py';
    const returnUrl = `${appBaseUrl}/billetera?cardRegistered=1`;

    // 4. Call bancardService.registerCard()
    const result = await bancardService.registerCard({
      cardId: bancardCardId,
      userId: bancardUserId,
      userEmail: user.email,
      userPhone: user.phone || '',
      returnUrl,
    });

    // 5. Persist a BancardOperation record for tracking
    await req.prisma.bancardOperation.create({
      data: {
        shopProcessId: bancardCardId,
        userId: user.id,
        type: 'card_registration',
        status: 'PENDING',
        processId: result.processId ? String(result.processId) : null,
        metadataJson: { bancardCardId, bancardUserId, userEmail: user.email },
      },
    });

    // 6. Audit log
    await req.prisma.auditLog.create({
      data: {
        entity: 'payment_card',
        action: 'register_started',
        entityId: user.id,
        userId: user.id,
        detailsJson: { bancardCardId, bancardUserId },
      },
    });

    console.log(`[Bancard] Card registration started for user ${user.email} — cardId=${bancardCardId}`);

    res.json({
      success: true,
      data: {
        processId: result.processId,
        jsLibUrl: bancardService.jsLibUrl,
        bancardCardId,
        bancardUserId,
      },
      message: 'Catastro de tarjeta iniciado. Usá el process_id con el SDK de Bancard para mostrar el iframe.',
    });
  } catch (err) {
    console.error('[Bancard] card/register error:', err.message);
    if (err.message && err.message.startsWith('Bancard:')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/payments/card/sync
 * Pull the user's cards from Bancard and upsert them in the local DB.
 * Call this after the user completes the iframe card registration.
 */
router.post('/card/sync', authenticate, async (req, res, next) => {
  try {
    const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    if (!user.bancardUserId) {
      return res.status(400).json({
        success: false,
        message: 'El usuario no tiene un ID de Bancard asignado. Registrá una tarjeta primero.',
      });
    }

    // Fetch cards from Bancard
    const bancardCards = await bancardService.getUserCards(user.bancardUserId);

    if (!bancardCards || bancardCards.length === 0) {
      const localCards = await req.prisma.paymentCard.findMany({
        where: { userId: user.id },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      });
      return res.json({
        success: true,
        data: localCards,
        message: 'No se encontraron tarjetas en Bancard aún.',
      });
    }

    // Upsert each Bancard card into local DB
    const existingLocalCards = await req.prisma.paymentCard.findMany({
      where: { userId: user.id },
    });
    const newCards = [];

    for (const card of bancardCards) {
      const bancardCardId = parseInt(card.card_id);
      const existing = existingLocalCards.find(c => c.bancardCardId === bancardCardId);

      if (existing) {
        // Update token and card details (alias_token has a short TTL)
        await req.prisma.paymentCard.update({
          where: { id: existing.id },
          data: {
            bancardAliasToken: card.alias_token,
            maskedNumber: card.card_masked_number || existing.maskedNumber,
            brand: card.card_brand || existing.brand,
            cardType: card.card_type || existing.cardType,
            expirationDate: card.expiration_date || existing.expirationDate,
          },
        });
      } else {
        // Create new card record
        const isFirst = existingLocalCards.length === 0 && newCards.length === 0;
        const created = await req.prisma.paymentCard.create({
          data: {
            userId: user.id,
            bancardCardId,
            bancardAliasToken: card.alias_token,
            maskedNumber: card.card_masked_number || '****',
            brand: card.card_brand || 'Unknown',
            cardType: card.card_type || null,
            expirationDate: card.expiration_date || null,
            alias: `${card.card_brand || 'Tarjeta'} ${card.card_masked_number ? '...' + card.card_masked_number.slice(-4) : ''}`.trim(),
            isPrimary: isFirst,
          },
        });
        newCards.push(created);
      }
    }

    // Return full updated list
    const allCards = await req.prisma.paymentCard.findMany({
      where: { userId: user.id },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({
      success: true,
      data: allCards,
      message: newCards.length > 0
        ? `${newCards.length} tarjeta(s) sincronizada(s) desde Bancard`
        : 'Tarjetas actualizadas',
    });
  } catch (err) {
    console.error('[Bancard] card/sync error:', err.message);
    next(err);
  }
});

/**
 * GET /api/payments/cards
 * List the user's registered payment cards from the local DB
 */
router.get('/cards', authenticate, async (req, res, next) => {
  try {
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
 * DELETE /api/payments/card/:cardId
 * Remove a card from Bancard and from the local DB
 */
router.delete('/card/:cardId', authenticate, async (req, res, next) => {
  try {
    const card = await req.prisma.paymentCard.findFirst({
      where: { id: req.params.cardId, userId: req.user.id },
    });
    if (!card) return res.status(404).json({ success: false, message: 'Tarjeta no encontrada' });

    const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });

    // Attempt to delete from Bancard (non-blocking — local delete always proceeds)
    if (card.bancardCardId && user?.bancardUserId) {
      try {
        const tokenOrId = card.bancardAliasToken || String(card.bancardCardId);
        await bancardService.deleteCard(user.bancardUserId, tokenOrId);
      } catch (e) {
        console.warn('[Bancard] Could not delete card from Bancard API:', e.message);
      }
    }

    // Delete locally
    await req.prisma.paymentCard.delete({ where: { id: card.id } });

    // If deleted card was primary, promote the most-recent remaining card
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
        detailsJson: { brand: card.brand, maskedNumber: card.maskedNumber, bancardCardId: card.bancardCardId },
      },
    });

    res.json({ success: true, message: 'Tarjeta eliminada correctamente' });
  } catch (err) {
    console.error('[Bancard] card/delete error:', err.message);
    next(err);
  }
});

/**
 * POST /api/payments/card/set-primary
 * Set a card as the user's primary payment method
 */
router.post('/card/set-primary', authenticate, async (req, res, next) => {
  try {
    const { cardId } = req.body;
    if (!cardId) return res.status(400).json({ success: false, message: 'cardId requerido' });

    const card = await req.prisma.paymentCard.findFirst({
      where: { id: cardId, userId: req.user.id },
    });
    if (!card) return res.status(404).json({ success: false, message: 'Tarjeta no encontrada' });

    // Reset all to non-primary, then mark chosen one
    await req.prisma.paymentCard.updateMany({
      where: { userId: req.user.id },
      data: { isPrimary: false },
    });
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
 * Charge the membership fee to a registered Bancard card.
 * Body: { planId, cardId? }
 *
 * Flow:
 *  1. Validate plan and user
 *  2. If isTestMode → simulate approved charge
 *  3. Select card (by cardId or primary)
 *  4. Get a fresh alias_token from Bancard (getUserCards)
 *  5. Create PENDING BancardOperation + Payment records
 *  6. Call bancardService.charge()
 *  7a. If 3DS required → return { requires3ds: true, processId } for iframe
 *  7b. If approved  → activate membership in a DB transaction
 *  7c. If declined  → mark payment FAILED, return 402
 */
router.post('/charge-membership', authenticate, async (req, res, next) => {
  try {
    const { planId, cardId } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: 'planId requerido' });

    // 1. Get plan
    const plan = await req.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

    // 2. Get user with cards
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      include: { paymentCards: true },
    });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    // 3. Test mode — simulate successful charge without hitting Bancard
    if (user.isTestMode) {
      const start = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 1);
      const fakeShopProcessId = Date.now();

      let membership, payment;
      await req.prisma.$transaction(async (tx) => {
        await tx.membership.updateMany({
          where: { userId: user.id, status: 'ACTIVE' },
          data: { status: 'REPLACED' },
        });
        membership = await tx.membership.create({
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
        payment = await tx.payment.create({
          data: {
            userId: user.id,
            membershipId: membership.id,
            amountGs: plan.priceGs,
            paymentMethod: 'bancard_test',
            bancardShopProcessId: fakeShopProcessId,
            bancardTicketNumber: `TEST_${Date.now()}`,
            bancardAuthNumber: 'TEST',
            status: 'COMPLETED',
            description: `[TEST] Membresía ${plan.name}`,
          },
        });
        await tx.auditLog.create({
          data: {
            entity: 'payment',
            action: 'membership_charged_test',
            entityId: payment.id,
            userId: user.id,
            detailsJson: { planName: plan.name, amount: plan.priceGs, testMode: true },
          },
        });
      });

      console.log(`[TEST MODE] Membresía ${plan.name} activada para ${user.email}`);
      return res.json({
        success: true,
        data: { membership, payment: { id: payment.id, amount: plan.priceGs, status: 'COMPLETED' } },
        message: `¡Membresía ${plan.name} activada! (modo prueba)`,
      });
    }

    // 4. Real Bancard flow — user must have bancardUserId
    if (!user.bancardUserId) {
      return res.status(400).json({
        success: false,
        message: 'Primero necesitás registrar una tarjeta de pago.',
      });
    }

    // Select card
    let selectedCard;
    if (cardId) {
      selectedCard = user.paymentCards.find(c => c.id === cardId);
      if (!selectedCard) {
        return res.status(400).json({ success: false, message: 'Tarjeta no encontrada' });
      }
    } else {
      selectedCard = user.paymentCards.find(c => c.isPrimary) || user.paymentCards[0];
    }

    if (!selectedCard) {
      return res.status(400).json({
        success: false,
        message: 'No tenés tarjetas registradas. Agregá una tarjeta primero.',
      });
    }

    // 4. Get fresh alias_token from Bancard (tokens have a short TTL)
    let aliasToken = selectedCard.bancardAliasToken;
    try {
      const bancardCards = await bancardService.getUserCards(user.bancardUserId);
      const fresh = bancardCards.find(c => parseInt(c.card_id) === selectedCard.bancardCardId);
      if (fresh && fresh.alias_token) {
        aliasToken = fresh.alias_token;
        // Persist the refreshed token
        await req.prisma.paymentCard.update({
          where: { id: selectedCard.id },
          data: { bancardAliasToken: aliasToken },
        });
      }
    } catch (e) {
      console.warn('[Bancard] Could not refresh alias_token, using cached one:', e.message);
    }

    if (!aliasToken) {
      return res.status(400).json({
        success: false,
        message: 'No se pudo obtener el token de la tarjeta. Por favor sincronizá tus tarjetas e intentá de nuevo.',
      });
    }

    // 5. Generate shop_process_id and pre-create records
    const shopProcessId = bancardService.generateShopProcessId();
    const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://luxurygarage.com.py';
    const returnUrl = `${appBaseUrl}/billetera?paymentResult=1`;
    const description = `Membresía ${plan.name} - Luxury Garage`;

    // Create BancardOperation (PENDING)
    await req.prisma.bancardOperation.create({
      data: {
        shopProcessId,
        userId: user.id,
        type: 'charge',
        status: 'PENDING',
        amountGs: plan.priceGs,
        metadataJson: { planId: plan.id, planName: plan.name, cardId: selectedCard.id },
      },
    });

    // Create Payment record (PENDING) — so we can track even if something crashes
    let pendingPayment = await req.prisma.payment.create({
      data: {
        userId: user.id,
        amountGs: plan.priceGs,
        paymentMethod: 'bancard_card',
        bancardShopProcessId: shopProcessId,
        status: 'PENDING',
        description,
      },
    });

    // 6. Execute charge via Bancard
    let chargeResult;
    try {
      chargeResult = await bancardService.charge({
        shopProcessId,
        amount: plan.priceGs,
        aliasToken,
        description,
        returnUrl,
      });
    } catch (bancardErr) {
      // Mark payment as failed
      await req.prisma.payment.update({
        where: { id: pendingPayment.id },
        data: { status: 'FAILED', description: `${description} — Error: ${bancardErr.message}` },
      });
      await req.prisma.bancardOperation.update({
        where: { shopProcessId },
        data: { status: 'FAILED' },
      });
      const userMsg = bancardErr.message.startsWith('Bancard:')
        ? bancardErr.message.replace('Bancard: ', '')
        : 'No se pudo procesar el cobro. Intentá con otra tarjeta.';
      return res.status(402).json({ success: false, message: userMsg });
    }

    // 7a. 3DS challenge required — return process_id so frontend shows iframe
    if (chargeResult.threeDsRequired) {
      await req.prisma.bancardOperation.update({
        where: { shopProcessId },
        data: {
          status: 'PENDING',
          processId: chargeResult.processId ? String(chargeResult.processId) : null,
        },
      });
      return res.json({
        success: true,
        requires3ds: true,
        data: {
          processId: chargeResult.processId,
          jsLibUrl: bancardService.jsLibUrl,
          shopProcessId,
        },
        message: 'Autenticación 3DS requerida. Completá el proceso en el iframe.',
      });
    }

    // 7c. Charge was declined
    if (!chargeResult.approved) {
      await req.prisma.payment.update({
        where: { id: pendingPayment.id },
        data: { status: 'FAILED', description: `${description} — Rechazado (${chargeResult.responseCode || 'N/A'})` },
      });
      await req.prisma.bancardOperation.update({
        where: { shopProcessId },
        data: { status: 'FAILED' },
      });
      return res.status(402).json({
        success: false,
        message: 'El cobro fue rechazado. Verificá tu tarjeta o intentá con otra.',
        data: { responseCode: chargeResult.responseCode },
      });
    }

    // 7b. Approved — activate membership in a single DB transaction
    const bancardTicketNumber = chargeResult.ticketNumber;
    const bancardAuthNumber = chargeResult.authorizationNumber;
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 1);

    let membership, payment;
    await req.prisma.$transaction(async (tx) => {
      // Replace any existing active membership
      await tx.membership.updateMany({
        where: { userId: user.id, status: 'ACTIVE' },
        data: { status: 'REPLACED' },
      });

      // Create new membership
      membership = await tx.membership.create({
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

      // Mark payment as COMPLETED and link membership
      payment = await tx.payment.update({
        where: { bancardShopProcessId: shopProcessId },
        data: {
          status: 'COMPLETED',
          membershipId: membership.id,
          bancardTicketNumber: bancardTicketNumber || null,
          bancardAuthNumber: bancardAuthNumber || null,
        },
      });

      // Mark operation as COMPLETED
      await tx.bancardOperation.update({
        where: { shopProcessId },
        data: { status: 'COMPLETED' },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          entity: 'payment',
          action: 'membership_charged_bancard',
          entityId: payment.id,
          userId: user.id,
          detailsJson: {
            planName: plan.name,
            amount: plan.priceGs,
            shopProcessId,
            ticketNumber: bancardTicketNumber,
            authNumber: bancardAuthNumber,
            cardBrand: selectedCard.brand,
            cardMask: selectedCard.maskedNumber,
          },
        },
      });
    });

    // Non-blocking ARIZAR IA sync
    try {
      const ArizarSync = require('../services/arizarSync');
      if (user.arizarContactId) {
        const sync = new ArizarSync(req.prisma);
        await sync.syncMembershipActivated(user, membership);
      }
    } catch (e) {
      console.warn('[Bancard] ARIZAR sync after payment failed:', e.message);
    }

    console.log(`[Bancard] Membresía ${plan.name} activada para ${user.email} — shopProcessId=${shopProcessId}`);

    res.json({
      success: true,
      data: {
        membership,
        payment: {
          id: payment.id,
          amount: plan.priceGs,
          shopProcessId,
          ticketNumber: bancardTicketNumber,
          status: 'COMPLETED',
        },
      },
      message: `¡Membresía ${plan.name} activada exitosamente!`,
    });
  } catch (err) {
    console.error('[Bancard] charge-membership error:', err.message);
    next(err);
  }
});

/**
 * POST /api/payments/charge-3ds-complete
 * Called by the frontend after the user completes the 3DS iframe challenge.
 * Verifies the outcome and activates the membership if approved.
 * Body: { shopProcessId, planId }
 */
router.post('/charge-3ds-complete', authenticate, async (req, res, next) => {
  try {
    const { shopProcessId, planId } = req.body;
    if (!shopProcessId) return res.status(400).json({ success: false, message: 'shopProcessId requerido' });

    // Look up the pending payment
    const pendingPayment = await req.prisma.payment.findFirst({
      where: { bancardShopProcessId: Number(shopProcessId), userId: req.user.id },
    });
    if (!pendingPayment) {
      return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    }
    if (pendingPayment.status === 'COMPLETED') {
      return res.json({ success: true, message: 'El pago ya fue procesado', data: { alreadyCompleted: true } });
    }

    // Get the plan (either from body or from existing payment description)
    let plan = null;
    if (planId) {
      plan = await req.prisma.plan.findUnique({ where: { id: planId } });
    }
    if (!plan) {
      // Try to look up via the BancardOperation
      const op = await req.prisma.bancardOperation.findFirst({
        where: { shopProcessId: Number(shopProcessId) },
      });
      if (op?.metadataJson?.planId) {
        plan = await req.prisma.plan.findUnique({ where: { id: op.metadataJson.planId } });
      }
    }
    if (!plan) {
      return res.status(400).json({ success: false, message: 'No se pudo determinar el plan. Proporcioná planId.' });
    }

    // Verify with Bancard
    let confirmation;
    try {
      confirmation = await bancardService.getConfirmation(Number(shopProcessId));
    } catch (bancardErr) {
      return res.status(402).json({
        success: false,
        message: bancardErr.message.startsWith('Bancard:')
          ? bancardErr.message.replace('Bancard: ', '')
          : 'No se pudo verificar el resultado del pago.',
      });
    }

    const approved = confirmation.response === 'S';

    if (!approved) {
      await req.prisma.payment.update({
        where: { id: pendingPayment.id },
        data: { status: 'FAILED' },
      });
      await req.prisma.bancardOperation.update({
        where: { shopProcessId: Number(shopProcessId) },
        data: { status: 'FAILED' },
      });
      return res.status(402).json({
        success: false,
        message: 'El pago 3DS fue rechazado. Intentá con otra tarjeta.',
        data: { responseCode: confirmation.response_code },
      });
    }

    // Activate membership
    const bancardTicketNumber = confirmation.ticket_number || null;
    const bancardAuthNumber = confirmation.authorization_number || null;
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 1);

    let membership, payment;
    await req.prisma.$transaction(async (tx) => {
      await tx.membership.updateMany({
        where: { userId: req.user.id, status: 'ACTIVE' },
        data: { status: 'REPLACED' },
      });

      membership = await tx.membership.create({
        data: {
          userId: req.user.id,
          planId: plan.id,
          status: 'ACTIVE',
          startDate: start,
          endDate: end,
          autoRenew: true,
        },
        include: { plan: true },
      });

      payment = await tx.payment.update({
        where: { bancardShopProcessId: Number(shopProcessId) },
        data: {
          status: 'COMPLETED',
          membershipId: membership.id,
          bancardTicketNumber,
          bancardAuthNumber,
        },
      });

      await tx.bancardOperation.update({
        where: { shopProcessId: Number(shopProcessId) },
        data: { status: 'COMPLETED' },
      });

      await tx.auditLog.create({
        data: {
          entity: 'payment',
          action: 'membership_charged_bancard_3ds',
          entityId: payment.id,
          userId: req.user.id,
          detailsJson: {
            planName: plan.name,
            amount: plan.priceGs,
            shopProcessId,
            ticketNumber: bancardTicketNumber,
            authNumber: bancardAuthNumber,
          },
        },
      });
    });

    // Non-blocking ARIZAR IA sync
    try {
      const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
      const ArizarSync = require('../services/arizarSync');
      if (user?.arizarContactId) {
        const sync = new ArizarSync(req.prisma);
        await sync.syncMembershipActivated(user, membership);
      }
    } catch (e) {
      console.warn('[Bancard] ARIZAR sync after 3DS failed:', e.message);
    }

    console.log(`[Bancard] 3DS membresía ${plan.name} activada para user ${req.user.id} — shopProcessId=${shopProcessId}`);

    res.json({
      success: true,
      data: {
        membership,
        payment: {
          id: payment.id,
          amount: plan.priceGs,
          shopProcessId,
          ticketNumber: bancardTicketNumber,
          status: 'COMPLETED',
        },
      },
      message: `¡Membresía ${plan.name} activada exitosamente!`,
    });
  } catch (err) {
    console.error('[Bancard] charge-3ds-complete error:', err.message);
    next(err);
  }
});

// ─────────────────────────────────────────────────────
//  PAYMENT HISTORY
// ─────────────────────────────────────────────────────

/**
 * GET /api/payments/history
 * Payment history for the current user (admins see all)
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

// ─────────────────────────────────────────────────────
//  ADMIN STATS
// ─────────────────────────────────────────────────────

/**
 * GET /api/payments/admin/stats
 * Payment statistics (admin only)
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
