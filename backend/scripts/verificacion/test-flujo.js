#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
/**
 * Prueba end-to-end de la lógica de negocio contra la BD REAL, dentro de una transacción
 * que SIEMPRE hace rollback: no deja ni un registro.
 *
 * Cubre: alta del admin (plan PENDING) → activación por cobro → cupos que se descuentan →
 * agotamiento → cancelación que devuelve el cupo → overage → renovación.
 */

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { getServiceCoverage, getPlanUsage } = require('../../src/services/membershipCoverage');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`   ✅ ${label}`); }
  else { fail++; console.log(`   ❌ ${label} ${extra}`); }
};

const ROLLBACK = new Error('__ROLLBACK__');

(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const planBasico = await tx.plan.findFirst({ where: { name: 'Plan Básico' } });
      const planVip = await tx.plan.findFirst({ where: { name: 'Plan VIP' } });
      const planPremium = await tx.plan.findFirst({ where: { name: 'Plan Premium' } });
      const service = await tx.service.findFirst({ where: { slug: (planBasico.servicesIncluded || [])[0]?.slug } });
      const sellador = await tx.service.findFirst({ where: { slug: (planPremium?.servicesIncluded || []).find(x => x.slug !== (planBasico.servicesIncluded||[])[0]?.slug)?.slug } });
      const size = await tx.vehicleSize.findFirst();
      console.log(`\nPlan Básico: ₲${planBasico.priceGs} · cupo ducha-cera = ${planBasico.servicesIncluded[0].quota}`);

      // ── 1. Alta por el admin: el plan queda PENDING, NO activo ─────────────────
      console.log('\n── 1. Alta del admin (plan preseleccionado, sin cobrar) ──');
      const user = await tx.user.create({
        data: { email: `test-${Date.now()}@x.com`, passwordHash: 'x', firstName: 'Test', lastName: 'Cliente', role: 'CLIENT' },
      });
      await tx.membership.create({
        data: { userId: user.id, planId: planBasico.id, status: 'PENDING', startDate: new Date(), endDate: new Date(Date.now() + 30 * 864e5) },
      });
      const activa = await tx.membership.findFirst({ where: { userId: user.id, status: 'ACTIVE' } });
      ok(!activa, 'La membresía NO queda activa antes de pagar');
      const cov0 = await getServiceCoverage(tx, user.id, service);
      ok(cov0.hasMembership === false, 'Sin pagar, el sistema lo trata como SIN membresía');
      ok(cov0.covered === false, 'Sin pagar, ningún servicio queda cubierto (se le cobraría)');
      const usage0 = await getPlanUsage(tx, user.id);
      ok(usage0 === null, 'Sin membresía activa no hay cupo que mostrar');

      // ── 2. Paga → se activa y consume la PENDING ───────────────────────────────
      console.log('\n── 2. El cliente carga tarjeta y paga (se activa) ──');
      await tx.membership.updateMany({ where: { userId: user.id, status: { in: ['ACTIVE', 'PENDING'] } }, data: { status: 'REPLACED' } });
      const memb = await tx.membership.create({
        data: { userId: user.id, planId: planBasico.id, status: 'ACTIVE', startDate: new Date(), endDate: new Date(Date.now() + 30 * 864e5), autoRenew: true },
      });
      const pendientes = await tx.membership.count({ where: { userId: user.id, status: 'PENDING' } });
      ok(pendientes === 0, 'La membresía PENDING se consume al pagar (no queda duplicada)');
      const usage1 = await getPlanUsage(tx, user.id);
      ok(usage1?.quota === 4 && usage1?.used === 0 && usage1?.remaining === 4, `Arranca con 4 lavados disponibles (quota=${usage1?.quota}, usados=${usage1?.used}, quedan=${usage1?.remaining})`);
      ok(usage1?.unlimited === false, 'Plan Básico NO es ilimitado');

      // ── 3. Consumo de cupo: se resta uno a uno ─────────────────────────────────
      console.log('\n── 3. Reserva lavados: el cupo baja 4 → 3 → 2 → 1 → 0 ──');
      const vehicle = await tx.vehicle.create({ data: { userId: user.id, brand: 'Toyota', model: 'Hilux', year: 2020, licensePlate: 'TEST123', isPrimary: true } });
      const citas = [];
      for (let i = 1; i <= 4; i++) {
        const cov = await getServiceCoverage(tx, user.id, service);
        ok(cov.covered === true, `Lavado ${i}: cubierto por el plan (quedan ${cov.remaining})`);
        const start = new Date(Date.now() + i * 864e5);
        const c = await tx.appointment.create({
          data: {
            userId: user.id, vehicleId: vehicle.id, serviceId: service.id,
            date: start, startTime: start, endTime: new Date(start.getTime() + 36e5),
            status: 'CONFIRMED', totalPriceGs: 0, coveredByMembership: true, billingMode: 'covered',
          },
        });
        citas.push(c);
        const u = await getPlanUsage(tx, user.id);
        ok(u.used === i && u.remaining === 4 - i, `   → usados=${i}, quedan=${4 - i}`);
      }

      // ── 4. Cupo agotado → ya no cubre, se cobra ────────────────────────────────
      console.log('\n── 4. Cupo agotado ──');
      const covAgotado = await getServiceCoverage(tx, user.id, service);
      ok(covAgotado.covered === false, 'El 5º lavado YA NO está cubierto');
      ok(covAgotado.inPlan === true && covAgotado.hasMembership === true, 'Pero sigue siendo un servicio del plan → se le ofrece pagar o cargar al próximo mes');
      ok(covAgotado.remaining === 0, 'Cupo restante = 0');

      // ── 5. Cancelar devuelve el cupo ───────────────────────────────────────────
      console.log('\n── 5. Cancelar un turno devuelve el lavado ──');
      await tx.appointment.update({ where: { id: citas[3].id }, data: { status: 'CANCELLED' } });
      const covTrasCancelar = await getServiceCoverage(tx, user.id, service);
      ok(covTrasCancelar.covered === true && covTrasCancelar.remaining === 1, `Tras cancelar vuelve a tener 1 lavado (quedan=${covTrasCancelar.remaining})`);
      const uc = await getPlanUsage(tx, user.id);
      ok(uc.used === 3, 'El contador visible baja de 4 a 3');

      // ── 6. NO_SHOW sí consume ─────────────────────────────────────────────────
      console.log('\n── 6. El cliente que no se presenta SÍ consume el lavado ──');
      await tx.appointment.update({ where: { id: citas[2].id }, data: { status: 'NO_SHOW' } });
      const covNoShow = await getServiceCoverage(tx, user.id, service);
      ok(covNoShow.remaining === 1, 'NO_SHOW no devuelve el cupo (quedan 1, el cancelado)');

      // ── 7. Servicio fuera del plan ────────────────────────────────────────────
      console.log('\n── 7. Servicio que NO está en el plan ──');
      const covFuera = await getServiceCoverage(tx, user.id, sellador);
      ok(covFuera.inPlan === false && covFuera.covered === false, 'Sellador cerámico no está en el Básico → se cobra completo');

      // ── 8. Plan ilimitado ─────────────────────────────────────────────────────
      console.log('\n── 8. Plan VIP (ilimitado) ──');
      await tx.membership.updateMany({ where: { userId: user.id, status: 'ACTIVE' }, data: { status: 'REPLACED' } });
      await tx.membership.create({
        data: { userId: user.id, planId: planVip.id, status: 'ACTIVE', startDate: new Date(), endDate: new Date(Date.now() + 30 * 864e5), autoRenew: true },
      });
      const covVip = await getServiceCoverage(tx, user.id, service);
      ok(covVip.covered === true && covVip.unlimited === true, 'VIP cubre lavados ilimitados');
      const uVip = await getPlanUsage(tx, user.id);
      ok(uVip.unlimited === true && uVip.remaining === null, 'La UI recibe "ilimitado" (remaining=null → muestra ∞)');
      const covVipSellador = await getServiceCoverage(tx, user.id, sellador);
      ok(covVipSellador.covered === true, 'VIP también cubre el sellador cerámico');

      // ── 9. Ciclo: el cupo NO se resetea el día 1 del mes ──────────────────────
      console.log('\n── 9. El cupo sigue el ciclo de la membresía, no el mes calendario ──');
      // Cliente NUEVO (aislado) que se asoció el 25 del mes pasado: su ciclo cruza el cambio de mes.
      const user2 = await tx.user.create({
        data: { email: `test2-${Date.now()}@x.com`, passwordHash: 'x', firstName: 'Ciclo', lastName: 'Test', role: 'CLIENT' },
      });
      const veh2 = await tx.vehicle.create({ data: { userId: user2.id, brand: 'VW', model: 'Golf', year: 2021, licensePlate: 'CICLO1', isPrimary: true } });
      const inicioCicloPasado = new Date(); inicioCicloPasado.setMonth(inicioCicloPasado.getMonth() - 1); inicioCicloPasado.setDate(25);
      const finCiclo = new Date(inicioCicloPasado); finCiclo.setMonth(finCiclo.getMonth() + 1);
      const membCiclo = await tx.membership.create({
        data: { userId: user2.id, planId: planBasico.id, status: 'ACTIVE', startDate: inicioCicloPasado, endDate: finCiclo, autoRenew: true },
      });
      // Dos lavados consumidos el MES PASADO, dentro de este mismo ciclo.
      for (let i = 0; i < 2; i++) {
        const d = new Date(inicioCicloPasado.getTime() + (i + 1) * 864e5);
        await tx.appointment.create({
          data: {
            userId: user2.id, vehicleId: veh2.id, serviceId: service.id,
            date: d, startTime: d, endTime: new Date(d.getTime() + 36e5),
            status: 'COMPLETED', totalPriceGs: 0, coveredByMembership: true, billingMode: 'covered',
            createdAt: d,
          },
        });
      }
      const uCiclo = await getPlanUsage(tx, user2.id);
      ok(uCiclo.used === 2 && uCiclo.remaining === 2, `Los lavados del mes pasado siguen contando en el ciclo vigente (usados=${uCiclo.used}, quedan=${uCiclo.remaining}) — antes el día 1 se le regalaban 4 lavados nuevos`);

      // ── 10. Renovación: ciclo nuevo, cupo lleno ───────────────────────────────
      console.log('\n── 10. Al renovar, el cupo vuelve a estar completo ──');
      await tx.membership.update({ where: { id: membCiclo.id }, data: { status: 'EXPIRED' } });
      await tx.membership.create({
        data: { userId: user2.id, planId: planBasico.id, status: 'ACTIVE', startDate: new Date(), endDate: new Date(Date.now() + 30 * 864e5), autoRenew: true },
      });
      const uNuevo = await getPlanUsage(tx, user2.id);
      ok(uNuevo.used === 0 && uNuevo.remaining === 4, 'Ciclo nuevo → 4 lavados otra vez');

      throw ROLLBACK;
    }, { timeout: 60000 });
  } catch (e) {
    if (e !== ROLLBACK) { console.error('\n💥 ERROR:', e.message); fail++; }
  }

  console.log(`\n${'═'.repeat(60)}\n   RESULTADO: ${pass} pasaron · ${fail} fallaron`);
  console.log('   (todo dentro de una transacción con ROLLBACK: la BD quedó intacta)');
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})();
