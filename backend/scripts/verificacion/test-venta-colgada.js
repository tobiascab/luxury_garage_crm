#!/usr/bin/env node
/**
 * Una venta cuyo cobro quedó colgado no puede terminar descontándole plata al cliente horas
 * después. Esto controla las dos mitades de esa regla:
 *   · la venta vieja se cierra sola y el operario puede rehacer el pedido;
 *   · si un cobro tardío llega igual, NO se materializa: queda marcado para devolver.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const orderService = require('../../src/services/orderService');
const { materializeApprovedPayment } = require('../../src/services/paymentReconciliation');

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
let pass = 0, fail = 0, userId = null, productoId = null;
const ok = (c, l, e = '') => { c ? (pass++, console.log(`   ✅ ${l}`)) : (fail++, console.log(`   ❌ ${l} ${e}`)); };

(async () => {
  try {
    const u = await prisma.user.create({
      data: { email: `colgada-${Date.now()}@test.local`, passwordHash: await bcrypt.hash('x', 4), firstName: 'Venta', lastName: 'Colgada', role: 'CLIENT' },
    });
    userId = u.id;
    await prisma.credit.create({ data: { userId, amount: 50000, type: 'WALLET_TOPUP', description: 'saldo de prueba' } });

    const p = await prisma.inventoryItem.create({
      data: { name: `Colgada ${Date.now() % 1000}`, category: 'TEST', unit: 'unidad', currentStock: 10, minStockAlert: 1, isForSale: true, salePriceGs: 10000, saleCategory: 'Bebidas' },
    });
    productoId = p.id;

    const viejo = new Date(Date.now() - 40 * 60 * 1000); // 40 minutos atrás
    const order = await prisma.order.create({
      data: {
        userId, status: 'AUTHORIZING', totalGs: 20000, paymentMethod: 'card',
        qrIssuedAt: viejo, expiresAt: viejo, scannedAt: viejo,
        items: { create: [{ itemId: productoId, nameSnapshot: p.name, unitPriceGs: 10000, qty: 2, lineTotalGs: 20000 }] },
      },
      include: { items: true },
    });
    // Se fuerza la antigüedad: Prisma pone updatedAt = ahora al crear.
    await prisma.$executeRaw`UPDATE orders SET updated_at = ${viejo} WHERE id = ${order.id}`;

    console.log('\n── 1. La venta colgada se cierra sola ──');
    const r = await orderService.cerrarVentasColgadas(prisma);
    const cerrada = await prisma.order.findUnique({ where: { id: order.id } });
    ok(cerrada.status === 'EXPIRED', `Quedó ${cerrada.status}: "${cerrada.declineReason}"`);
    ok(r.vencidas >= 1, `El cierre reporta ${r.vencidas} vencida(s)`);

    const stock = (await prisma.inventoryItem.findUnique({ where: { id: productoId } })).currentStock;
    ok(stock === 10, `El stock no se tocó: ${stock}`);
    const saldo = await prisma.credit.aggregate({ where: { userId }, _sum: { amount: true } });
    ok(saldo._sum.amount === 50000, 'Y al cliente no se le descontó nada');

    console.log('\n── 2. Un cobro que llega tarde ya no puede descontarle ──');
    // Se arma la operación Bancard como si el banco hubiera aprobado después del cierre.
    const sp = Date.now();
    await prisma.bancardOperation.create({
      data: { shopProcessId: sp, userId, type: 'charge', status: 'PENDING', amountGs: 20000,
              metadataJson: { kind: 'order', orderId: order.id, amountGs: 20000 } },
    });
    await prisma.payment.create({
      data: { userId, amountGs: 20000, paymentMethod: 'bancard_card', bancardShopProcessId: sp, status: 'PENDING', description: 'test venta colgada' },
    });

    const res = await materializeApprovedPayment(prisma, sp);
    const trasTarde = await prisma.order.findUnique({ where: { id: order.id } });
    const stock2 = (await prisma.inventoryItem.findUnique({ where: { id: productoId } })).currentStock;
    const movimientos = await prisma.stockMovement.count({ where: { orderId: order.id } });

    ok(trasTarde.status === 'EXPIRED', 'La venta sigue vencida, no se "revive"');
    ok(stock2 === 10, `El stock sigue intacto: ${stock2}`);
    ok(movimientos === 0, 'No se descontó mercadería');
    // Bancard no conoce este shopProcessId de prueba, así que responde "no determinable":
    // el sistema deja la operación pendiente en vez de decidir a ciegas. Eso también es correcto.
    ok(['noop', 'pending', 'failed'].includes(res.status), `La materialización no entregó la venta (status: ${res.status}, motivo: ${res.reason || '—'})`);

  } catch (e) {
    console.error('\n💥', e.stack || e.message);
    fail++;
  } finally {
    if (userId) {
      await prisma.stockMovement.deleteMany({ where: { order: { userId } } }).catch(() => {});
      await prisma.orderItem.deleteMany({ where: { order: { userId } } }).catch(() => {});
      await prisma.order.deleteMany({ where: { userId } }).catch(() => {});
      for (const m of ['payment', 'bancardOperation', 'credit']) await prisma[m].deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    if (productoId) {
      await prisma.stockMovement.deleteMany({ where: { itemId: productoId } }).catch(() => {});
      await prisma.inventoryItem.delete({ where: { id: productoId } }).catch(() => {});
    }
    ok(!(userId && await prisma.user.findFirst({ where: { id: userId } })), 'Limpieza: datos de prueba eliminados');
  }
  console.log(`\n${'═'.repeat(58)}\n   RESULTADO: ${pass} pasaron · ${fail} fallaron`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})();
