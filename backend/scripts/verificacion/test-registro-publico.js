require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const _ax = require('axios'); const axios = _ax.default || _ax;
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
const API = 'http://127.0.0.1:3002/api';
let pass=0, fail=0, userId=null;
const ok=(c,l,e='')=>{c?(pass++,console.log('   ✅ '+l)):(fail++,console.log('   ❌ '+l+' '+e));};
(async () => {
  const email = `auto-${Date.now()}@test.local`;
  try {
    console.log('\n── Una persona se registra sola desde la web ──');
    const r = await axios.post(`${API}/auth/public-register`, {
      email, password: 'Prueba123', firstName: 'Auto', lastName: 'Registro', phone: '0981000000',
      vehicle: { brand: 'Toyota', model: 'Corolla', year: 2021, color: 'Gris', licensePlate: 'AUTO01' },
    });
    ok(r.data.success === true, `Cuenta creada: "${r.data.message}"`);
    ok(!!r.data.data?.token, 'Queda logueada al instante (sin esperar a un admin)');
    userId = r.data.data.user.id;
    const auth = { headers: { Authorization: `Bearer ${r.data.data.token}` } };

    console.log('\n── Al entrar, el sistema le exige pagar ──');
    const p = await axios.get(`${API}/luxury/profile/full`, auth);
    ok(p.data.data.onboardingRequired === true, 'Le aparece el alta: tarjeta → plan → pago');
    ok(p.data.data.hasPaymentCard === false, 'Todavía sin tarjeta');
    ok(p.data.data.planUsage === null, 'Y sin lavados hasta que pague');

    console.log('\n── Su vehículo quedó cargado ──');
    const v = await prisma.vehicle.findFirst({ where: { userId } });
    ok(v?.licensePlate === 'AUTO01', `Vehículo: ${v?.brand} ${v?.model} (${v?.licensePlate})`);

    console.log('\n── Puede elegir cualquier plan y ver el contrato ──');
    const plan = await prisma.plan.findFirst({ where: { name: 'Plan Premium' } });
    const c = await axios.get(`${API}/contracts/preview?planId=${plan.id}`, auth);
    ok(c.data.data.texto.includes('Auto Registro'), 'El contrato sale a su nombre');
    ok(c.data.data.texto.includes('Gs. 450.000'), 'Con el importe del plan que eligió');

    console.log('\n── No se puede registrar dos veces el mismo correo ──');
    try {
      await axios.post(`${API}/auth/public-register`, { email, password: 'Prueba123', firstName: 'X', lastName: 'Y' });
      ok(false, '⚠️ PERMITIÓ DUPLICADO');
    } catch (e) { ok(e.response?.status === 409, `Rechazado: "${e.response?.data?.message}"`); }
  } catch (e) {
    console.error('\n💥', e.response?.status||'', JSON.stringify(e.response?.data||e.message).slice(0,200)); fail++;
  } finally {
    if (userId) {
      for (const m of ['payment','appointment','credit','bancardOperation','membership','vehicle','paymentCard','notification','auditLog','referral'])
        await prisma[m].deleteMany({ where: { userId } }).catch(()=>{});
      await prisma.user.delete({ where: { id: userId } }).catch(()=>{});
    }
    ok(!(userId && await prisma.user.findFirst({ where: { id: userId } })), 'Limpieza: cuenta de prueba eliminada');
  }
  console.log(`\n   RESULTADO: ${pass} pasaron · ${fail} fallaron`);
  await prisma.$disconnect(); process.exit(fail?1:0);
})();
