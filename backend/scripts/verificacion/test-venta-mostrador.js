#!/usr/bin/env node
/**
 * Venta de productos de mostrador, de punta a punta: el cliente arma el carrito y genera su QR,
 * el operario lo escanea, verifica y cobra, y la venta cae en la caja del día.
 *
 * Lo que se controla acá es lo que duele si falla: que escanear no cobre, que el stock se
 * descuente UNA sola vez, que no se pueda cobrar dos veces y que anular devuelva todo.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const _ax = require('axios');
const axios = _ax.default || _ax;
const bcrypt = require('bcryptjs');

const API = `http://127.0.0.1:${process.env.TEST_PORT || 3002}/api`;
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
let pass = 0, fail = 0;
let userId = null, empleadoId = null, pwdEmpleado = null, adminId = null, pwdAdmin = null;
let productoId = null, cajaCreada = null;
const ok = (c, l, e = '') => { c ? (pass++, console.log(`   ✅ ${l}`)) : (fail++, console.log(`   ❌ ${l} ${e}`)); };
const gs = (n) => `₲${(n || 0).toLocaleString('es-PY')}`;

(async () => {
  try {
    const pwd = 'Prueba123';
    const email = `venta-${Date.now()}@test.local`;

    // Cliente con saldo en la billetera
    const cliente = await prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(pwd, 12), firstName: 'Venta', lastName: 'Mostrador', role: 'CLIENT' },
    });
    userId = cliente.id;
    await prisma.credit.create({ data: { userId, amount: 100000, type: 'WALLET_TOPUP', description: 'Saldo de prueba' } });

    // Producto a la venta con stock conocido
    const producto = await prisma.inventoryItem.create({
      data: {
        name: `Gaseosa de prueba ${Date.now() % 10000}`, category: 'BEBIDAS', unit: 'unidad',
        currentStock: 10, minStockAlert: 2, costPerUnit: 5000,
        isForSale: true, salePriceGs: 12000, saleCategory: 'Bebidas',
      },
    });
    productoId = producto.id;

    const empleado = await prisma.user.findFirst({ where: { role: 'EMPLOYEE' } });
    empleadoId = empleado.id; pwdEmpleado = empleado.passwordHash;
    await prisma.user.update({ where: { id: empleadoId }, data: { passwordHash: await bcrypt.hash(pwd, 12) } });

    const admin = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } });
    adminId = admin.id; pwdAdmin = admin.passwordHash;
    await prisma.user.update({ where: { id: adminId }, data: { passwordHash: await bcrypt.hash(pwd, 12) } });

    const login = async (mail) => ({ headers: { Authorization: `Bearer ${(await axios.post(`${API}/auth/login`, { email: mail, password: pwd })).data.data.token}` } });
    const authCli = await login(email);
    const authEmp = await login(empleado.email);
    const authAdm = await login(admin.email);

    console.log('\n── 1. El cliente ve el producto en la tienda ──');
    const cat = (await axios.get(`${API}/shop/products`, authCli)).data;
    const enTienda = cat.data.find((p) => p.id === productoId);
    ok(!!enTienda, `El producto aparece en el catálogo (${cat.data.length} publicados)`);
    ok(enTienda?.priceGs === 12000, `Con su precio: ${gs(enTienda?.priceGs)}`);

    const ops = (await axios.get(`${API}/shop/payment-options`, authCli)).data.data;
    ok(ops.walletBalanceGs === 100000, `Y su saldo disponible: ${gs(ops.walletBalanceGs)}`);

    console.log('\n── 2. Arma el carrito y genera el QR ──');
    const pedido = (await axios.post(`${API}/shop/orders`, {
      items: [{ itemId: productoId, qty: 2 }], paymentMethod: 'wallet',
    }, authCli)).data.data;
    ok(pedido.status === 'PENDING', `Pedido creado en estado ${pedido.status}`);
    ok(pedido.totalGs === 24000, `Total congelado: ${gs(pedido.totalGs)} (2 × ${gs(12000)})`);
    ok(!!pedido.qrToken, 'Con su QR de compra firmado');

    console.log('\n── 3. Escanear NO cobra ni descuenta ──');
    const vista = (await axios.post(`${API}/sales/verify`, { token: pedido.qrToken }, authEmp)).data.data;
    ok(vista.status === 'SCANNED', 'El pedido pasa a "escaneado"');
    ok(vista.client?.name === 'Venta Mostrador', `Identifica al cliente: ${vista.client?.name}`);
    ok(vista.payment?.method === 'wallet' && vista.payment?.walletAlcanza, 'Avisa que el saldo alcanza');
    const stockTrasEscaneo = (await prisma.inventoryItem.findUnique({ where: { id: productoId } })).currentStock;
    ok(stockTrasEscaneo === 10, `El stock sigue intacto: ${stockTrasEscaneo} (leer el QR no descuenta)`);
    const saldoTrasEscaneo = await prisma.credit.aggregate({ where: { userId }, _sum: { amount: true } });
    ok(saldoTrasEscaneo._sum.amount === 100000, 'Y el saldo del cliente tampoco se tocó');

    console.log('\n── 4. El operario ajusta lo que el cliente realmente lleva ──');
    const ajustado = (await axios.patch(`${API}/sales/orders/${pedido.id}/items`, {
      items: [{ itemId: productoId, qty: 3 }],
    }, authEmp)).data.data;
    ok(ajustado.totalGs === 36000, `Total recalculado solo: ${gs(ajustado.totalGs)} (3 unidades)`);

    console.log('\n── 5. Cobra: recién acá se mueve todo ──');
    const cobro = (await axios.post(`${API}/sales/orders/${pedido.id}/charge`, {}, authEmp)).data;
    ok(cobro.paid === true, `Cobrado: "${cobro.message}"`);
    const trasCobro = await prisma.inventoryItem.findUnique({ where: { id: productoId } });
    ok(trasCobro.currentStock === 7, `Stock descontado: 10 → ${trasCobro.currentStock}`);
    const saldoFinal = await prisma.credit.aggregate({ where: { userId }, _sum: { amount: true } });
    ok(saldoFinal._sum.amount === 64000, `Saldo del cliente: ${gs(saldoFinal._sum.amount)} (100.000 − 36.000)`);
    const mov = await prisma.stockMovement.findMany({ where: { orderId: pedido.id, type: 'SALE' } });
    ok(mov.length === 1, 'Queda un movimiento de stock tipo SALE, trazable a la venta');

    const enCaja = await prisma.order.findUnique({ where: { id: pedido.id } });
    ok(!!enCaja.cashSessionId, 'La venta quedó atada a la caja del día');
    cajaCreada = enCaja.cashSessionId;

    console.log('\n── 6. Cobrar dos veces no duplica nada ──');
    const reintento = (await axios.post(`${API}/sales/orders/${pedido.id}/charge`, {}, authEmp)).data;
    ok(reintento.alreadyPaid === true, 'El segundo intento devuelve el comprobante, no cobra de nuevo');
    const saldoTrasReintento = await prisma.credit.aggregate({ where: { userId }, _sum: { amount: true } });
    ok(saldoTrasReintento._sum.amount === 64000, 'El saldo no se movió otra vez');
    const stockTrasReintento = (await prisma.inventoryItem.findUnique({ where: { id: productoId } })).currentStock;
    ok(stockTrasReintento === 7, 'Y el stock tampoco');

    console.log('\n── 7. El QR ya usado no sirve de nuevo ──');
    try {
      await axios.post(`${API}/sales/verify`, { token: pedido.qrToken }, authEmp);
      ok(false, '⚠️ ACEPTÓ UN QR YA COBRADO');
    } catch (e) { ok(e.response?.data?.code === 'ALREADY_PAID', `Rechazado: "${e.response?.data?.message}"`); }

    console.log('\n── 8. Sin saldo suficiente no se cobra ──');
    // Se corta al ARMAR el carrito, no en el mostrador: el cliente se entera antes de hacer la fila.
    try {
      await axios.post(`${API}/shop/orders`, { items: [{ itemId: productoId, qty: 6 }], paymentMethod: 'wallet' }, authCli);
      ok(false, '⚠️ CREÓ UN PEDIDO QUE EL CLIENTE NO PUEDE PAGAR');
    } catch (e) {
      ok(e.response?.data?.code === 'INSUFFICIENT_BALANCE', `Rechazado al armar el carrito: "${e.response?.data?.message}"`);
    }

    console.log('\n── 9. La caja del día muestra la venta ──');
    const caja = (await axios.get(`${API}/cash/current`, authAdm)).data.data;
    ok(caja?.ordersCount >= 1, `La caja tiene ${caja?.ordersCount} venta(s)`);
    ok(caja?.totalGs >= 36000, `Con ${gs(caja?.totalGs)} acumulados`);
    ok(caja?.porMedioDePago?.wallet >= 36000, 'Desglosado por medio de pago (saldo)');
    ok(caja?.topProductos?.some((p) => p.qty >= 3), 'Y el ranking de lo más vendido');

    console.log('\n── 10. Anular devuelve stock y plata ──');
    const anul = (await axios.post(`${API}/cash/orders/${pedido.id}/void`, { motivo: 'Prueba automática' }, authAdm)).data;
    ok(anul.success === true, `Anulada: "${anul.message}"`);
    const trasAnular = await prisma.inventoryItem.findUnique({ where: { id: productoId } });
    ok(trasAnular.currentStock === 10, `Stock devuelto: ${trasAnular.currentStock}`);
    const saldoTrasAnular = await prisma.credit.aggregate({ where: { userId }, _sum: { amount: true } });
    ok(saldoTrasAnular._sum.amount === 100000, `Saldo devuelto: ${gs(saldoTrasAnular._sum.amount)}`);

  } catch (e) {
    console.error('\n💥', e.response?.status || '', e.response?.data ? JSON.stringify(e.response.data).slice(0, 300) : e.stack || e.message);
    fail++;
  } finally {
    if (empleadoId && pwdEmpleado) await prisma.user.update({ where: { id: empleadoId }, data: { passwordHash: pwdEmpleado } });
    if (adminId && pwdAdmin) await prisma.user.update({ where: { id: adminId }, data: { passwordHash: pwdAdmin } });
    if (userId) {
      await prisma.orderItem.deleteMany({ where: { order: { userId } } }).catch(() => {});
      await prisma.order.deleteMany({ where: { userId } }).catch(() => {});
      for (const m of ['credit', 'payment', 'bancardOperation', 'notification', 'auditLog']) {
        await prisma[m].deleteMany({ where: { userId } }).catch(() => {});
      }
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    if (productoId) {
      await prisma.stockMovement.deleteMany({ where: { itemId: productoId } }).catch(() => {});
      await prisma.inventoryItem.delete({ where: { id: productoId } }).catch(() => {});
    }
    // La caja se borra SOLO si la abrió esta prueba y no quedó ninguna venta real adentro.
    if (cajaCreada) {
      const quedan = await prisma.order.count({ where: { cashSessionId: cajaCreada } });
      if (!quedan) await prisma.cashSession.delete({ where: { id: cajaCreada } }).catch(() => {});
    }
    ok(!(userId && await prisma.user.findFirst({ where: { id: userId } })), 'Limpieza: claves restauradas y datos de prueba eliminados');
  }
  console.log(`\n${'═'.repeat(62)}\n   RESULTADO: ${pass} pasaron · ${fail} fallaron`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})();
