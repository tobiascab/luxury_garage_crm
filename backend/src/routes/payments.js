const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const bancardService = require('../services/bancardService');
const { postPaymentCompleted } = require('../services/journalService');

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
 *  - POST   /api/payments/charge-3ds-complete      → Completar pago 3DS de membresía
 *  - POST   /api/payments/charge-topup             → Recargar billetera (cobro Bancard)
 *  - POST   /api/payments/charge-topup-3ds-complete → Completar recarga de billetera con 3DS
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

    // 3. Test mode — simulate successful charge without hitting Bancard.
    //    SEGURIDAD: inerte en producción. En prod NUNCA se activa una membresía sin cobro Bancard,
    //    aunque el usuario tenga isTestMode=true. Sigue sirviendo para desarrollo.
    if (user.isTestMode && process.env.NODE_ENV !== 'production') {
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

    // 5+6. Lock ATÓMICO anti doble-cobro. El chequeo "¿hay otro charge PENDING?" + la creación de
    //      los registros PENDING se hacen DENTRO de una transacción con SELECT ... FOR UPDATE sobre
    //      la fila del usuario, serializando reintentos concurrentes del MISMO usuario (doble click
    //      / retry de red). Antes era check-then-act: dos requests pasaban el findFirst a la vez y
    //      se generaban DOS cobros.
    const shopProcessId = bancardService.generateShopProcessId();
    const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://luxurygarage.com.py';
    const returnUrl = `${appBaseUrl}/billetera?paymentResult=1`;
    const description = `Membresía ${plan.name} - Luxury Garage`;

    try {
      await req.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
        const inFlight = await tx.bancardOperation.findFirst({
          where: { userId: user.id, type: 'charge', status: 'PENDING' },
        });
        if (inFlight) throw Object.assign(new Error('CHARGE_IN_FLIGHT'), { code: 'CHARGE_IN_FLIGHT' });
        await tx.bancardOperation.create({
          data: {
            shopProcessId, userId: user.id, type: 'charge', status: 'PENDING',
            amountGs: plan.priceGs,
            metadataJson: { planId: plan.id, planName: plan.name, cardId: selectedCard.id },
          },
        });
        await tx.payment.create({
          data: {
            userId: user.id, amountGs: plan.priceGs, paymentMethod: 'bancard_card',
            bancardShopProcessId: shopProcessId, status: 'PENDING', description,
          },
        });
      });
    } catch (e) {
      if (e.code === 'CHARGE_IN_FLIGHT') {
        return res.status(409).json({
          success: false,
          message: 'Ya tenés un cobro en proceso. Esperá unos segundos antes de reintentar.',
        });
      }
      throw e;
    }
    const pendingPayment = await req.prisma.payment.findUnique({ where: { bancardShopProcessId: shopProcessId } });

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

    let membership, payment, alreadyMaterialized = false;
    await req.prisma.$transaction(async (tx) => {
      // Lock + re-check anti doble-materialización: el camino DIRECTO (sin 3DS) también debe
      // sostener el mismo lock que toma el webhook/job (materializeApprovedPayment). Sin esto el
      // webhook /confirm concurrente ve la op PENDING y crea una SEGUNDA membresía por el mismo cobro.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
      const freshOp = await tx.bancardOperation.findUnique({ where: { shopProcessId } });
      if (freshOp?.status === 'COMPLETED') { alreadyMaterialized = true; return; }

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

    if (alreadyMaterialized) {
      const activeM = await req.prisma.membership.findFirst({ where: { userId: user.id, status: 'ACTIVE' }, include: { plan: true } });
      return res.json({ success: true, message: 'El pago ya fue procesado.', data: { membership: activeM, alreadyCompleted: true } });
    }

    // Asiento contable (best-effort, POST-COMMIT, no bloqueante).
    if (payment?.id) postPaymentCompleted(req.prisma, payment.id).catch(() => {});

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

    // SEGURIDAD: el plan se deriva del registro PERSISTIDO (BancardOperation creado al iniciar
    // el cobro vía shop_process_id), NO del body. Confiar en planId del body permitía activar
    // un plan caro pagando uno barato. El planId del body solo se acepta si coincide con el
    // persistido (verificación cruzada).
    const op = await req.prisma.bancardOperation.findFirst({
      where: { shopProcessId: Number(shopProcessId), userId: req.user.id },
    });
    const persistedPlanId = op?.metadataJson?.planId || null;
    if (!persistedPlanId) {
      return res.status(400).json({ success: false, message: 'No se pudo determinar el plan de este pago.' });
    }
    if (planId && planId !== persistedPlanId) {
      return res.status(400).json({ success: false, message: 'El plan no coincide con el pago iniciado.' });
    }
    const plan = await req.prisma.plan.findUnique({ where: { id: persistedPlanId } });
    if (!plan) {
      return res.status(400).json({ success: false, message: 'Plan no encontrado para este pago.' });
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

    const approved = confirmation.response === 'S' && String(confirmation.response_code) === '00';

    // SEGURIDAD: validar que el monto realmente cobrado por Bancard coincida con el precio del plan.
    // Bancard devuelve `amount` como string con 2 decimales (ej "150000.00").
    if (approved) {
      const confirmedAmount = Math.round(parseFloat(confirmation.amount));
      if (!Number.isFinite(confirmedAmount) || confirmedAmount !== plan.priceGs) {
        await req.prisma.payment.update({
          where: { id: pendingPayment.id },
          data: { status: 'FAILED', description: `${pendingPayment.description || ''} — Monto no coincide (cobrado ${confirmation.amount}, esperado ${plan.priceGs})` },
        });
        await req.prisma.bancardOperation.update({
          where: { shopProcessId: Number(shopProcessId) },
          data: { status: 'FAILED' },
        });
        return res.status(402).json({
          success: false,
          message: 'El monto cobrado no coincide con el precio del plan. El pago no se aplicó.',
        });
      }
    }

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

    let membership, payment, alreadyMaterialized = false;
    await req.prisma.$transaction(async (tx) => {
      // Lock + re-check anti doble-materialización con el webhook/job de reconciliación: si el pago
      // ya fue acreditado (op COMPLETED), NO creamos otra membresía.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.user.id} FOR UPDATE`;
      const freshOp = await tx.bancardOperation.findUnique({ where: { shopProcessId: Number(shopProcessId) } });
      if (freshOp?.status === 'COMPLETED') { alreadyMaterialized = true; return; }

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

    if (alreadyMaterialized) {
      const activeM = await req.prisma.membership.findFirst({ where: { userId: req.user.id, status: 'ACTIVE' }, include: { plan: true } });
      return res.json({ success: true, message: 'El pago ya fue procesado.', data: { membership: activeM, alreadyCompleted: true } });
    }

    // Asiento contable (best-effort, POST-COMMIT, no bloqueante).
    if (payment?.id) postPaymentCompleted(req.prisma, payment.id).catch(() => {});

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
//  WALLET TOP-UP (RECARGA DE BILLETERA)
// ─────────────────────────────────────────────────────

/**
 * POST /api/payments/charge-topup
 * Recargar el saldo de la billetera cobrando a una tarjeta Bancard registrada.
 * Body: { amountGs, cardId? }
 *
 * Flujo (replica charge-membership):
 *  1. Validar amountGs (entero > 0)
 *  2. Si isTestMode (y no prod) → simular acreditación sin llamar a Bancard
 *  3. Seleccionar tarjeta (cardId o primaria) + refrescar alias_token
 *  4. Crear PENDING BancardOperation(type:'charge', kind:'topup') + Payment(PENDING)
 *  5. Llamar bancardService.charge()
 *  6a. 3DS → { success:true, requires3ds:true, data:{ processId, jsLibUrl, shopProcessId } }
 *  6b. Aprobado → acreditar Credit (WALLET_TOPUP) + Payment COMPLETED en una transacción
 *  6c. Rechazado → 402 { success:false, message }
 */
router.post('/charge-topup', authenticate, async (req, res, next) => {
  try {
    const { amountGs, cardId } = req.body;
    const amount = Number(amountGs);
    const MAX_TOPUP_GS = 5_000_000; // Tope por recarga (control de negocio anti-error/abuso). Ajustable.
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'El monto a recargar debe ser un entero mayor a 0.' });
    }
    if (amount > MAX_TOPUP_GS) {
      return res.status(400).json({ success: false, message: `El monto máximo por recarga es ₲${MAX_TOPUP_GS.toLocaleString('es-PY')}.` });
    }

    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      include: { paymentCards: true },
    });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const description = 'Recarga de billetera';

    // Modo prueba — simular acreditación sin tocar Bancard (inerte en producción).
    if (user.isTestMode && process.env.NODE_ENV !== 'production') {
      const fakeShopProcessId = Date.now();
      let payment;
      await req.prisma.$transaction(async (tx) => {
        await tx.credit.create({
          data: { userId: user.id, amount, type: 'WALLET_TOPUP', description: `[TEST] ${description}` },
        });
        payment = await tx.payment.create({
          data: {
            userId: user.id,
            amountGs: amount,
            paymentMethod: 'bancard_test',
            bancardShopProcessId: fakeShopProcessId,
            bancardTicketNumber: `TEST_${Date.now()}`,
            bancardAuthNumber: 'TEST',
            status: 'COMPLETED',
            description: `[TEST] ${description}`,
          },
        });
        await tx.auditLog.create({
          data: {
            entity: 'payment', action: 'wallet_topup_test', entityId: payment.id, userId: user.id,
            detailsJson: { amountGs: amount, testMode: true },
          },
        });
      });
      console.log(`[TEST MODE] Recarga de billetera ₲${amount} acreditada para ${user.email}`);
      return res.json({
        success: true,
        data: { payment: { id: payment.id, status: 'COMPLETED' }, amountGs: amount },
        message: `¡Recarga de ₲${amount.toLocaleString('es-PY')} acreditada! (modo prueba)`,
      });
    }

    // Flujo real Bancard — necesita bancardUserId
    if (!user.bancardUserId) {
      return res.status(400).json({ success: false, message: 'Primero necesitás registrar una tarjeta de pago.' });
    }

    // Seleccionar tarjeta
    let selectedCard;
    if (cardId) {
      selectedCard = user.paymentCards.find((c) => c.id === cardId);
      if (!selectedCard) return res.status(400).json({ success: false, message: 'Tarjeta no encontrada' });
    } else {
      selectedCard = user.paymentCards.find((c) => c.isPrimary) || user.paymentCards[0];
    }
    if (!selectedCard) {
      return res.status(400).json({ success: false, message: 'No tenés tarjetas registradas. Agregá una tarjeta primero.' });
    }

    // Refrescar alias_token (TTL corto)
    let aliasToken = selectedCard.bancardAliasToken;
    try {
      const bancardCards = await bancardService.getUserCards(user.bancardUserId);
      const fresh = bancardCards.find((c) => parseInt(c.card_id) === selectedCard.bancardCardId);
      if (fresh && fresh.alias_token) {
        aliasToken = fresh.alias_token;
        await req.prisma.paymentCard.update({
          where: { id: selectedCard.id },
          data: { bancardAliasToken: aliasToken },
        });
      }
    } catch (e) {
      console.warn('[Bancard] No se pudo refrescar alias_token de la recarga, usando el cacheado:', e.message);
    }
    if (!aliasToken) {
      return res.status(400).json({
        success: false,
        message: 'No se pudo obtener el token de la tarjeta. Por favor sincronizá tus tarjetas e intentá de nuevo.',
      });
    }

    // Lock ATÓMICO anti doble-cobro (mismo patrón que charge-membership): SELECT ... FOR UPDATE
    // sobre el usuario serializa reintentos concurrentes; el segundo ve el PENDING y aborta.
    const shopProcessId = bancardService.generateShopProcessId();
    const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://luxurygarage.com.py';
    const returnUrl = `${appBaseUrl}/billetera?topupResult=1`;

    try {
      await req.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
        const inFlight = await tx.bancardOperation.findFirst({
          where: { userId: user.id, type: 'charge', status: 'PENDING' },
        });
        if (inFlight) throw Object.assign(new Error('CHARGE_IN_FLIGHT'), { code: 'CHARGE_IN_FLIGHT' });
        await tx.bancardOperation.create({
          data: {
            shopProcessId, userId: user.id, type: 'charge', status: 'PENDING',
            amountGs: amount,
            metadataJson: { kind: 'topup', amountGs: amount, cardId: selectedCard.id },
          },
        });
        await tx.payment.create({
          data: {
            userId: user.id, amountGs: amount, paymentMethod: 'bancard_card',
            bancardShopProcessId: shopProcessId, status: 'PENDING', description,
          },
        });
      });
    } catch (e) {
      if (e.code === 'CHARGE_IN_FLIGHT') {
        return res.status(409).json({
          success: false,
          message: 'Ya tenés un cobro en proceso. Esperá unos segundos antes de reintentar.',
        });
      }
      throw e;
    }
    const pendingPayment = await req.prisma.payment.findUnique({ where: { bancardShopProcessId: shopProcessId } });

    // Ejecutar el cobro
    let chargeResult;
    try {
      chargeResult = await bancardService.charge({
        shopProcessId,
        amount,
        aliasToken,
        description,
        returnUrl,
      });
    } catch (bancardErr) {
      await req.prisma.payment.update({
        where: { id: pendingPayment.id },
        data: { status: 'FAILED', description: `${description} — Error: ${bancardErr.message}` },
      });
      await req.prisma.bancardOperation.update({ where: { shopProcessId }, data: { status: 'FAILED' } });
      const userMsg = bancardErr.message.startsWith('Bancard:')
        ? bancardErr.message.replace('Bancard: ', '')
        : 'No se pudo procesar el cobro. Intentá con otra tarjeta.';
      return res.status(402).json({ success: false, message: userMsg });
    }

    // 3DS requerido
    if (chargeResult.threeDsRequired) {
      await req.prisma.bancardOperation.update({
        where: { shopProcessId },
        data: { status: 'PENDING', processId: chargeResult.processId ? String(chargeResult.processId) : null },
      });
      return res.json({
        success: true,
        requires3ds: true,
        data: { processId: chargeResult.processId, jsLibUrl: bancardService.jsLibUrl, shopProcessId },
        message: 'Autenticación 3DS requerida. Completá el proceso en el iframe.',
      });
    }

    // Rechazado
    if (!chargeResult.approved) {
      await req.prisma.payment.update({
        where: { id: pendingPayment.id },
        data: { status: 'FAILED', description: `${description} — Rechazado (${chargeResult.responseCode || 'N/A'})` },
      });
      await req.prisma.bancardOperation.update({ where: { shopProcessId }, data: { status: 'FAILED' } });
      return res.status(402).json({
        success: false,
        message: 'El cobro fue rechazado. Verificá tu tarjeta o intentá con otra.',
        data: { responseCode: chargeResult.responseCode },
      });
    }

    // Aprobado → acreditar Credit + completar Payment en una transacción
    const bancardTicketNumber = chargeResult.ticketNumber;
    const bancardAuthNumber = chargeResult.authorizationNumber;
    let payment, alreadyMaterialized = false;
    await req.prisma.$transaction(async (tx) => {
      // Lock + re-check anti doble-acreditación: el camino DIRECTO también debe sostener el lock del
      // webhook/job. Sin esto el webhook /confirm concurrente duplica el Credit (doble saldo gastable).
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
      const freshOp = await tx.bancardOperation.findUnique({ where: { shopProcessId } });
      if (freshOp?.status === 'COMPLETED') { alreadyMaterialized = true; return; }

      await tx.credit.create({
        data: {
          userId: user.id,
          amount,
          type: 'WALLET_TOPUP',
          description: `${description} ${selectedCard.maskedNumber ? '****' + selectedCard.maskedNumber.slice(-4) : ''}`.trim(),
        },
      });
      payment = await tx.payment.update({
        where: { bancardShopProcessId: shopProcessId },
        data: {
          status: 'COMPLETED',
          bancardTicketNumber: bancardTicketNumber || null,
          bancardAuthNumber: bancardAuthNumber || null,
        },
      });
      await tx.bancardOperation.update({ where: { shopProcessId }, data: { status: 'COMPLETED' } });
      await tx.auditLog.create({
        data: {
          entity: 'payment', action: 'wallet_topup_bancard', entityId: payment.id, userId: user.id,
          detailsJson: {
            amountGs: amount, shopProcessId,
            ticketNumber: bancardTicketNumber, authNumber: bancardAuthNumber,
            cardBrand: selectedCard.brand, cardMask: selectedCard.maskedNumber,
          },
        },
      });
    });

    if (alreadyMaterialized) {
      return res.json({ success: true, message: 'La recarga ya fue procesada.', data: { alreadyCompleted: true, amountGs: amount } });
    }

    // Asiento contable (best-effort, POST-COMMIT, no bloqueante).
    if (payment?.id) postPaymentCompleted(req.prisma, payment.id).catch(() => {});

    console.log(`[Bancard] Recarga de billetera ₲${amount} acreditada para ${user.email} — shopProcessId=${shopProcessId}`);

    res.json({
      success: true,
      data: { payment: { id: payment.id, shopProcessId, status: 'COMPLETED' }, amountGs: amount },
      message: `¡Recarga de ₲${amount.toLocaleString('es-PY')} acreditada exitosamente!`,
    });
  } catch (err) {
    console.error('[Bancard] charge-topup error:', err.message);
    next(err);
  }
});

/**
 * POST /api/payments/charge-topup-3ds-complete
 * Finaliza una recarga de billetera tras el challenge 3DS. Acredita el Credit de forma idempotente.
 * Body: { shopProcessId }
 */
router.post('/charge-topup-3ds-complete', authenticate, async (req, res, next) => {
  try {
    const { shopProcessId } = req.body;
    if (!shopProcessId) return res.status(400).json({ success: false, message: 'shopProcessId requerido' });

    const pendingPayment = await req.prisma.payment.findFirst({
      where: { bancardShopProcessId: Number(shopProcessId), userId: req.user.id },
    });
    if (!pendingPayment) return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    if (pendingPayment.status === 'COMPLETED') {
      return res.json({ success: true, message: 'La recarga ya fue procesada', data: { alreadyCompleted: true } });
    }

    // El monto se deriva del registro PERSISTIDO (no del body).
    const op = await req.prisma.bancardOperation.findFirst({
      where: { shopProcessId: Number(shopProcessId), userId: req.user.id },
    });
    const persistedAmount = op?.metadataJson?.amountGs ?? op?.amountGs ?? null;
    if (op?.metadataJson?.kind !== 'topup' || !persistedAmount) {
      return res.status(400).json({ success: false, message: 'No se pudo determinar el monto de esta recarga.' });
    }
    const amount = Number(persistedAmount);

    // Verificar con Bancard
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

    const approved = confirmation.response === 'S' && String(confirmation.response_code) === '00';

    // SEGURIDAD: validar que el monto cobrado coincida con el persistido.
    if (approved) {
      const confirmedAmount = Math.round(parseFloat(confirmation.amount));
      if (!Number.isFinite(confirmedAmount) || confirmedAmount !== amount) {
        await req.prisma.payment.update({
          where: { id: pendingPayment.id },
          data: { status: 'FAILED', description: `${pendingPayment.description || ''} — Monto no coincide (cobrado ${confirmation.amount}, esperado ${amount})` },
        });
        await req.prisma.bancardOperation.update({
          where: { shopProcessId: Number(shopProcessId) },
          data: { status: 'FAILED' },
        });
        return res.status(402).json({
          success: false,
          message: 'El monto cobrado no coincide con el de la recarga. No se acreditó el saldo.',
        });
      }
    }

    if (!approved) {
      await req.prisma.payment.update({ where: { id: pendingPayment.id }, data: { status: 'FAILED' } });
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

    const bancardTicketNumber = confirmation.ticket_number || null;
    const bancardAuthNumber = confirmation.authorization_number || null;

    let payment, alreadyMaterialized = false;
    await req.prisma.$transaction(async (tx) => {
      // Lock + re-check anti doble-acreditación con el webhook/job de reconciliación.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.user.id} FOR UPDATE`;
      const freshOp = await tx.bancardOperation.findUnique({ where: { shopProcessId: Number(shopProcessId) } });
      if (freshOp?.status === 'COMPLETED') { alreadyMaterialized = true; return; }

      await tx.credit.create({
        data: { userId: req.user.id, amount, type: 'WALLET_TOPUP', description: 'Recarga de billetera' },
      });
      payment = await tx.payment.update({
        where: { bancardShopProcessId: Number(shopProcessId) },
        data: { status: 'COMPLETED', bancardTicketNumber, bancardAuthNumber },
      });
      await tx.bancardOperation.update({
        where: { shopProcessId: Number(shopProcessId) },
        data: { status: 'COMPLETED' },
      });
      await tx.auditLog.create({
        data: {
          entity: 'payment', action: 'wallet_topup_bancard_3ds', entityId: payment.id, userId: req.user.id,
          detailsJson: { amountGs: amount, shopProcessId, ticketNumber: bancardTicketNumber, authNumber: bancardAuthNumber },
        },
      });
    });

    if (alreadyMaterialized) {
      return res.json({ success: true, message: 'La recarga ya fue procesada.', data: { alreadyCompleted: true, amountGs: amount } });
    }

    // Asiento contable (best-effort, POST-COMMIT, no bloqueante).
    if (payment?.id) postPaymentCompleted(req.prisma, payment.id).catch(() => {});

    console.log(`[Bancard] 3DS recarga ₲${amount} acreditada para user ${req.user.id} — shopProcessId=${shopProcessId}`);

    res.json({
      success: true,
      data: { payment: { id: payment.id, shopProcessId, status: 'COMPLETED' }, amountGs: amount },
      message: `¡Recarga de ₲${amount.toLocaleString('es-PY')} acreditada exitosamente!`,
    });
  } catch (err) {
    console.error('[Bancard] charge-topup-3ds-complete error:', err.message);
    next(err);
  }
});

// ─────────────────────────────────────────────────────
//  PAYMENT HISTORY
// ─────────────────────────────────────────────────────

/**
 * GET /api/payments/history
 * Payment history for the current user (admins see all).
 * Admins can paginate and filter: ?page&limit&status&search
 *   - status: a PaymentStatus value (COMPLETED|PENDING|FAILED|...)
 *   - search: matches client first/last name, email or description
 */
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

    const where = isAdmin ? {} : { userId: req.user.id };

    // Admin-only filters
    if (isAdmin) {
      const VALID_STATUS = ['PENDING', 'PROCESSING', 'REQUIRES_ACTION', 'COMPLETED', 'FAILED', 'REFUNDED'];
      if (req.query.status && VALID_STATUS.includes(req.query.status)) {
        where.status = req.query.status;
      }
      const search = (req.query.search || '').trim();
      if (search) {
        where.OR = [
          { description: { contains: search, mode: 'insensitive' } },
          { user: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
          { user: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
          { user: { is: { email: { contains: search, mode: 'insensitive' } } } },
        ];
      }
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      req.prisma.payment.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          membership: { include: { plan: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      req.prisma.payment.count({ where }),
    ]);

    res.json({
      success: true,
      data: payments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
//  ADMIN FINANCE SUMMARY
// ─────────────────────────────────────────────────────

/**
 * GET /api/payments/admin/finance
 * Aggregated financial figures for the admin Finance dashboard — all from real
 * Payment rows. Returns totals (completed / pending / failed), average ticket,
 * a breakdown by payment method, and a 6-month revenue time series.
 */
router.get('/admin/finance', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      completedAll,
      completedMonth,
      pendingAgg,
      failedMonth,
      refundedAgg,
      totalCount,
      byMethodRaw,
    ] = await Promise.all([
      req.prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amountGs: true }, _count: { _all: true } }),
      req.prisma.payment.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: startOfMonth } }, _sum: { amountGs: true }, _count: { _all: true } }),
      req.prisma.payment.aggregate({ where: { status: { in: ['PENDING', 'PROCESSING', 'REQUIRES_ACTION'] } }, _sum: { amountGs: true }, _count: { _all: true } }),
      req.prisma.payment.count({ where: { status: 'FAILED', createdAt: { gte: startOfMonth } } }),
      req.prisma.payment.aggregate({ where: { status: 'REFUNDED' }, _sum: { amountGs: true }, _count: { _all: true } }),
      req.prisma.payment.count(),
      req.prisma.payment.groupBy({ by: ['paymentMethod'], where: { status: 'COMPLETED' }, _sum: { amountGs: true }, _count: { _all: true } }),
    ]);

    const totalCompleted = completedAll._sum.amountGs || 0;
    const completedCount = completedAll._count._all || 0;
    const averageTicket = completedCount > 0 ? Math.round(totalCompleted / completedCount) : 0;

    const byMethod = byMethodRaw.map((row) => ({
      method: row.paymentMethod || 'otro',
      total: row._sum.amountGs || 0,
      count: row._count._all,
    }));

    // 6-month revenue series (COMPLETED only)
    const seriesStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const seriesPayments = await req.prisma.payment.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: seriesStart } },
      select: { amountGs: true, createdAt: true },
    });
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const bucket = seriesPayments.filter((p) => p.createdAt >= d && p.createdAt < next);
      monthlyRevenue.push({
        name: d.toLocaleDateString('es-PY', { month: 'short' }),
        revenue: bucket.reduce((s, p) => s + (p.amountGs || 0), 0),
      });
    }

    res.json({
      success: true,
      data: {
        totalCompleted,
        completedCount,
        monthRevenue: completedMonth._sum.amountGs || 0,
        monthTransactions: completedMonth._count._all || 0,
        pendingTotal: pendingAgg._sum.amountGs || 0,
        pendingCount: pendingAgg._count._all || 0,
        failedMonth,
        refundedTotal: refundedAgg._sum.amountGs || 0,
        refundedCount: refundedAgg._count._all || 0,
        totalTransactions: totalCount,
        averageTicket,
        byMethod,
        monthlyRevenue,
      },
    });
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
