#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
/** Verificación por HTTP contra el backend de producción, con un usuario temporal que se borra. */

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const _ax = require('axios');
const axios = _ax.default || _ax;
const bcrypt = require('bcryptjs');

const API = 'http://127.0.0.1:3002/api';
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
let pass = 0, fail = 0, userId = null;
const ok = (c, l, e = '') => { c ? (pass++, console.log(`   ✅ ${l}`)) : (fail++, console.log(`   ❌ ${l} ${e}`)); };

(async () => {
  try {
    const plan = await prisma.plan.findFirst({ where: { name: 'Plan Básico' } });
    const email = `http-${Date.now()}@test.local`;
    const pwd = 'Prueba123';
    const user = await prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(pwd, 12), firstName: 'Http', lastName: 'Test', role: 'CLIENT' },
    });
    userId = user.id;
    // Plan preseleccionado por el admin (PENDING), tal como lo deja provisionClient.
    await prisma.membership.create({
      data: { userId, planId: plan.id, status: 'PENDING', startDate: new Date(), endDate: new Date(Date.now() + 30 * 864e5) },
    });

    console.log('\n── Login del cliente recién creado por el admin ──');
    const login = await axios.post(`${API}/auth/login`, { email, password: pwd });
    ok(login.data.success === true, 'El cliente puede iniciar sesión');
    const token = login.data.data?.token || login.data.token;
    ok(!!token, 'Recibe token de sesión');
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    console.log('\n── Perfil: ¿se le exige completar el alta? ──');
    const prof = await axios.get(`${API}/luxury/profile/full`, auth);
    const d = prof.data.data;
    ok(d.onboardingRequired === true, 'El sistema le EXIGE completar el alta (tarjeta + plan + pago)');
    ok(d.hasPaymentCard === false, 'Detecta que todavía no tiene tarjeta');
    ok(d.pendingPlan?.name === 'Plan Básico', `Le llega preseleccionado el plan que eligió el admin: ${d.pendingPlan?.name}`);
    ok(d.pendingPlan?.priceGs === plan.priceGs, `Con su precio real: ₲${d.pendingPlan?.priceGs}`);
    ok(d.membership_status === 'Inactiva', 'Su membresía figura INACTIVA hasta que pague');
    ok(d.planUsage === null, 'No tiene cupo de lavados disponible todavía');

    console.log('\n── Sin pagar, ¿puede usar beneficios? ──');
    const memb = await axios.get(`${API}/memberships/me`, auth);
    ok(!memb.data.data, 'No figura ninguna membresía activa');

    console.log('\n── Estado de la pasarela de pagos ──');
    const st = await axios.get(`${API}/payments/status`, auth);
    ok(st.data.data?.configured === true, 'Bancard está configurado en el backend');

    console.log('\n── Tras activarle el plan (simulando el cobro) ──');
    await prisma.membership.updateMany({ where: { userId, status: { in: ['ACTIVE', 'PENDING'] } }, data: { status: 'REPLACED' } });
    await prisma.membership.create({
      data: { userId, planId: plan.id, status: 'ACTIVE', startDate: new Date(), endDate: new Date(Date.now() + 30 * 864e5), autoRenew: true },
    });
    const prof2 = await axios.get(`${API}/luxury/profile/full`, auth);
    const d2 = prof2.data.data;
    ok(d2.onboardingRequired === false, 'Ya NO se le exige el alta: entra normal a la app');
    ok(d2.membership_status === 'Activa', 'Su membresía figura ACTIVA');
    ok(d2.planUsage?.quota === 4 && d2.planUsage?.remaining === 4, `Ve sus 4 lavados disponibles (usados ${d2.planUsage?.used}/${d2.planUsage?.quota})`);
    ok(d2.planUsage?.unlimited === false, 'El plan Básico se informa como limitado');

  } catch (e) {
    console.error('\n💥', e.response?.status || '', e.response?.data ? JSON.stringify(e.response.data).slice(0, 200) : e.message);
    fail++;
  } finally {
    if (userId) {
      await prisma.payment.deleteMany({ where: { userId } });
      await prisma.appointment.deleteMany({ where: { userId } });
      await prisma.credit.deleteMany({ where: { userId } });
      await prisma.bancardOperation.deleteMany({ where: { userId } });
      await prisma.membership.deleteMany({ where: { userId } });
      await prisma.vehicle.deleteMany({ where: { userId } });
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    const quedan = { clientes: await prisma.user.count({ where: { role: 'CLIENT' } }), pagos: await prisma.payment.count(), membresias: await prisma.membership.count() };
    ok(quedan.clientes === 0 && quedan.pagos === 0 && quedan.membresias === 0, `Usuario de prueba eliminado — BD limpia: ${JSON.stringify(quedan)}`);
  }
  console.log(`\n${'═'.repeat(60)}\n   RESULTADO: ${pass} pasaron · ${fail} fallaron`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})();
