const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const orderService = require('../services/orderService');
const bancardService = require('../services/bancardService');
const { materializeApprovedPayment } = require('../services/paymentReconciliation');

/**
 * Tienda del cliente: catálogo, carrito y el QR de compra que después escanea el operario.
 *
 * Acá NO se cobra nada. El cliente arma su pedido y elige con qué va a pagar; el débito lo
 * dispara el operario cuando verifica lo que se lleva (ver routes/sales.js).
 */

const productoPublico = (p) => ({
  id: p.id,
  name: p.name,
  brand: p.brand,
  category: p.saleCategory || p.category || 'Otros',
  priceGs: p.salePriceGs,
  imageUrl: p.imageUrl,
  unit: p.unit,
  stock: p.currentStock,
  available: p.currentStock > 0,
});

// GET /api/shop/products — catálogo que ve el cliente
router.get('/products', authenticate, async (req, res, next) => {
  try {
    const { q, category } = req.query;
    const where = { isForSale: true, isActive: true, salePriceGs: { gt: 0 } };
    if (category && category !== 'todos') where.saleCategory = String(category);
    if (q && String(q).trim()) {
      const term = String(q).trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { brand: { contains: term, mode: 'insensitive' } },
        { saleCategory: { contains: term, mode: 'insensitive' } },
      ];
    }

    const productos = await req.prisma.inventoryItem.findMany({
      where,
      orderBy: [{ saleOrder: 'asc' }, { name: 'asc' }],
      take: 200,
    });

    // Las categorías salen del catálogo completo, no del filtrado: si no, al filtrar por una
    // categoría desaparecerían las demás y el cliente quedaría encerrado ahí.
    const todas = await req.prisma.inventoryItem.findMany({
      where: { isForSale: true, isActive: true, salePriceGs: { gt: 0 } },
      select: { saleCategory: true },
    });
    const categorias = [...new Set(todas.map((p) => p.saleCategory).filter(Boolean))].sort();

    res.json({ success: true, data: productos.map(productoPublico), categories: categorias });
  } catch (err) { next(err); }
});

// GET /api/shop/payment-options — con qué puede pagar: saldo y tarjetas catastradas
router.get('/payment-options', authenticate, async (req, res, next) => {
  try {
    const [saldo, tarjetas] = await Promise.all([
      orderService.saldoDisponible(req.prisma, req.user.id),
      req.prisma.paymentCard.findMany({
        where: { userId: req.user.id },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, maskedNumber: true, brand: true, alias: true, isPrimary: true, expirationDate: true },
      }),
    ]);
    res.json({ success: true, data: { walletBalanceGs: saldo, cards: tarjetas } });
  } catch (err) { next(err); }
});

/** Serializa el pedido para el cliente, con el QR sólo mientras sigue vivo. */
function pedidoParaCliente(order, { conToken = true } = {}) {
  const vivo = ['PENDING', 'SCANNED', 'AUTHORIZING'].includes(order.status);
  return {
    id: order.id,
    status: order.status,
    totalGs: order.totalGs,
    paymentMethod: order.paymentMethod,
    cardId: order.cardId,
    declineReason: order.declineReason,
    expiresAt: order.expiresAt,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    items: (order.items || []).map((i) => ({
      itemId: i.itemId, name: i.nameSnapshot, unitPriceGs: i.unitPriceGs, qty: i.qty, lineTotalGs: i.lineTotalGs,
    })),
    qrToken: conToken && vivo ? orderService.buildOrderToken(order.id) : null,
  };
}

/**
 * Si el banco pidió verificación, el cliente tiene que resolverla en SU teléfono: se le
 * devuelven los datos del desafío para abrir el iframe de Bancard.
 */
async function conDesafio3ds(prisma, order, payload) {
  if (order.status !== 'AUTHORIZING' || !order.bancardShopProcessId) return payload;
  const op = await prisma.bancardOperation.findUnique({
    where: { shopProcessId: Number(order.bancardShopProcessId) },
    select: { processId: true },
  });
  if (!op?.processId) return payload;
  return { ...payload, threeDs: { processId: op.processId, jsLibUrl: bancardService.jsLibUrl } };
}

// POST /api/shop/orders — confirmar el carrito y generar el QR de compra
router.post('/orders', authenticate, async (req, res, next) => {
  try {
    const { items, paymentMethod, cardId } = req.body;
    if (!['wallet', 'card'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Elegí cómo vas a pagar' });
    }

    const { lineas, totalGs } = await orderService.armarLineas(req.prisma, items);

    // El medio de pago se valida ACÁ, no en el mostrador: que el cliente se entere de que le
    // falta saldo mientras arma el pedido, no con el operario esperando.
    if (paymentMethod === 'wallet') {
      const saldo = await orderService.saldoDisponible(req.prisma, req.user.id);
      if (saldo < totalGs) {
        return res.status(400).json({
          success: false, code: 'INSUFFICIENT_BALANCE',
          message: `Te falta ₲${(totalGs - saldo).toLocaleString('es-PY')} de saldo. Recargá tu billetera o pagá con tarjeta.`,
        });
      }
    } else {
      const tarjeta = cardId
        ? await req.prisma.paymentCard.findFirst({ where: { id: String(cardId), userId: req.user.id } })
        : await req.prisma.paymentCard.findFirst({ where: { userId: req.user.id }, orderBy: { isPrimary: 'desc' } });
      if (!tarjeta) {
        return res.status(400).json({
          success: false, code: 'NO_CARD',
          message: 'Agregá una tarjeta desde tu perfil para poder comprar.',
        });
      }
      req.body.cardId = tarjeta.id;
    }

    // Un solo pedido vivo por cliente: si arma otro, el anterior se cancela. Así el operario
    // nunca ve dos QR del mismo cliente ni se confunde de pedido.
    await req.prisma.order.updateMany({
      where: { userId: req.user.id, status: { in: ['PENDING', 'SCANNED'] } },
      data: { status: 'CANCELLED' },
    });

    const ahora = new Date();
    const order = await req.prisma.order.create({
      data: {
        userId: req.user.id,
        status: 'PENDING',
        totalGs,
        paymentMethod,
        cardId: paymentMethod === 'card' ? req.body.cardId : null,
        qrIssuedAt: ahora,
        expiresAt: new Date(ahora.getTime() + orderService.ORDER_QR_VALIDITY_MS),
        items: { create: lineas },
      },
      include: { items: true },
    });

    res.status(201).json({ success: true, data: pedidoParaCliente(order) });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
    next(err);
  }
});

// GET /api/shop/orders/current — el pedido vivo del cliente (lo usa la pantalla del QR)
router.get('/orders/current', authenticate, async (req, res, next) => {
  try {
    await req.prisma.order.updateMany({
      where: { userId: req.user.id, status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
    const order = await req.prisma.order.findFirst({
      where: { userId: req.user.id, status: { in: ['PENDING', 'SCANNED', 'AUTHORIZING'] } },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    res.json({ success: true, data: order ? await conDesafio3ds(req.prisma, order, pedidoParaCliente(order)) : null });
  } catch (err) { next(err); }
});

// GET /api/shop/orders/:id — estado del pedido (la pantalla del cliente lo consulta cada 2,5 s)
router.get('/orders/:id', authenticate, async (req, res, next) => {
  try {
    const order = await req.prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });

    if (order.status === 'PENDING' && order.expiresAt && order.expiresAt < new Date()) {
      const vencido = await req.prisma.order.update({
        where: { id: order.id }, data: { status: 'EXPIRED' }, include: { items: true },
      });
      return res.json({ success: true, data: pedidoParaCliente(vencido) });
    }
    res.json({ success: true, data: await conDesafio3ds(req.prisma, order, pedidoParaCliente(order)) });
  } catch (err) { next(err); }
});

/**
 * POST /api/shop/orders/:id/refresh
 * El cliente terminó la verificación del banco en su teléfono. En vez de confiar en lo que
 * diga el navegador, se le pregunta a Bancard cuál fue el resultado real y se cierra la venta
 * por el mismo camino idempotente que usan el webhook y la reconciliación.
 */
router.post('/orders/:id/refresh', authenticate, async (req, res, next) => {
  try {
    const order = await req.prisma.order.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    if (order.bancardShopProcessId) {
      try {
        await materializeApprovedPayment(req.prisma, Number(order.bancardShopProcessId));
      } catch (e) {
        console.error('[Tienda] refresh de pago falló:', e.message);
      }
    }
    const fresco = await req.prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
    res.json({ success: true, data: await conDesafio3ds(req.prisma, fresco, pedidoParaCliente(fresco)) });
  } catch (err) { next(err); }
});

// POST /api/shop/orders/:id/cancel — arrepentirse, sólo antes de que lo escaneen
router.post('/orders/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const order = await req.prisma.order.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    if (order.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: order.status === 'PAID' ? 'Esta compra ya fue pagada' : 'El encargado ya está revisando tu pedido',
      });
    }
    const cancelado = await req.prisma.order.update({
      where: { id: order.id }, data: { status: 'CANCELLED' }, include: { items: true },
    });
    res.json({ success: true, data: pedidoParaCliente(cancelado) });
  } catch (err) { next(err); }
});

// GET /api/shop/orders — historial de compras del cliente
router.get('/orders', authenticate, async (req, res, next) => {
  try {
    const orders = await req.prisma.order.findMany({
      where: { userId: req.user.id, status: { in: ['PAID', 'VOIDED'] } },
      orderBy: { paidAt: 'desc' },
      take: 30,
      include: { items: true },
    });
    res.json({ success: true, data: orders.map((o) => pedidoParaCliente(o, { conToken: false })) });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.pedidoParaCliente = pedidoParaCliente;
