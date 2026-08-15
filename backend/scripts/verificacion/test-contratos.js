#!/usr/bin/env node
/** Autorización de débito: previsualización, exigencia de aceptación y constancia guardada. */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const _ax = require('axios');
const axios = _ax.default || _ax;
const bcrypt = require('bcryptjs');
const contractService = require('../../src/services/contractService');

const API = 'http://127.0.0.1:3002/api';
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
let pass = 0, fail = 0, userId = null;
const ok = (c, l, e = '') => { c ? (pass++, console.log(`   ✅ ${l}`)) : (fail++, console.log(`   ❌ ${l} ${e}`)); };

(async () => {
  try {
    const plan = await prisma.plan.findFirst({ where: { name: 'Plan Básico' } });
    const email = `contrato-${Date.now()}@test.local`, pwd = 'Prueba123';
    const user = await prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(pwd, 12), firstName: 'Contrato', lastName: 'Prueba', role: 'CLIENT', documentNumber: '1.234.567' },
    });
    userId = user.id;
    const auth = { headers: { Authorization: `Bearer ${(await axios.post(`${API}/auth/login`, { email, password: pwd })).data.data.token}` } };

    console.log('\n── 1. El cliente ve el documento antes de pagar ──');
    const prev = await axios.get(`${API}/contracts/preview?planId=${plan.id}`, auth);
    const texto = prev.data.data.texto;
    ok(prev.data.success === true, `Título: "${prev.data.data.titulo}"`);
    ok(texto.length > 3000, `El documento es extenso (${texto.length} caracteres)`);

    console.log('\n── 2. Trae los datos reales, no marcadores ──');
    ok(texto.includes('Contrato Prueba'), 'Nombre del cliente');
    ok(texto.includes('1.234.567'), 'Documento del cliente');
    ok(texto.includes(email), 'Correo del cliente');
    ok(texto.includes('LUXURY GARAGE E.A.S.'), 'Razón social del comercio');
    ok(texto.includes('80171845-7'), 'RUC del comercio');
    ok(texto.includes('₲ 250.000'), 'Importe en números');
    ok(texto.includes('doscientos cincuenta mil guaraníes'), 'Importe en letras');
    ok(!texto.includes('{{'), 'No quedan variables sin resolver');

    console.log('\n── 3. Contenido legal exigible ──');
    for (const [frag, que] of [
      ['AUTORIZA', 'la autorización expresa'],
      ['RENOVACIÓN AUTOMÁTICA', 'la renovación automática'],
      ['CANCELACIÓN', 'cómo cancelar'],
      ['RECHAZO DEL DÉBITO', 'qué pasa si el cobro falla'],
      ['DEVOLUCIONES', 'las devoluciones'],
      ['DATOS PERSONALES', 'el tratamiento de datos'],
      ['JURISDICCIÓN', 'la jurisdicción'],
      ['Bancard', 'quién guarda los datos de la tarjeta'],
    ]) ok(texto.includes(frag), `Incluye ${que}`);

    console.log('\n── 4. Sin aceptar, no se cobra ──');
    try {
      await axios.post(`${API}/payments/charge-membership`, { planId: plan.id }, auth);
      ok(false, '⚠️ COBRÓ SIN AUTORIZACIÓN');
    } catch (e) {
      ok(e.response?.data?.code === 'MANDATE_REQUIRED', `Rechazado: "${e.response?.data?.message}"`);
    }

    console.log('\n── 5. La constancia se guarda con el texto completo ──');
    // Se simula el cobro aprobado escribiendo el contrato igual que lo hace payments.js.
    const cfg = await contractService.obtenerConfig(prisma);
    const comercio = await contractService.datosComercio(prisma);
    const numero = await contractService.siguienteNumero(prisma);
    const textoFinal = contractService.componerTexto({
      plantilla: cfg.plantilla, numero,
      cliente: { nombre: 'Contrato Prueba', documento: '1.234.567', email },
      comercio, plan: plan.name, montoGs: plan.priceGs,
      tarjeta: { marca: 'Visa', ultimos4: '4242' },
      fecha: new Date(), ip: '186.16.0.1', userAgent: 'Chrome',
    });
    await prisma.$executeRaw`
      INSERT INTO contracts (id, numero, user_id, plan_nombre, monto_gs, periodicidad, tarjeta_marca,
        tarjeta_ultimos4, texto_version, texto_completo, cliente_snapshot, comercio_snapshot,
        aceptado_en, aceptado_ip, aceptado_user_agent, estado, created_at)
      VALUES (gen_random_uuid()::text, ${numero}, ${userId}, ${plan.name}, ${plan.priceGs}, 'mensual', 'Visa',
        '4242', ${cfg.version}, ${textoFinal}, ${JSON.stringify({ nombre: 'Contrato Prueba' })}::jsonb,
        ${JSON.stringify(comercio)}::jsonb, now(), '186.16.0.1', 'Chrome', 'VIGENTE', now())`;

    const mios = await axios.get(`${API}/contracts/me`, auth);
    ok(mios.data.data.length === 1, `El cliente ve su documento (N° ${mios.data.data[0]?.numero})`);
    const detalle = await axios.get(`${API}/contracts/me/${mios.data.data[0].id}`, auth);
    ok(detalle.data.data.texto_completo?.length > 3000, 'Con el texto íntegro para descargar');
    ok(!!detalle.data.data.aceptado_ip, `Con constancia de origen (IP ${detalle.data.data.aceptado_ip})`);

    console.log('\n── 6. Editar las condiciones NO altera lo ya firmado ──');
    const antes = detalle.data.data.texto_completo;
    await prisma.setting.upsert({
      where: { key: 'debit_mandate' },
      update: { value: { plantilla: 'TEXTO NUEVO DE PRUEBA ' + 'x'.repeat(200), version: '9.9' } },
      create: { key: 'debit_mandate', value: { plantilla: 'TEXTO NUEVO DE PRUEBA ' + 'x'.repeat(200), version: '9.9' } },
    });
    const despues = await axios.get(`${API}/contracts/me/${mios.data.data[0].id}`, auth);
    ok(despues.data.data.texto_completo === antes, 'El documento firmado quedó intacto tras cambiar la plantilla');
    // Restaurar
    await prisma.setting.delete({ where: { key: 'debit_mandate' } }).catch(() => {});

    console.log('\n── 7. Un cliente no ve documentos de otro ──');
    const otro = await prisma.user.create({
      data: { email: `otro-${Date.now()}@test.local`, passwordHash: await bcrypt.hash(pwd, 12), firstName: 'Otro', lastName: 'X', role: 'CLIENT' },
    });
    const authOtro = { headers: { Authorization: `Bearer ${(await axios.post(`${API}/auth/login`, { email: otro.email, password: pwd })).data.data.token}` } };
    try {
      await axios.get(`${API}/contracts/me/${mios.data.data[0].id}`, authOtro);
      ok(false, '⚠️ FUGA: vio el contrato ajeno');
    } catch (e) { ok(e.response?.status === 404, 'El contrato ajeno no es accesible'); }
    await prisma.user.delete({ where: { id: otro.id } });

  } catch (e) {
    console.error('\n💥', e.response?.status || '', e.response?.data ? JSON.stringify(e.response.data).slice(0, 250) : e.message);
    fail++;
  } finally {
    if (userId) {
      await prisma.$executeRaw`DELETE FROM contracts WHERE user_id = ${userId}`.catch(() => {});
      for (const m of ['payment', 'appointment', 'credit', 'bancardOperation', 'membership', 'vehicle', 'paymentCard', 'notification', 'auditLog']) {
        await prisma[m].deleteMany({ where: { userId } }).catch(() => {});
      }
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    ok(!(userId && await prisma.user.findFirst({ where: { id: userId } })), 'Limpieza: usuario de prueba eliminado');
  }
  console.log(`\n${'═'.repeat(60)}\n   RESULTADO: ${pass} pasaron · ${fail} fallaron`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})();
