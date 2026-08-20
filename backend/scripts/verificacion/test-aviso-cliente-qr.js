#!/usr/bin/env node
/**
 * El cliente tiene que ENTERARSE de que le registraron el lavado: mientras muestra el carnet,
 * su pantalla consulta /luxury/latest-wash y con eso dispara el aviso "¡Lavado confirmado!".
 *
 * La consulta comparaba contra `date` (el día reservado, guardado a medianoche UTC) en vez de
 * contra el momento en que se registró el lavado, así que devolvía found=false SIEMPRE y el
 * cliente se quedaba mirando el QR sin ninguna señal.
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
let pass = 0, fail = 0, userId = null, empleadoId = null, pwdOriginal = null;
const ok = (c, l, e = '') => { c ? (pass++, console.log(`   ✅ ${l}`)) : (fail++, console.log(`   ❌ ${l} ${e}`)); };

(async () => {
  try {
    const plan = await prisma.plan.findFirst({ where: { name: 'Plan Básico' } });
    const servicio = await prisma.service.findFirst({ where: { slug: (plan.servicesIncluded || [])[0]?.slug } });
    const email = `aviso-${Date.now()}@test.local`, pwd = 'Prueba123';

    const cliente = await prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(pwd, 12), firstName: 'Aviso', lastName: 'Cliente', role: 'CLIENT' },
    });
    userId = cliente.id;
    await prisma.membership.create({
      data: { userId, planId: plan.id, status: 'ACTIVE', startDate: new Date(), endDate: new Date(Date.now() + 30 * 864e5), autoRenew: true },
    });
    const veh = await prisma.vehicle.create({ data: { userId, brand: 'Ford', model: 'Ka', year: 2021, licensePlate: 'AVI123', isPrimary: true } });

    // `date` a medianoche UTC del día del turno: es exactamente lo que graba una reserva real
    // (el front manda "2026-08-15" y el backend hace new Date(ese string)). Ese valor es lo que
    // rompía el aviso, así que la prueba tiene que reproducirlo tal cual.
    const hoy = new Date();
    const inicio = new Date(hoy.getTime() + 36e5);
    const reserva = await prisma.appointment.create({
      data: {
        userId, vehicleId: veh.id, serviceId: servicio.id,
        date: new Date(hoy.toISOString().slice(0, 10)),
        startTime: inicio, endTime: new Date(inicio.getTime() + 36e5),
        status: 'CONFIRMED', totalPriceGs: 0, coveredByMembership: true, billingMode: 'covered',
      },
    });

    const empleado = await prisma.user.findFirst({ where: { role: 'EMPLOYEE' } });
    empleadoId = empleado.id; pwdOriginal = empleado.passwordHash;
    await prisma.user.update({ where: { id: empleadoId }, data: { passwordHash: await bcrypt.hash(pwd, 12) } });

    const authCli = { headers: { Authorization: `Bearer ${(await axios.post(`${API}/auth/login`, { email, password: pwd })).data.data.token}` } };
    const authEmp = { headers: { Authorization: `Bearer ${(await axios.post(`${API}/auth/login`, { email: empleado.email, password: pwd })).data.data.token}` } };

    console.log('\n── 1. El carnet trae el reloj del servidor ──');
    const emision = (await axios.get(`${API}/luxury/qr/token`, authCli)).data;
    const token = emision.token;
    ok(Number.isFinite(emision.serverNow), `serverNow = ${emision.serverNow} (el celular ya no usa su propia hora)`);
    const desde = emision.serverNow;

    console.log('\n── 2. Antes de que el operario confirme, no hay aviso ──');
    const antes = (await axios.get(`${API}/luxury/latest-wash?since=${desde}`, authCli)).data;
    ok(antes.found === false, 'found=false: el cliente sigue esperando');

    console.log('\n── 3. El operario lee el QR y elige la reserva ──');
    const ver = await axios.post(`${API}/luxury/qr/verify`, { token }, authEmp);
    ok(ver.data.data?.reservas?.length === 1, 'Ve la reserva del cliente para elegirla');
    const scan = await axios.post(`${API}/luxury/qr/scan`, { token, appointmentId: reserva.id }, authEmp);
    ok(scan.data.success === true, `Registrado: "${scan.data.message}"`);

    console.log('\n── 4. Y AHORA sí, al cliente le salta el aviso ──');
    const despues = (await axios.get(`${API}/luxury/latest-wash?since=${desde}`, authCli)).data;
    ok(despues.found === true, 'found=true: la pantalla del cliente muestra "¡Lavado confirmado!"');
    ok(despues.data?.id === reserva.id, 'Es la reserva que el operario registró, no otra');
    ok(!!despues.data?.serviceName, `Con el servicio para mostrarlo en el aviso: "${despues.data?.serviceName}"`);

    console.log('\n── 5. Un QR nuevo no revive el lavado anterior ──');
    // Sin esto, generar otro carnet mostraría el aviso de éxito sin que nadie escanee nada.
    const emision2 = (await axios.get(`${API}/luxury/qr/token`, authCli)).data;
    const nuevo = (await axios.get(`${API}/luxury/latest-wash?since=${emision2.serverNow}`, authCli)).data;
    ok(nuevo.found === false, 'found=false: arranca limpio');

    console.log('\n── 6. El carnet vence mientras el operario elige la reserva ──');
    // El caso real que dejaba al cliente sin aviso: ahora que el escaneo es en dos pasos,
    // el operario tarda más. Si el cliente regenera el carnet en el medio, la pantalla
    // conserva el instante de la PRIMERA emisión de la visita, así que el lavado que se
    // confirma después sigue cayendo dentro de la ventana y el aviso aparece igual.
    const res2 = await prisma.appointment.create({
      data: {
        userId, vehicleId: reserva.vehicleId, serviceId: reserva.serviceId,
        date: new Date(hoy.toISOString().slice(0, 10)),
        startTime: inicio, endTime: new Date(inicio.getTime() + 36e5),
        status: 'CONFIRMED', totalPriceGs: 0, coveredByMembership: true, billingMode: 'covered',
      },
    });
    const referencia = (await axios.get(`${API}/luxury/qr/token`, authCli)).data;   // 1ª emisión
    await axios.get(`${API}/luxury/qr/token`, authCli);                             // el cliente regenera
    const tokenTardio = (await axios.get(`${API}/luxury/qr/token`, authCli)).data.token;
    const ver2 = (await axios.post(`${API}/luxury/qr/verify`, { token: tokenTardio }, authEmp)).data;
    ok(ver2.data?.reservas?.some((r) => r.id === res2.id), 'El carnet regenerado sigue siendo válido para el operario');
    await axios.post(`${API}/luxury/qr/scan`, { token: tokenTardio, appointmentId: res2.id }, authEmp);

    const aviso2 = (await axios.get(`${API}/luxury/latest-wash?since=${referencia.serverNow}`, authCli)).data;
    ok(aviso2.found === true, 'El aviso llega aunque el carnet se haya regenerado en el medio');
    ok(aviso2.data?.id === res2.id, 'Y es el lavado recién confirmado, no el anterior');

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
