#!/usr/bin/env node
/**
 * Las redes se cargan desde el admin y se muestran en la app. Lo que importa: que el admin
 * pueda pegar lo que tenga a mano (@usuario, la URL, un teléfono con espacios) y salga un
 * enlace que abre de verdad; que la landing las lea SIN sesión; y que una red vacía
 * desaparezca en vez de quedar como un ícono muerto.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const _ax = require('axios'); const axios = _ax.default || _ax;
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

const API = `http://127.0.0.1:${process.env.TEST_PORT || 3002}/api`;
let pass = 0, fail = 0, previo = null;
const ok = (c, l, e = '') => { c ? (pass++, console.log(`   ✅ ${l}`)) : (fail++, console.log(`   ❌ ${l} ${e}`)); };

(async () => {
  try {
    previo = await prisma.setting.findUnique({ where: { key: 'social_links' } });
    const admin = await prisma.user.findFirst({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } } });
    const bcrypt = require('bcryptjs');
    const hashPrevio = admin.passwordHash;
    const pwd = 'Prueba123';
    await prisma.user.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash(pwd, 12) } });
    const auth = { headers: { Authorization: `Bearer ${(await axios.post(`${API}/auth/login`, { email: admin.email, password: pwd })).data.data.token}` } };

    console.log('\n── 1. El admin pega lo que tiene a mano ──');
    const r = (await axios.put(`${API}/settings/redes`, {
      instagram: '@luxurygarage.py', facebook: 'https://facebook.com/luxurygarage', whatsapp: '0981 234 567',
    }, auth)).data;
    ok(r.data.instagram === 'https://instagram.com/luxurygarage.py', `@usuario → ${r.data.instagram}`);
    ok(r.data.facebook === 'https://facebook.com/luxurygarage', 'La URL completa se respeta');
    ok(r.data.whatsapp === 'https://wa.me/595981234567', `El teléfono → ${r.data.whatsapp}`);
    ok(!r.data.tiktok, 'La que no cargó no existe');

    console.log('\n── 2. La landing las lee sin sesión ──');
    const pub = (await axios.get(`${API}/settings/redes`)).data;
    ok(pub.success === true, 'Responde sin token');
    ok(Object.keys(pub.data).length === 3, `Devuelve las 3 cargadas: ${Object.keys(pub.data).join(', ')}`);

    console.log('\n── 3. Vaciar una la saca de la app ──');
    const r2 = (await axios.put(`${API}/settings/redes`, { instagram: '@luxurygarage.py', facebook: '', whatsapp: '0981 234 567' }, auth)).data;
    ok(!r2.data.facebook, 'Facebook desaparece al dejarlo vacío');
    ok(!!r2.data.instagram && !!r2.data.whatsapp, 'Las otras siguen');

    console.log('\n── 4. Basura no entra ──');
    try {
      await axios.put(`${API}/settings/redes`, { instagram: 'no válido !!' }, auth);
      ok(false, '⚠️ ACEPTÓ UN VALOR INVÁLIDO');
    } catch (e) { ok(e.response?.status === 400, `Rechazado: "${e.response?.data?.message}"`); }

    try {
      await axios.put(`${API}/settings/redes`, { instagram: '@x' }, { headers: {} });
      ok(false, '⚠️ DEJÓ CAMBIARLAS SIN SER ADMIN');
    } catch (e) { ok([401, 403].includes(e.response?.status), 'Sólo el admin puede cambiarlas'); }

    await prisma.user.update({ where: { id: admin.id }, data: { passwordHash: hashPrevio } });
  } catch (e) {
    console.error('\n💥', e.response?.data ? JSON.stringify(e.response.data).slice(0, 200) : e.message);
    fail++;
  } finally {
    // Se deja la configuración como estaba antes de la prueba.
    if (previo) await prisma.setting.update({ where: { key: 'social_links' }, data: { value: previo.value } });
    else await prisma.setting.deleteMany({ where: { key: 'social_links' } });
    ok(true, 'Limpieza: la configuración vuelve a como estaba');
  }
  console.log(`\n${'═'.repeat(58)}\n   RESULTADO: ${pass} pasaron · ${fail} fallaron`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})();
