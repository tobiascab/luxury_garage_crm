const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const orderService = require('../services/orderService');

/**
 * Caja del día: el corte de las ventas de mostrador.
 *
 * Es una SESIÓN que se abre y se cierra con hora y responsable, no un filtro por fecha. La
 * diferencia importa: una sesión cerrada es un documento que ya nadie mueve, mientras que un
 * filtro por fecha cambia de resultado cada vez que se carga una venta atrasada.
 */

const adminOnly = [authenticate, authorize('ADMIN', 'SUPER_ADMIN')];

/** Totales y desgloses de una sesión, calculados sobre sus ventas efectivas. */
async function resumenDeSesion(prisma, session) {
  const ventas = await prisma.order.findMany({
    where: { cashSessionId: session.id, status: 'PAID' },
    orderBy: { paidAt: 'desc' },
    include: {
      items: true,
      user: { select: { id: true, firstName: true, lastName: true } },
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const totalGs = ventas.reduce((s, o) => s + o.totalGs, 0);
  const porMedio = { wallet: 0, card: 0 };
  const porProducto = new Map();
  const porOperario = new Map();

  for (const o of ventas) {
    porMedio[o.paymentMethod === 'wallet' ? 'wallet' : 'card'] += o.totalGs;
    const quien = o.employee ? `${o.employee.firstName} ${o.employee.lastName}`.trim() : 'Sin asignar';
    const acum = porOperario.get(quien) || { totalGs: 0, count: 0 };
    porOperario.set(quien, { totalGs: acum.totalGs + o.totalGs, count: acum.count + 1 });
    for (const i of o.items) {
      const p = porProducto.get(i.nameSnapshot) || { qty: 0, totalGs: 0 };
      porProducto.set(i.nameSnapshot, { qty: p.qty + i.qty, totalGs: p.totalGs + i.lineTotalGs });
    }
  }

  const anuladas = await prisma.order.count({ where: { cashSessionId: session.id, status: 'VOIDED' } });

  return {
    id: session.id,
    status: session.status,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    openedBy: session.openedBy ? `${session.openedBy.firstName} ${session.openedBy.lastName}`.trim() : null,
    closedBy: session.closedBy ? `${session.closedBy.firstName} ${session.closedBy.lastName}`.trim() : null,
    notes: session.notes,
    totalGs: session.status === 'CLOSED' && session.totalGs != null ? session.totalGs : totalGs,
    ordersCount: ventas.length,
    voidedCount: anuladas,
    ticketPromedioGs: ventas.length ? Math.round(totalGs / ventas.length) : 0,
    porMedioDePago: porMedio,
    topProductos: [...porProducto.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10),
    porOperario: [...porOperario.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.totalGs - a.totalGs),
    orders: ventas.map((o) => ({
      id: o.id,
      totalGs: o.totalGs,
      paidAt: o.paidAt,
      paymentMethod: o.paymentMethod,
      client: `${o.user.firstName} ${o.user.lastName}`.trim(),
      employee: o.employee ? `${o.employee.firstName} ${o.employee.lastName}`.trim() : null,
      items: o.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty, lineTotalGs: i.lineTotalGs })),
    })),
  };
}

// GET /api/cash/current — la caja abierta, en vivo
router.get('/current', ...adminOnly, async (req, res, next) => {
  try {
    const abierta = await req.prisma.cashSession.findFirst({
      where: { status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
      include: { openedBy: true, closedBy: true },
    });
    if (!abierta) return res.json({ success: true, data: null });
    res.json({ success: true, data: await resumenDeSesion(req.prisma, abierta) });
  } catch (err) { next(err); }
});

// POST /api/cash/open — abrir la caja a mano (normalmente la abre sola la primera venta)
router.post('/open', ...adminOnly, async (req, res, next) => {
  try {
    const yaAbierta = await req.prisma.cashSession.findFirst({ where: { status: 'OPEN' } });
    if (yaAbierta) return res.status(400).json({ success: false, message: 'Ya hay una caja abierta' });
    const nueva = await req.prisma.cashSession.create({ data: { status: 'OPEN', openedById: req.user.id } });
    res.status(201).json({ success: true, data: await resumenDeSesion(req.prisma, nueva) });
  } catch (err) { next(err); }
});

// POST /api/cash/close — cerrar el día: el total queda congelado con hora y responsable
router.post('/close', ...adminOnly, async (req, res, next) => {
  try {
    const abierta = await req.prisma.cashSession.findFirst({ where: { status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
    if (!abierta) return res.status(400).json({ success: false, message: 'No hay ninguna caja abierta' });

    const enCurso = await req.prisma.order.count({
      where: { cashSessionId: abierta.id, status: { in: ['SCANNED', 'AUTHORIZING'] } },
    });
    if (enCurso) {
      return res.status(400).json({ success: false, message: `Hay ${enCurso} cobro(s) en curso. Esperá a que terminen para cerrar.` });
    }

    const resumen = await resumenDeSesion(req.prisma, abierta);
    const cerrada = await req.prisma.cashSession.update({
      where: { id: abierta.id },
      data: {
        status: 'CLOSED', closedAt: new Date(), closedById: req.user.id,
        totalGs: resumen.totalGs, ordersCount: resumen.ordersCount,
        notes: req.body?.notes ? String(req.body.notes).slice(0, 500) : null,
      },
      include: { openedBy: true, closedBy: true },
    });

    await req.prisma.auditLog.create({
      data: {
        userId: req.user.id, action: 'CASH_SESSION_CLOSED', entity: 'CashSession', entityId: cerrada.id,
        detailsJson: { totalGs: resumen.totalGs, ordersCount: resumen.ordersCount },
      },
    }).catch(() => {});

    res.json({ success: true, data: await resumenDeSesion(req.prisma, cerrada) });
  } catch (err) { next(err); }
});

// GET /api/cash/sessions — historial de cierres
router.get('/sessions', ...adminOnly, async (req, res, next) => {
  try {
    const sesiones = await req.prisma.cashSession.findMany({
      orderBy: { openedAt: 'desc' },
      take: 60,
      include: { openedBy: true, closedBy: true, _count: { select: { orders: true } } },
    });
    res.json({
      success: true,
      data: sesiones.map((s) => ({
        id: s.id, status: s.status, openedAt: s.openedAt, closedAt: s.closedAt,
        totalGs: s.totalGs, ordersCount: s.ordersCount ?? s._count.orders,
        closedBy: s.closedBy ? `${s.closedBy.firstName} ${s.closedBy.lastName}`.trim() : null,
      })),
    });
  } catch (err) { next(err); }
});

// GET /api/cash/sessions/:id — el detalle de un cierre
router.get('/sessions/:id', ...adminOnly, async (req, res, next) => {
  try {
    const s = await req.prisma.cashSession.findUnique({
      where: { id: req.params.id },
      include: { openedBy: true, closedBy: true },
    });
    if (!s) return res.status(404).json({ success: false, message: 'Caja no encontrada' });
    res.json({ success: true, data: await resumenDeSesion(req.prisma, s) });
  } catch (err) { next(err); }
});

// POST /api/cash/orders/:id/void — anular una venta cobrada (devuelve el stock)
router.post('/orders/:id/void', ...adminOnly, async (req, res, next) => {
  try {
    const motivo = String(req.body?.motivo || '').trim();
    if (motivo.length < 4) {
      return res.status(400).json({ success: false, message: 'Escribí el motivo de la anulación' });
    }
    const anulada = await orderService.anularVenta(req.prisma, { orderId: req.params.id, motivo, adminId: req.user.id });

    await req.prisma.auditLog.create({
      data: {
        userId: req.user.id, action: 'ORDER_VOIDED', entity: 'Order', entityId: anulada.id,
        detailsJson: { motivo, totalGs: anulada.totalGs, paymentMethod: anulada.paymentMethod },
      },
    }).catch(() => {});

    res.json({
      success: true,
      data: anulada,
      message: anulada.paymentMethod === 'wallet'
        ? 'Venta anulada. El saldo se devolvió al cliente y el stock volvió al inventario.'
        : 'Venta anulada y stock devuelto. El reembolso a la tarjeta hay que hacerlo desde Bancard.',
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
});

module.exports = router;
