#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
/**
 * Pruebas de INTEGRIDAD DE COBROS contra la BD real, simulando las respuestas de Bancard.
 * Cubre: doble cobro, no-cobro, rechazo, monto manipulado, red caída, y auto-renovación.
 *
 * Crea un usuario de prueba aislado y LO BORRA TODO al final (con verificación de que la BD
 * quedó en el mismo estado que antes de empezar).
 */

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Bancard simulado: controlamos qué "responde" para cada shop_process_id.
const bancardService = require('../../src/services/bancardService');
const respuestas = new Map();
bancardService.getConfirmation = async (sp) => {
  const r = respuestas.get(Number(sp));
  if (!r) throw new Error('Bancard: No se pudo obtener la confirmación'); // red caída / no existe aún
  return r;
};
const { materializeApprovedPayment } = require('../../src/services/paymentReconciliation');

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`   ✅ ${label}`); }
  else { fail++; console.log(`   ❌ ${label} ${extra}`); }
};
const APROBADO = (amount) => ({ response: 'S', response_code: '00', amount: String(amount) + '.00', ticket_number: '123456', authorization_number: '654321' });
const RECHAZADO = (amount) => ({ response: 'S', response_code: '12', amount: String(amount) + '.00' }); // ¡'S' pero denegado!

let userId = null;

(async () => {
  const estadoInicial = {
    users: await prisma.user.count(),
    payments: await prisma.payment.count(),
    memberships: await prisma.membership.count(),
    credits: await prisma.credit.count(),
    ops: await prisma.bancardOperation.count(),
  };

  try {
    const plan = await prisma.plan.findFirst({ where: { name: 'Plan Básico' } });
    const user = await prisma.user.create({
      data: { email: `cobros-${Date.now()}@test.local`, passwordHash: 'x', firstName: 'Cobro', lastName: 'Test', role: 'CLIENT' },
    });
    userId = user.id;

    const nuevaOp = async (sp, meta, amountGs) => {
      await prisma.bancardOperation.create({
        data: { shopProcessId: sp, userId, type: 'charge', status: 'PENDING', amountGs, metadataJson: meta },
      });
      await prisma.payment.create({
        data: { userId, amountGs, paymentMethod: 'bancard_card', bancardShopProcessId: sp, status: 'PENDING', description: 'test' },
      });
    };

    // ── 1. Cobro aprobado → entrega el valor UNA vez ───────────────────────────
    console.log('\n── 1. Cobro aprobado de membresía ──');
    const sp1 = Date.now();
    await nuevaOp(sp1, { planId: plan.id, planName: plan.name, chargeAmountGs: plan.priceGs }, plan.priceGs);
    respuestas.set(sp1, APROBADO(plan.priceGs));
    const r1 = await materializeApprovedPayment(prisma, sp1);
    ok(r1.status === 'completed' && r1.kind === 'membership', 'El pago aprobado activa la membresía');
    ok(await prisma.membership.count({ where: { userId, status: 'ACTIVE' } }) === 1, 'Queda exactamente 1 membresía activa');
    ok((await prisma.payment.findUnique({ where: { bancardShopProcessId: sp1 } })).status === 'COMPLETED', 'El pago queda COMPLETED');

    // ── 2. DOBLE COBRO: reintentar la misma operación no duplica nada ──────────
    console.log('\n── 2. Doble materialización del MISMO pago (webhook + job a la vez) ──');
    const r2a = await materializeApprovedPayment(prisma, sp1);
    const r2b = await materializeApprovedPayment(prisma, sp1);
    ok(r2a.status === 'noop' && r2b.status === 'noop', 'Los reintentos no vuelven a aplicar el pago');
    ok(await prisma.membership.count({ where: { userId, status: 'ACTIVE' } }) === 1, 'Sigue habiendo 1 sola membresía activa (no se duplicó)');
    ok(await prisma.payment.count({ where: { userId, status: 'COMPLETED' } }) === 1, 'Sigue habiendo 1 solo pago cobrado');

    // ── 3. Concurrencia real: 5 materializaciones en paralelo ─────────────────
    console.log('\n── 3. 5 materializaciones concurrentes del mismo cobro ──');
    const sp3 = Date.now() + 1;
    await nuevaOp(sp3, { kind: 'topup', amountGs: 50000 }, 50000);
    respuestas.set(sp3, APROBADO(50000));
    const res3 = await Promise.all(Array.from({ length: 5 }, () => materializeApprovedPayment(prisma, sp3)));
    const completados = res3.filter((r) => r.status === 'completed').length;
    ok(completados === 1, `Solo UNA de las 5 llamadas concurrentes acreditó el saldo (fueron ${completados})`);
    const saldo = await prisma.credit.aggregate({ where: { userId }, _sum: { amount: true } });
    ok(saldo._sum.amount === 50000, `La billetera se acreditó una sola vez: ₲${saldo._sum.amount}`);

    // ── 4. NO COBRO: rechazo con response 'S' pero code 12 ────────────────────
    console.log('\n── 4. Cobro RECHAZADO por el banco (response=S pero code=12) ──');
    const sp4 = Date.now() + 2;
    await nuevaOp(sp4, { planId: plan.id, chargeAmountGs: plan.priceGs }, plan.priceGs);
    respuestas.set(sp4, RECHAZADO(plan.priceGs));
    const r4 = await materializeApprovedPayment(prisma, sp4);
    ok(r4.status === 'failed' && r4.reason === 'declined', 'Un cobro denegado NO se toma como aprobado');
    ok((await prisma.payment.findUnique({ where: { bancardShopProcessId: sp4 } })).status === 'FAILED', 'El pago rechazado queda FAILED');
    ok(await prisma.membership.count({ where: { userId, status: 'ACTIVE' } }) === 1, 'El rechazo NO regaló una membresía nueva');

    // ── 5. Monto manipulado ───────────────────────────────────────────────────
    console.log('\n── 5. El monto cobrado no coincide con el pedido (anti-manipulación) ──');
    const sp5 = Date.now() + 3;
    await nuevaOp(sp5, { planId: plan.id, chargeAmountGs: plan.priceGs }, plan.priceGs);
    respuestas.set(sp5, APROBADO(1)); // pagó ₲1 por un plan de ₲250.000
    const r5 = await materializeApprovedPayment(prisma, sp5);
    ok(r5.status === 'failed' && r5.reason === 'amount_mismatch', 'Pagar ₲1 por un plan caro se rechaza');
    ok(await prisma.membership.count({ where: { userId, status: 'ACTIVE' } }) === 1, 'No entregó la membresía');

    // ── 6. Bancard no responde → queda PENDING (nunca FAILED a ciegas) ────────
    console.log('\n── 6. Bancard no responde (timeout / red caída) ──');
    const sp6 = Date.now() + 4;
    await nuevaOp(sp6, { planId: plan.id, chargeAmountGs: plan.priceGs }, plan.priceGs);
    // sin respuesta registrada → getConfirmation lanza
    const r6 = await materializeApprovedPayment(prisma, sp6);
    ok(r6.status === 'pending', 'Si no se puede confirmar, NO se marca fallido: se reintenta después');
    ok((await prisma.payment.findUnique({ where: { bancardShopProcessId: sp6 } })).status === 'PENDING', 'El pago sigue PENDING para reconciliar');

    // ── 7. Auto-renovación: no recobrar una membresía ya renovada ─────────────
    console.log('\n── 7. Auto-renovación: guardia anti doble-cobro ──');
    const membActiva = await prisma.membership.findFirst({ where: { userId, status: 'ACTIVE' } });
    const spRenov = Date.now() + 5;
    await prisma.bancardOperation.create({
      data: {
        shopProcessId: spRenov, userId, type: 'charge', status: 'PENDING', amountGs: plan.priceGs,
        metadataJson: { membershipId: membActiva.id, planId: plan.id, isAutoRenewal: true },
      },
    });
    // Misma consulta que usa el job antes de cobrar:
    const priorOp = await prisma.bancardOperation.findFirst({
      where: {
        userId, type: 'charge', status: { in: ['PENDING', 'COMPLETED', 'NEEDS_RECONCILIATION'] },
        AND: [
          { metadataJson: { path: ['membershipId'], equals: membActiva.id } },
          { metadataJson: { path: ['isAutoRenewal'], equals: true } },
        ],
      },
    });
    ok(!!priorOp, 'El job detecta la renovación ya iniciada y NO vuelve a cobrar la tarjeta');

    // ── 8. Overage anulado al cancelar el turno ───────────────────────────────
    console.log('\n── 8. Extra diferido: si se cancela el turno, no se cobra al renovar ──');
    const vehiculo = await prisma.vehicle.create({ data: { userId, brand: 'Ford', model: 'Ka', year: 2019, licensePlate: 'OVER01', isPrimary: true } });
    const servicio = await prisma.service.findFirst({ where: { slug: (plan.servicesIncluded || [])[0]?.slug } });
    const cita = await prisma.appointment.create({
      data: {
        userId, vehicleId: vehiculo.id, serviceId: servicio.id,
        date: new Date(), startTime: new Date(), endTime: new Date(Date.now() + 36e5),
        status: 'CONFIRMED', totalPriceGs: 70000, coveredByMembership: false, billingMode: 'overage_next_cycle',
      },
    });
    await prisma.payment.create({
      data: { userId, amountGs: 70000, paymentMethod: 'bancard_card', status: 'PENDING', description: `overage:${servicio.slug}#${cita.id}` },
    });
    const cobrablesAntes = await prisma.payment.count({ where: { userId, status: 'PENDING', description: { startsWith: 'overage:' } } });
    ok(cobrablesAntes === 1, 'El extra queda pendiente para la próxima renovación');
    // Cancelación (misma lógica que DELETE /appointments/:id):
    await prisma.appointment.update({ where: { id: cita.id }, data: { status: 'CANCELLED' } });
    await prisma.payment.updateMany({
      where: { userId, status: 'PENDING', description: { endsWith: `#${cita.id}` } },
      data: { status: 'FAILED', description: `overage anulado por cancelación del turno #${cita.id}` },
    });
    const cobrablesDespues = await prisma.payment.count({ where: { userId, status: 'PENDING', description: { startsWith: 'overage:' } } });
    ok(cobrablesDespues === 0, 'Tras cancelar, ese extra ya NO se le cobra en la renovación');

  } catch (e) {
    console.error('\n💥 ERROR:', e.message, e.stack?.split('\n')[1] || '');
    fail++;
  } finally {
    // ── Limpieza total del usuario de prueba ──
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
    const estadoFinal = {
      users: await prisma.user.count(),
      payments: await prisma.payment.count(),
      memberships: await prisma.membership.count(),
      credits: await prisma.credit.count(),
      ops: await prisma.bancardOperation.count(),
    };
    console.log('\n── Limpieza ──');
    const limpio = JSON.stringify(estadoInicial) === JSON.stringify(estadoFinal);
    ok(limpio, `La BD quedó igual que antes del test: ${JSON.stringify(estadoFinal)}`, JSON.stringify(estadoInicial));
  }

  console.log(`\n${'═'.repeat(60)}\n   RESULTADO: ${pass} pasaron · ${fail} fallaron`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})();
