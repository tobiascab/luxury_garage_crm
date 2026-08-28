const crypto = require('crypto');

/**
 * Ventas de mostrador: productos físicos que el cliente arma en su teléfono y el operario
 * cobra escaneando su QR.
 *
 * Todo lo que toca dinero o stock vive acá, no en las rutas, porque hay TRES caminos que
 * pueden terminar una venta y los tres tienen que dejar exactamente el mismo rastro:
 *   1. cobro con saldo de la billetera (instantáneo),
 *   2. cobro con tarjeta aprobado en el acto,
 *   3. cobro con tarjeta que pasó por 3DS y vuelve por el webhook o la reconciliación.
 *
 * Regla que ordena el módulo: el stock se descuenta y la venta entra a la caja SOLO cuando el
 * pago ya está hecho. Un QR sin cobrar no reserva mercadería ni figura en ninguna caja.
 */

// ── QR de compra ──────────────────────────────────────────────────────────────
// Mismo mecanismo que el carnet de lavado: lo firma el backend, así un empleado no puede
// fabricar el pedido de otro cliente. Vence a los 15 minutos.
const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET || 'luxury-qr-fallback-secret';
const ORDER_QR_VALIDITY_MS = 15 * 60 * 1000;

function signOrder(orderId, ts) {
  return crypto.createHmac('sha256', QR_SECRET).update(`order.${orderId}.${ts}`).digest('hex').slice(0, 24);
}

function buildOrderToken(orderId) {
  const ts = Date.now();
  return `LGSHOP-${orderId}-${ts}-${signOrder(orderId, ts)}`;
}

function verifyOrderToken(token) {
  if (!token || !token.startsWith('LGSHOP-')) return { ok: false, reason: 'format' };
  const parts = token.split('-');
  if (parts.length < 4) return { ok: false, reason: 'format' };
  const sig = parts.pop();
  const ts = parseInt(parts.pop(), 10);
  const orderId = parts.slice(1).join('-');
  if (!orderId || !Number.isFinite(ts)) return { ok: false, reason: 'format' };
  const expected = signOrder(orderId, ts);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return { ok: false, reason: 'signature' };
  }
  if (ts > Date.now() + 60_000) return { ok: false, reason: 'future' };
  if (Date.now() - ts > ORDER_QR_VALIDITY_MS) return { ok: false, reason: 'expired' };
  return { ok: true, orderId, ts };
}

// ── Saldo de la billetera ─────────────────────────────────────────────────────
// Mismo criterio que /api/credits y el perfil: suma de créditos no vencidos.
async function saldoDisponible(db, userId) {
  const r = await db.credit.aggregate({
    where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    _sum: { amount: true },
  });
  return r._sum.amount || 0;
}

// ── Caja del día ──────────────────────────────────────────────────────────────
/** Devuelve la sesión de caja abierta; si no hay ninguna, la abre. */
async function cajaAbierta(tx, userId = null) {
  const abierta = await tx.cashSession.findFirst({ where: { status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
  if (abierta) return abierta;
  return tx.cashSession.create({ data: { status: 'OPEN', openedById: userId } });
}

// ── Armado del carrito ────────────────────────────────────────────────────────
/**
 * Valida lo que el cliente quiere llevar y devuelve las líneas con el precio CONGELADO.
 * Rechaza lo que no está a la venta o no tiene precio: sin esto, un pedido armado a mano
 * podría cobrar ₲0 por un producto real.
 */
async function armarLineas(db, itemsPedidos) {
  if (!Array.isArray(itemsPedidos) || !itemsPedidos.length) {
    throw Object.assign(new Error('El carrito está vacío'), { statusCode: 400 });
  }
  // Un mismo producto repetido se suma en una sola línea.
  const porItem = new Map();
  for (const it of itemsPedidos) {
    const id = String(it.itemId || it.id || '');
    const qty = Math.trunc(Number(it.qty));
    if (!id || !Number.isFinite(qty) || qty < 1) {
      throw Object.assign(new Error('Cantidad inválida en el carrito'), { statusCode: 400 });
    }
    porItem.set(id, (porItem.get(id) || 0) + qty);
  }

  const productos = await db.inventoryItem.findMany({ where: { id: { in: [...porItem.keys()] } } });
  const porId = new Map(productos.map((p) => [p.id, p]));

  const lineas = [];
  let totalGs = 0;
  for (const [itemId, qty] of porItem) {
    const p = porId.get(itemId);
    if (!p || !p.isActive || !p.isForSale) {
      throw Object.assign(new Error(`"${p?.name || 'Un producto'}" ya no está disponible`), { statusCode: 400 });
    }
    if (!p.salePriceGs || p.salePriceGs <= 0) {
      throw Object.assign(new Error(`"${p.name}" no tiene precio cargado`), { statusCode: 400 });
    }
    const lineTotalGs = p.salePriceGs * qty;
    lineas.push({ itemId: p.id, nameSnapshot: p.name, unitPriceGs: p.salePriceGs, qty, lineTotalGs });
    totalGs += lineTotalGs;
  }
  return { lineas, totalGs };
}

// ── Cierre de la venta (los tres caminos terminan acá) ────────────────────────
/**
 * Marca el pedido pagado, descuenta el stock y lo suma a la caja abierta. Se corre DENTRO de
 * una transacción que ya tomó el lock del pedido.
 *
 * Es idempotente por partida doble: no hace nada si el pedido ya está PAID, y no vuelve a
 * descontar si ya existen movimientos de stock de esta venta. Un doble webhook, un reintento
 * del operario o la reconciliación pisando al webhook no pueden descontar stock dos veces.
 */
async function finalizarPagada(tx, orderId, { employeeId = null, paymentMethod, paymentId = null, creditId = null, shopProcessId = null } = {}) {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { status: 'noop', reason: 'order_not_found' };
  if (order.status === 'PAID') return { status: 'noop', reason: 'already_paid', order };
  if (['CANCELLED', 'EXPIRED', 'VOIDED'].includes(order.status)) {
    return { status: 'noop', reason: `order_${order.status.toLowerCase()}` };
  }

  const yaDescontado = await tx.stockMovement.count({ where: { orderId: order.id, type: 'SALE' } });
  if (!yaDescontado) {
    for (const linea of order.items) {
      const item = await tx.inventoryItem.findUnique({ where: { id: linea.itemId } });
      if (!item) continue;
      const after = item.currentStock - linea.qty;
      await tx.inventoryItem.update({ where: { id: item.id }, data: { currentStock: after } });
      await tx.stockMovement.create({
        data: {
          itemId: item.id,
          type: 'SALE',
          quantity: linea.qty,
          quantityBefore: item.currentStock,
          quantityAfter: after,
          reason: `Venta de mostrador (${linea.nameSnapshot})`,
          unitCostGs: item.costPerUnit ?? null,
          userId: employeeId || order.employeeId || null,
          orderId: order.id,
        },
      });
    }
  }

  const caja = order.cashSessionId
    ? await tx.cashSession.findUnique({ where: { id: order.cashSessionId } })
    : await cajaAbierta(tx, employeeId);

  const actualizado = await tx.order.update({
    where: { id: order.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      employeeId: employeeId || order.employeeId || null,
      paymentMethod: paymentMethod || order.paymentMethod,
      paymentId: paymentId || order.paymentId,
      creditId: creditId || order.creditId,
      bancardShopProcessId: shopProcessId != null ? BigInt(shopProcessId) : order.bancardShopProcessId,
      cashSessionId: caja?.id || null,
      declineReason: null,
    },
    include: { items: true },
  });

  return { status: 'paid', order: actualizado };
}

// ── Cobro con saldo de la billetera ───────────────────────────────────────────
/**
 * Instantáneo y sin banco: se descuenta del saldo igual que una reserva pagada con billetera
 * (un Credit negativo). El saldo se verifica DENTRO de la transacción y con la fila del usuario
 * bloqueada, para que dos cobros simultáneos no puedan gastar el mismo saldo dos veces.
 */
async function cobrarConSaldo(prisma, { orderId, employeeId }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw Object.assign(new Error('Pedido no encontrado'), { statusCode: 404 });
    if (order.status === 'PAID') return { status: 'noop', reason: 'already_paid', order };

    await tx.$queryRaw`SELECT id FROM users WHERE id = ${order.userId} FOR UPDATE`;

    const saldo = await saldoDisponible(tx, order.userId);
    if (saldo < order.totalGs) {
      const falta = order.totalGs - saldo;
      throw Object.assign(new Error(`Al cliente le falta ₲${falta.toLocaleString('es-PY')} de saldo`), {
        statusCode: 400, code: 'INSUFFICIENT_BALANCE', saldo, falta,
      });
    }

    const credito = await tx.credit.create({
      data: {
        userId: order.userId,
        amount: -order.totalGs,
        type: 'SHOP_PURCHASE',
        description: order.items.map((i) => `${i.qty}× ${i.nameSnapshot}`).join(', ').slice(0, 200),
        referenceId: order.id,
      },
    });

    return finalizarPagada(tx, order.id, { employeeId, paymentMethod: 'wallet', creditId: credito.id });
  });
}

// ── Anulación de una venta ya cobrada ─────────────────────────────────────────
/**
 * Devuelve la mercadería al stock y saca la venta de la caja. El dinero se devuelve aparte:
 * con saldo es automático (se acredita de vuelta), con tarjeta queda el reembolso por Bancard
 * a cargo del admin, que es lo mismo que se hace hoy con una reserva.
 */
async function anularVenta(prisma, { orderId, motivo, adminId }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw Object.assign(new Error('Venta no encontrada'), { statusCode: 404 });
    if (order.status !== 'PAID') throw Object.assign(new Error('Solo se puede anular una venta pagada'), { statusCode: 400 });

    for (const linea of order.items) {
      const item = await tx.inventoryItem.findUnique({ where: { id: linea.itemId } });
      if (!item) continue;
      const after = item.currentStock + linea.qty;
      await tx.inventoryItem.update({ where: { id: item.id }, data: { currentStock: after } });
      await tx.stockMovement.create({
        data: {
          itemId: item.id, type: 'RETURN', quantity: linea.qty,
          quantityBefore: item.currentStock, quantityAfter: after,
          reason: `Anulación de venta: ${motivo}`, userId: adminId, orderId: order.id,
        },
      });
    }

    // Con saldo la devolución es inmediata; con tarjeta el reembolso lo hace el admin en Bancard.
    if (order.paymentMethod === 'wallet') {
      await tx.credit.create({
        data: {
          userId: order.userId, amount: order.totalGs, type: 'SHOP_REFUND',
          description: `Devolución de compra anulada: ${motivo}`.slice(0, 200), referenceId: order.id,
        },
      });
    }

    return tx.order.update({
      where: { id: order.id },
      data: { status: 'VOIDED', voidReason: motivo, cashSessionId: null },
      include: { items: true },
    });
  });
}

/** Marca vencidos los QR que nadie escaneó. Barato de correr seguido. */
async function vencerPedidosViejos(prisma) {
  const r = await prisma.order.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return r.count;
}

module.exports = {
  ORDER_QR_VALIDITY_MS,
  buildOrderToken,
  verifyOrderToken,
  saldoDisponible,
  cajaAbierta,
  armarLineas,
  finalizarPagada,
  cobrarConSaldo,
  anularVenta,
  vencerPedidosViejos,
};
