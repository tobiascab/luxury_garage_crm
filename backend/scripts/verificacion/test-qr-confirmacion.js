#!/usr/bin/env node
/**
 * Escaneo en dos pasos: leer el QR no descuenta nada; el lavado se registra recién cuando
 * el empleado elige qué reserva está atendiendo.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const _ax = require('axios');
const axios = _ax.default || _ax;
const bcrypt = require('bcryptjs');

const API = 'http://127.0.0.1:3002/api';
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
let pass = 0, fail = 0, userId = null, empleadoId = null, pwdOriginal = null;
const ok = (c, l, e = '') => { c ? (pass++, console.log(`   ✅ ${l}`)) : (fail++, console.log(`   ❌ ${l} ${e}`)); };

(async () => {
  try {
    const plan = await prisma.plan.findFirst({ where: { name: 'Plan Básico' } });
    const servicio = await prisma.service.findFirst({ where: { slug: (plan.servicesIncluded || [])[0]?.slug } });
    const email = `qr2-${Date.now()}@test.local`, pwd = 'Prueba123';

    const cliente = await prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(pwd, 12), firstName: 'Dos', lastName: 'Pasos', role: 'CLIENT' },
    });
    userId = cliente.id;
    await prisma.membership.create({
      data: { userId, planId: plan.id, status: 'ACTIVE', startDate: new Date(), endDate: new Date(Date.now() + 30 * 864e5), autoRenew: true },
    });
    const veh = await prisma.vehicle.create({ data: { userId, brand: 'Fiat', model: 'Cronos', year: 2022, licensePlate: 'DOS123', isPrimary: true } });

    // DOS reservas: es el caso donde el escaneo automático gastaba de más.
    const reservas = [];
    for (let i = 1; i <= 2; i++) {
      const t = new Date(Date.now() + i * 36e5);
      reservas.push(await prisma.appointment.create({
        data: {
          userId, vehicleId: veh.id, serviceId: servicio.id,
          date: t, startTime: t, endTime: new Date(t.getTime() + 36e5),
          status: 'CONFIRMED', totalPriceGs: 0, coveredByMembership: true, billingMode: 'covered',
        },
      }));
    }

    const empleado = await prisma.user.findFirst({ where: { role: 'EMPLOYEE' } });
    empleadoId = empleado.id; pwdOriginal = empleado.passwordHash;
    await prisma.user.update({ where: { id: empleadoId }, data: { passwordHash: await bcrypt.hash(pwd, 12) } });

    const authCli = { headers: { Authorization: `Bearer ${(await axios.post(`${API}/auth/login`, { email, password: pwd })).data.data.token}` } };
    const authEmp = { headers: { Authorization: `Bearer ${(await axios.post(`${API}/auth/login`, { email: empleado.email, password: pwd })).data.data.token}` } };
    const token = (await axios.get(`${API}/luxury/qr/token`, authCli)).data.token;

    console.log('\n── 1. Leer el QR no descuenta nada ──');
    const ver = await axios.post(`${API}/luxury/qr/verify`, { token }, authEmp);
    const d = ver.data.data;
    ok(ver.data.success === true, `Identifica a ${d.client?.name}`);
    ok(d.client?.plan === 'Plan Básico', `Muestra su plan: ${d.client?.plan}`);
    // El cupo se consume al RESERVAR, no al escanear: con 2 turnos ya reservados le quedan 2.
    ok(d.client?.remainingWashes === 2, `Y su cupo real: le quedan ${d.client?.remainingWashes} (2 ya reservados)`);
    ok(d.reservas?.length === 2, `Lista sus ${d.reservas?.length} reservas para elegir`);
    const sinTocar = await prisma.appointment.count({ where: { userId, status: 'CONFIRMED' } });
    ok(sinTocar === 2, 'Las 2 reservas siguen intactas: leer el QR NO consumió ninguna');

    console.log('\n── 2. Sin elegir reserva no se registra nada ──');
    try {
      await axios.post(`${API}/luxury/qr/scan`, { token }, authEmp);
      ok(false, '⚠️ REGISTRÓ SIN ELEGIR RESERVA');
    } catch (e) {
      ok(e.response?.data?.code === 'APPOINTMENT_REQUIRED', `Rechazado: "${e.response?.data?.message}"`);
    }

    console.log('\n── 3. Se registra SOLO la reserva elegida ──');
    const elegida = d.reservas[1].id; // a propósito la segunda, no la más próxima
    const scan = await axios.post(`${API}/luxury/qr/scan`, { token, appointmentId: elegida }, authEmp);
    ok(scan.data.success === true, `Registrado: "${scan.data.message}"`);
    const est = Object.fromEntries((await prisma.appointment.findMany({ where: { userId }, select: { id: true, status: true } })).map((a) => [a.id, a.status]));
    ok(est[elegida] === 'COMPLETED', 'La reserva elegida quedó completada');
    ok(est[d.reservas[0].id] === 'CONFIRMED', 'La OTRA reserva sigue pendiente, no se consumió');

    console.log('\n── 4. Registrar el lavado NO vuelve a descontar ──');
    // El lavado ya se había descontado al reservar; completarlo no puede cobrarlo dos veces.
    const perfil = await axios.get(`${API}/luxury/profile/full`, authCli);
    ok(perfil.data.data.planUsage?.remaining === 2, `Sigue en ${perfil.data.data.planUsage?.remaining}: no se descontó de nuevo al escanear`);

    console.log('\n── 5. No se puede volver a registrar la misma ──');
    try {
      await axios.post(`${API}/luxury/qr/scan`, { token, appointmentId: elegida }, authEmp);
      ok(false, '⚠️ REGISTRÓ DOS VECES LA MISMA RESERVA');
    } catch (e) {
      ok(e.response?.status === 400, `Bloqueado: "${e.response?.data?.message}"`);
    }

    console.log('\n── 6. No se puede usar el QR de un cliente con la reserva de otro ──');
    const otro = await prisma.user.create({
      data: { email: `otro2-${Date.now()}@test.local`, passwordHash: await bcrypt.hash(pwd, 12), firstName: 'Ajeno', lastName: 'X', role: 'CLIENT' },
    });
    const vehO = await prisma.vehicle.create({ data: { userId: otro.id, brand: 'VW', model: 'Gol', year: 2020, licensePlate: 'AJE123', isPrimary: true } });
    const t2 = new Date(Date.now() + 5 * 36e5);
    const resAjena = await prisma.appointment.create({
      data: {
        userId: otro.id, vehicleId: vehO.id, serviceId: servicio.id,
        date: t2, startTime: t2, endTime: new Date(t2.getTime() + 36e5),
        status: 'CONFIRMED', totalPriceGs: 0, coveredByMembership: false, billingMode: 'paid',
      },
    });
    try {
      await axios.post(`${API}/luxury/qr/scan`, { token, appointmentId: resAjena.id }, authEmp);
      ok(false, '⚠️ FUGA: completó la reserva de otro cliente');
    } catch (e) {
      ok(e.response?.status === 400, 'No se puede completar la reserva de otro cliente con este QR');
    }
    await prisma.appointment.deleteMany({ where: { userId: otro.id } });
    await prisma.vehicle.deleteMany({ where: { userId: otro.id } });
    await prisma.user.delete({ where: { id: otro.id } });

    console.log('\n── 7. Un QR adulterado se rechaza en el primer paso ──');
    try {
      await axios.post(`${API}/luxury/qr/verify`, { token: token.slice(0, -4) + 'aaaa' }, authEmp);
      ok(false, '⚠️ ACEPTÓ UN QR ADULTERADO');
    } catch (e) { ok(e.response?.status === 400, `Rechazado: "${e.response?.data?.message}"`); }

  } catch (e) {
    console.error('\n💥', e.response?.status || '', e.response?.data ? JSON.stringify(e.response.data).slice(0, 250) : e.message);
    fail++;
  } finally {
    if (empleadoId && pwdOriginal) await prisma.user.update({ where: { id: empleadoId }, data: { passwordHash: pwdOriginal } });
    if (userId) {
      const citas = await prisma.appointment.findMany({ where: { userId }, select: { id: true } });
      for (const c of citas) {
        const sr = await prisma.serviceRecord.findUnique({ where: { appointmentId: c.id } });
        if (sr) { await prisma.stockMovement.deleteMany({ where: { serviceRecordId: sr.id } }); await prisma.serviceRecord.delete({ where: { id: sr.id } }); }
      }
      for (const m of ['payment', 'appointment', 'credit', 'bancardOperation', 'membership', 'vehicle', 'paymentCard', 'notification', 'auditLog']) {
        await prisma[m].deleteMany({ where: { userId } }).catch(() => {});
      }
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    ok(!(userId && await prisma.user.findFirst({ where: { id: userId } })), 'Limpieza: contraseña del empleado restaurada y prueba eliminada');
  }
  console.log(`\n${'═'.repeat(60)}\n   RESULTADO: ${pass} pasaron · ${fail} fallaron`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})();
