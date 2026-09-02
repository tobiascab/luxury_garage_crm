#!/usr/bin/env node
/**
 * Una cuenta recién creada entra a la app sin tarjeta y puede MIRAR todo (planes, servicios,
 * tienda), pero no puede hacer nada que mueva plata. Antes la app se tapaba con el alta
 * obligatoria antes de que la persona viera una sola cosa de lo que se le ofrece.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const _ax = require('axios'); const axios = _ax.default || _ax;
const bcrypt = require('bcryptjs');

const API = `http://127.0.0.1:${process.env.TEST_PORT || 3002}/api`;
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
let pass = 0, fail = 0, userId = null;
const ok = (c, l, e = '') => { c ? (pass++, console.log(`   ✅ ${l}`)) : (fail++, console.log(`   ❌ ${l} ${e}`)); };

(async () => {
  try {
    const pwd = 'Prueba123', email = `nuevo-${Date.now()}@test.local`;
    const u = await prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(pwd, 12), firstName: 'Recién', lastName: 'Llegado', role: 'CLIENT' },
    });
    userId = u.id;
    const auth = { headers: { Authorization: `Bearer ${(await axios.post(`${API}/auth/login`, { email, password: pwd })).data.data.token}` } };

    console.log('\n── 1. Entra a su cuenta sin tarjeta ──');
    const perfil = (await axios.get(`${API}/luxury/profile/full`, auth)).data.data;
    ok(perfil.membership_status === 'Inactiva', 'Su cuenta figura sin membresía');
    ok(perfil.hasPaymentCard === false, 'Y sin tarjeta cargada');
    ok(!!perfil.name, `Pero el perfil carga normal: ${perfil.name}`);

    console.log('\n── 2. Ve TODO lo que se le ofrece ──');
    const planes = (await axios.get(`${API}/plans`, auth)).data;
    const lista = planes.data || planes;
    ok(Array.isArray(lista) && lista.length > 0, `Ve ${lista.length} plan(es) con sus precios`);
    const conDetalle = lista.filter((p) => p.priceGs != null);
    ok(conDetalle.length === lista.length, 'Todos con su precio visible');

    const servicios = (await axios.get(`${API}/services`, auth)).data;
    ok((servicios.data || servicios).length > 0, `Y ${(servicios.data || servicios).length} servicio(s) del catálogo`);

    const tienda = (await axios.get(`${API}/shop/products`, auth)).data;
    ok(tienda.data.length > 0, `Puede mirar la tienda: ${tienda.data.length} productos`);

    console.log('\n── 3. Pero no puede mover un peso ──');
    try {
      await axios.post(`${API}/shop/orders`, { items: [{ itemId: tienda.data[0].id, qty: 1 }], paymentMethod: 'card' }, auth);
      ok(false, '⚠️ LO DEJÓ COMPRAR SIN TARJETA');
    } catch (e) {
      ok(e.response?.data?.code === 'NO_CARD', `Comprar: "${e.response?.data?.message}"`);
    }
    try {
      await axios.post(`${API}/shop/orders`, { items: [{ itemId: tienda.data[0].id, qty: 1 }], paymentMethod: 'wallet' }, auth);
      ok(false, '⚠️ LO DEJÓ COMPRAR SIN SALDO');
    } catch (e) {
      ok(e.response?.data?.code === 'INSUFFICIENT_BALANCE', `Con saldo: "${e.response?.data?.message}"`);
    }
    const saldo = (await axios.get(`${API}/shop/payment-options`, auth)).data.data;
    ok(saldo.walletBalanceGs === 0 && saldo.cards.length === 0, 'No tiene saldo ni tarjetas: nada con qué cobrarle');

  } catch (e) {
    console.error('\n💥', e.response?.status || '', e.response?.data ? JSON.stringify(e.response.data).slice(0, 250) : e.message);
    fail++;
  } finally {
    if (userId) {
      await prisma.orderItem.deleteMany({ where: { order: { userId } } }).catch(() => {});
      await prisma.order.deleteMany({ where: { userId } }).catch(() => {});
      for (const m of ['credit', 'payment', 'bancardOperation', 'notification', 'auditLog']) await prisma[m].deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    ok(!(userId && await prisma.user.findFirst({ where: { id: userId } })), 'Limpieza: cuenta de prueba eliminada');
  }
  console.log(`\n${'═'.repeat(58)}\n   RESULTADO: ${pass} pasaron · ${fail} fallaron`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})();
