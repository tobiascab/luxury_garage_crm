#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
/** Flujo completo del QR: cliente genera su carnet → empleado lo escanea → se cierra el lavado. */

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const _ax = require('axios');
const axios = _ax.default || _ax;
const bcrypt = require('bcryptjs');

const API = 'http://127.0.0.1:3002/api';
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
let pass = 0, fail = 0, userId = null, empleadoPwdOriginal = null, empleadoId = null;
const ok = (c, l, e = '') => { c ? (pass++, console.log(`   ✅ ${l}`)) : (fail++, console.log(`   ❌ ${l} ${e}`)); };

(async () => {
  try {
    const plan = await prisma.plan.findFirst({ where: { name: 'Plan Básico' } });
    const servicio = await prisma.service.findFirst({ where: { slug: 'ducha-cera-carnauba' } });

    // Cliente con plan ACTIVO y una reserva confirmada.
    const email = `qr-${Date.now()}@test.local`, pwd = 'Prueba123';
    const cliente = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(pwd, 12), firstName: 'Qr', lastName: 'Test', role: 'CLIENT' } });
    userId = cliente.id;
    await prisma.membership.create({ data: { userId, planId: plan.id, status: 'ACTIVE', startDate: new Date(), endDate: new Date(Date.now() + 30 * 864e5), autoRenew: true } });
    const veh = await prisma.vehicle.create({ data: { userId, brand: 'Toyota', model: 'Corolla', year: 2022, licensePlate: 'QRT123', isPrimary: true } });
    const cita = await prisma.appointment.create({
      data: {
        userId, vehicleId: veh.id, serviceId: servicio.id,
        date: new Date(), startTime: new Date(), endTime: new Date(Date.now() + 36e5),
        status: 'CONFIRMED', totalPriceGs: 0, coveredByMembership: true, billingMode: 'covered',
      },
    });

    // Empleado: le ponemos una contraseña conocida y la restauramos al final.
    const empleado = await prisma.user.findFirst({ where: { role: 'EMPLOYEE' } });
    empleadoId = empleado.id; empleadoPwdOriginal = empleado.passwordHash;
    await prisma.user.update({ where: { id: empleadoId }, data: { passwordHash: await bcrypt.hash('Prueba123', 12) } });

    const authCliente = { headers: { Authorization: `Bearer ${(await axios.post(`${API}/auth/login`, { email, password: pwd })).data.data.token}` } };
    const authEmpleado = { headers: { Authorization: `Bearer ${(await axios.post(`${API}/auth/login`, { email: empleado.email, password: 'Prueba123' })).data.data.token}` } };

    console.log('\n── 1. El cliente genera su carnet QR ──');
    const qr = await axios.get(`${API}/luxury/qr/token`, authCliente);
    const token = qr.data.token;
    ok(!!token && token.startsWith('LUXURY-'), 'El backend emite el token del QR (firmado)');
    ok(qr.data.validityMs === 15 * 60 * 1000, 'Vence a los 15 minutos');

    console.log('\n── 2. Un QR falsificado se rechaza ──');
    try {
      await axios.post(`${API}/luxury/qr/scan`, { token: `LUXURY-${userId}-${Date.now()}-000000000000000000000000` }, authEmpleado);
      ok(false, 'DEBERÍA rechazar un QR con firma inválida');
    } catch (e) {
      ok(e.response?.status === 400, `QR adulterado rechazado: "${e.response?.data?.message}"`);
    }

    console.log('\n── 3. El empleado escanea el QR real ──');
    const scan = await axios.post(`${API}/luxury/qr/scan`, { token }, authEmpleado);
    const d = scan.data.data;
    ok(scan.data.success === true, `Escaneo OK: "${scan.data.message}"`);
    ok(d.client?.name === 'Qr Test', `Identifica al cliente: ${d.client?.name}`);
    ok(d.client?.role === 'Plan Básico', `Muestra su plan: ${d.client?.role}`);
    ok(d.client?.vehicle?.plate === 'QRT123', `Muestra su vehículo: ${d.client?.vehicle?.plate}`);
    ok(d.service?.name === servicio.name, `Registra el servicio reservado: ${d.service?.name}`);
    ok(d.covered === true, 'Marca que estaba cubierto por el plan (₲0 para el cliente)');
    ok(d.client?.remainingWashes === 3, `Le descuenta el lavado: le quedan ${d.client?.remainingWashes} de 4`);

    console.log('\n── 4. Efectos en la base ──');
    const citaFinal = await prisma.appointment.findUnique({ where: { id: cita.id } });
    ok(citaFinal.status === 'COMPLETED', 'La reserva quedó COMPLETADA');
    ok(citaFinal.employeeId === empleadoId, 'Queda registrado qué empleado la atendió');
    const sr = await prisma.serviceRecord.findUnique({ where: { appointmentId: cita.id } });
    ok(!!sr?.completedAt, 'Se creó el registro de servicio con su hora de cierre');
    const movs = await prisma.stockMovement.count({ where: { serviceRecordId: sr.id } });
    ok(movs > 0, `Descontó insumos del inventario automáticamente (${movs} movimientos)`);

    console.log('\n── 5. El cliente ve el descuento reflejado ──');
    const prof = await axios.get(`${API}/luxury/profile/full`, authCliente);
    ok(prof.data.data.planUsage?.used === 1, 'Su contador marca 1 lavado usado');
    ok(prof.data.data.planUsage?.remaining === 3, 'Y le muestra 3 lavados restantes — mismo número que vio el empleado');

    console.log('\n── 6. Escanear de nuevo sin reserva ──');
    try {
      const qr2 = await axios.get(`${API}/luxury/qr/token`, authCliente);
      await axios.post(`${API}/luxury/qr/scan`, { token: qr2.data.token }, authEmpleado);
      ok(false, 'DEBERÍA bloquear el escaneo sin reserva pendiente');
    } catch (e) {
      ok(e.response?.data?.code === 'NO_RESERVATION', `Bloquea el doble uso: "${e.response?.data?.message}"`);
    }

  } catch (e) {
    console.error('\n💥', e.response?.status || '', e.response?.data ? JSON.stringify(e.response.data).slice(0, 250) : e.message);
    fail++;
  } finally {
    if (empleadoId && empleadoPwdOriginal) await prisma.user.update({ where: { id: empleadoId }, data: { passwordHash: empleadoPwdOriginal } });
    if (userId) {
      const citas = await prisma.appointment.findMany({ where: { userId }, select: { id: true } });
      for (const c of citas) {
        const sr = await prisma.serviceRecord.findUnique({ where: { appointmentId: c.id } });
        if (sr) { await prisma.stockMovement.deleteMany({ where: { serviceRecordId: sr.id } }); await prisma.serviceRecord.delete({ where: { id: sr.id } }); }
      }
      await prisma.payment.deleteMany({ where: { userId } });
      await prisma.appointment.deleteMany({ where: { userId } });
      await prisma.credit.deleteMany({ where: { userId } });
      await prisma.bancardOperation.deleteMany({ where: { userId } });
      await prisma.membership.deleteMany({ where: { userId } });
      await prisma.vehicle.deleteMany({ where: { userId } });
      await prisma.notification.deleteMany({ where: { userId } });
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    const q = { clientes: await prisma.user.count({ where: { role: 'CLIENT' } }), citas: await prisma.appointment.count(), registros: await prisma.serviceRecord.count() };
    ok(q.clientes === 0 && q.citas === 0 && q.registros === 0, `Limpieza OK — contraseña del empleado restaurada, BD sin rastros: ${JSON.stringify(q)}`);
  }
  console.log(`\n${'═'.repeat(60)}\n   RESULTADO: ${pass} pasaron · ${fail} fallaron`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})();
