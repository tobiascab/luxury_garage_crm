const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const bancardService = require('../services/bancardService');
const orderService = require('../services/orderService');
const { postPaymentCompleted } = require('../services/journalService');

/**
 * Módulo Ventas del operario: escanear el QR del cliente, verificar lo que se lleva y cobrar.
 *
 * El operario nunca escribe un monto ni toca la tarjeta del cliente: el pedido ya viene con su
 * total congelado y con el medio de pago que el cliente eligió. Acá se aprieta un botón.
 */

const soloStaff = [authenticate, authorize('EMPLOYEE', 'ADMIN', 'SUPER_ADMIN')];

/** Todo lo que el operario necesita ver para cotejar el pedido contra la mano del cliente. */
async function vistaOperario(prisma, order) {
  const [cliente, saldo, tarjeta] = await Promise.all([
    prisma.user.findUnique({
      where: { id: order.userId },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    }),
    orderService.saldoDisponible(prisma, order.userId),
    order.cardId
      ? prisma.paymentCard.findUnique({ where: { id: order.cardId }, select: { maskedNumber: true, brand: true } })
      : Promise.resolve(null),
  ]);

  // Foto y stock actual de cada producto: el operario compara contra lo que tiene enfrente.
  const productos = await prisma.inventoryItem.findMany({
    where: { id: { in: order.items.map((i) => i.itemId) } },
    select: { id: true, imageUrl: true, currentStock: true, unit: true },
  });
  const porId = new Map(productos.map((p) => [p.id, p]));

  const items = order.items.map((i) => {
    const p = porId.get(i.itemId);
    return {
      itemId: i.itemId,
      name: i.nameSnapshot,
      qty: i.qty,
      unitPriceGs: i.unitPriceGs,
      lineTotalGs: i.lineTotalGs,
      imageUrl: p?.imageUrl || null,
      unit: p?.unit || 'unidad',
      stockActual: p?.currentStock ?? null,
      sinStock: (p?.currentStock ?? 0) < i.qty,
    };
  });

  return {
    orderId: order.id,
    status: order.status,
    totalGs: order.totalGs,
    createdAt: order.createdAt,
    client: cliente ? { id: cliente.id, name: `${cliente.firstName} ${cliente.lastName}`.trim(), avatarUrl: cliente.avatarUrl } : null,
    payment: {
      method: order.paymentMethod,
      walletBalanceGs: saldo,
      // Con saldo insuficiente el cobro va a fallar: que el operario lo sepa ANTES de apretar.
      walletAlcanza: order.paymentMethod !== 'wallet' || saldo >= order.totalGs,
      card: tarjeta ? { maskedNumber: tarjeta.maskedNumber, brand: tarjeta.brand } : null,
    },
    items,
    avisoStock: items.some((i) => i.sinStock),
  };
}

// POST /api/sales/verify — leer el QR. Identifica el pedido; NO cobra ni descuenta nada.
router.post('/verify', soloStaff, async (req, res, next) => {
  try {
    const v = orderService.verifyOrderToken(req.body?.token);
    if (!v.ok) {
      const msg = v.reason === 'expired' ? 'El código venció. Pedile al cliente que lo genere de nuevo.'
        : v.reason === 'signature' ? 'Código inválido o adulterado'
          : 'Código inválido';
      return res.status(400).json({ success: false, message: msg });
    }

    const order = await req.prisma.order.findUnique({ where: { id: v.orderId }, include: { items: true } });
    if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });

    if (order.status === 'PAID') {
      return res.status(400).json({ success: false, code: 'ALREADY_PAID', message: 'Esta compra ya fue cobrada.' });
    }
    if (['CANCELLED', 'EXPIRED', 'VOIDED'].includes(order.status)) {
      return res.status(400).json({
        success: false, code: order.status,
        message: order.status === 'EXPIRED' ? 'El pedido venció. Pedile al cliente que lo arme de nuevo.' : 'El cliente canceló este pedido.',
      });
    }

    // Queda marcado como escaneado: desde acá el cliente ya no puede cancelarlo por su cuenta.
    if (order.status === 'PENDING') {
      await req.prisma.order.update({
        where: { id: order.id },
        data: { status: 'SCANNED', scannedAt: new Date(), employeeId: req.user.id },
      });
      order.status = 'SCANNED';
    }

    res.json({ success: true, data: await vistaOperario(req.prisma, order) });
  } catch (err) { next(err); }
});

// PATCH /api/sales/orders/:id/items — ajustar lo que el cliente realmente se lleva
router.patch('/orders/:id/items', soloStaff, async (req, res, next) => {
  try {
    const order = await req.prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    if (!['PENDING', 'SCANNED', 'DECLINED'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Este pedido ya no se puede modificar' });
    }

    const { lineas, totalGs } = await orderService.armarLineas(req.prisma, req.body?.items);

    const actualizado = await req.prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      await tx.orderItem.createMany({ data: lineas.map((l) => ({ ...l, orderId: order.id })) });
      return tx.order.update({
        where: { id: order.id },
        data: { totalGs, employeeId: req.user.id },
        include: { items: true },
      });
    });

    res.json({ success: true, data: await vistaOperario(req.prisma, actualizado) });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
    next(err);
  }
});

// POST /api/sales/orders/:id/charge — cobrar. Es el único punto que mueve dinero.
router.post('/orders/:id/charge', soloStaff, async (req, res, next) => {
  try {
    const order = await req.prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });

    if (order.status === 'PAID') {
      // Reintento sobre algo ya cobrado: devolver el comprobante, NUNCA cobrar de nuevo.
      return res.json({ success: true, alreadyPaid: true, data: await vistaOperario(req.prisma, order), message: 'Esta compra ya estaba pagada' });
    }
    if (!['SCANNED', 'PENDING', 'DECLINED'].includes(order.status)) {
      return res.status(400).json({ success: false, message: `El pedido está ${order.status.toLowerCase()}` });
    }
    if (!order.items.length) {
      return res.status(400).json({ success: false, message: 'El pedido quedó sin productos' });
    }

    // ── Camino 1: saldo de la billetera. Instantáneo, sin banco ────────────────
    if (order.paymentMethod === 'wallet') {
      try {
        const r = await orderService.cobrarConSaldo(req.prisma, { orderId: order.id, employeeId: req.user.id });
        const fresco = await req.prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
        return res.json({
          success: true, paid: true, method: 'wallet',
          data: await vistaOperario(req.prisma, fresco),
          message: r.reason === 'already_paid' ? 'Esta compra ya estaba pagada' : 'Cobrado del saldo del cliente',
        });
      } catch (e) {
        if (e.statusCode === 400) {
          await req.prisma.order.update({ where: { id: order.id }, data: { status: 'DECLINED', declineReason: e.message } });
          return res.status(400).json({ success: false, code: e.code || 'DECLINED', message: e.message });
        }
        throw e;
      }
    }

    // ── Camino 2: tarjeta catastrada ───────────────────────────────────────────
    const user = await req.prisma.user.findUnique({
      where: { id: order.userId },
      include: { paymentCards: true },
    });
    if (!user?.bancardUserId) {
      return res.status(400).json({ success: false, message: 'El cliente todavía no tiene una tarjeta registrada.' });
    }
    const selectedCard = order.cardId
      ? user.paymentCards.find((c) => c.id === order.cardId)
      : (user.paymentCards.find((c) => c.isPrimary) || user.paymentCards[0]);
    if (!selectedCard) {
      return res.status(400).json({ success: false, message: 'El cliente no tiene tarjetas registradas.' });
    }

    // El alias_token vence rápido: se pide uno fresco antes de cobrar.
    let aliasToken = selectedCard.bancardAliasToken;
    try {
      const cards = await bancardService.getUserCards(user.bancardUserId);
      const fresh = cards.find((c) => parseInt(c.card_id) === selectedCard.bancardCardId);
      if (fresh?.alias_token) {
        aliasToken = fresh.alias_token;
        await req.prisma.paymentCard.update({ where: { id: selectedCard.id }, data: { bancardAliasToken: aliasToken } });
      }
    } catch (e) {
      console.warn('[Ventas] No se pudo refrescar el alias_token, se usa el guardado:', e.message);
    }
    if (!aliasToken) {
      return res.status(400).json({ success: false, message: 'No se pudo leer la tarjeta del cliente. Que la sincronice desde su perfil.' });
    }

    const detalle = order.items.map((i) => `${i.qty}× ${i.nameSnapshot}`).join(', ');
    const description = `Compra en Luxury Garage - ${detalle}`.slice(0, 120);
    const shopProcessId = bancardService.generateShopProcessId();

    // Lock anti doble cobro: mismo patrón que el cobro de membresías. Serializa dos toques del
    // botón y cualquier reintento de red del mismo cliente.
    try {
      await req.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
        const enVuelo = await tx.bancardOperation.findFirst({ where: { userId: user.id, type: 'charge', status: 'PENDING' } });
        if (enVuelo) throw Object.assign(new Error('CHARGE_IN_FLIGHT'), { code: 'CHARGE_IN_FLIGHT' });
        const yaPagado = await tx.order.findUnique({ where: { id: order.id }, select: { status: true } });
        if (yaPagado?.status === 'PAID') throw Object.assign(new Error('ALREADY_PAID'), { code: 'ALREADY_PAID' });

        await tx.bancardOperation.create({
          data: {
            shopProcessId, userId: user.id, type: 'charge', status: 'PENDING', amountGs: order.totalGs,
            // `kind: order` es lo que permite que el webhook y la reconciliación sepan qué
            // materializar cuando el cobro vuelve por 3DS.
            metadataJson: { kind: 'order', orderId: order.id, amountGs: order.totalGs, cardId: selectedCard.id, employeeId: req.user.id },
          },
        });
        await tx.payment.create({
          data: {
            userId: user.id, amountGs: order.totalGs, paymentMethod: 'bancard_card',
            bancardShopProcessId: shopProcessId, status: 'PENDING', description,
          },
        });
        await tx.order.update({ where: { id: order.id }, data: { bancardShopProcessId: BigInt(shopProcessId), employeeId: req.user.id } });
      });
    } catch (e) {
      if (e.code === 'CHARGE_IN_FLIGHT') {
        return res.status(409).json({ success: false, message: 'El cliente ya tiene un cobro en proceso. Esperá unos segundos.' });
      }
      if (e.code === 'ALREADY_PAID') {
        const fresco = await req.prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
        return res.json({ success: true, alreadyPaid: true, data: await vistaOperario(req.prisma, fresco) });
      }
      throw e;
    }

    const pendingPayment = await req.prisma.payment.findUnique({ where: { bancardShopProcessId: shopProcessId } });
    const billing = bancardService.buildBilling({
      client: bancardService.billingClientFromUser(user),
      items: order.items.map((i) => ({ description: i.nameSnapshot, amountGs: i.lineTotalGs, ivaRate: 10, qty: i.qty })),
      totalGs: order.totalGs,
    });

    const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://luxurygarage.com.py';
    let chargeResult;
    try {
      chargeResult = await bancardService.charge({
        shopProcessId, amount: order.totalGs, aliasToken, description,
        returnUrl: `${appBaseUrl}/tienda?compra=${order.id}`, billing,
      });
    } catch (bancardErr) {
      await req.prisma.payment.update({ where: { id: pendingPayment.id }, data: { status: 'FAILED', description: `${description} — error` } });
      await req.prisma.bancardOperation.update({ where: { shopProcessId }, data: { status: 'FAILED' } });
      const msg = bancardErr.message.startsWith('Bancard:') ? bancardErr.message.replace('Bancard: ', '') : 'No se pudo procesar el cobro.';
      await req.prisma.order.update({ where: { id: order.id }, data: { status: 'DECLINED', declineReason: msg } });
      return res.status(402).json({ success: false, message: msg });
    }

    // 3DS: la verificación la hace el CLIENTE en su teléfono. El operario espera.
    if (chargeResult.threeDsRequired) {
      await req.prisma.bancardOperation.update({
        where: { shopProcessId },
        data: { status: 'PENDING', processId: chargeResult.processId ? String(chargeResult.processId) : null },
      });
      await req.prisma.order.update({ where: { id: order.id }, data: { status: 'AUTHORIZING' } });
      return res.json({
        success: true, requires3ds: true,
        message: 'El banco pide que el cliente confirme en su teléfono.',
        data: { orderId: order.id },
      });
    }

    if (!chargeResult.approved) {
      const msg = 'El banco rechazó el cobro. Probá con otra tarjeta o con saldo.';
      await req.prisma.payment.update({ where: { id: pendingPayment.id }, data: { status: 'FAILED', description: `${description} — rechazado (${chargeResult.responseCode || 'N/A'})` } });
      await req.prisma.bancardOperation.update({ where: { shopProcessId }, data: { status: 'FAILED' } });
      await req.prisma.order.update({ where: { id: order.id }, data: { status: 'DECLINED', declineReason: msg } });
      return res.status(402).json({ success: false, message: msg, data: { responseCode: chargeResult.responseCode } });
    }

    // Aprobado en el acto: se cierra la venta (stock + caja) en una transacción.
    await req.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: 'COMPLETED',
          bancardTicketNumber: chargeResult.ticketNumber ? String(chargeResult.ticketNumber) : null,
          bancardAuthNumber: chargeResult.authorizationNumber ? String(chargeResult.authorizationNumber) : null,
        },
      });
      await tx.bancardOperation.update({ where: { shopProcessId }, data: { status: 'COMPLETED' } });
      await orderService.finalizarPagada(tx, order.id, {
        employeeId: req.user.id, paymentMethod: 'card', paymentId: pendingPayment.id, shopProcessId,
      });
    });

    // Asiento contable, igual que el cobro de una membresía: best-effort y POST-COMMIT, para
    // que un problema contable nunca tire abajo un cobro ya hecho.
    try {
      await postPaymentCompleted(req.prisma, pendingPayment.id);
    } catch (e) {
      console.error('[Ventas] asiento contable falló:', e?.message || e);
    }

    const fresco = await req.prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
    res.json({ success: true, paid: true, method: 'card', data: await vistaOperario(req.prisma, fresco), message: 'Cobrado a la tarjeta del cliente' });
  } catch (err) { next(err); }
});

// GET /api/sales/orders/:id — estado del pedido (para esperar el 3DS del cliente)
router.get('/orders/:id', soloStaff, async (req, res, next) => {
  try {
    const order = await req.prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    res.json({ success: true, data: await vistaOperario(req.prisma, order) });
  } catch (err) { next(err); }
});

// GET /api/sales/today — lo que vendió hoy este operario
router.get('/today', soloStaff, async (req, res, next) => {
  try {
    const desde = new Date(); desde.setHours(0, 0, 0, 0);
    const ventas = await req.prisma.order.findMany({
      where: { status: 'PAID', paidAt: { gte: desde }, employeeId: req.user.id },
      orderBy: { paidAt: 'desc' },
      include: { items: true, user: { select: { firstName: true, lastName: true } } },
    });
    res.json({
      success: true,
      data: {
        totalGs: ventas.reduce((s, o) => s + o.totalGs, 0),
        count: ventas.length,
        orders: ventas.map((o) => ({
          id: o.id, totalGs: o.totalGs, paidAt: o.paidAt, paymentMethod: o.paymentMethod,
          client: `${o.user.firstName} ${o.user.lastName}`.trim(),
          items: o.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
        })),
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
