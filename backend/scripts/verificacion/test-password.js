#!/usr/bin/env node
/** Circuito completo de recuperación de contraseña contra el backend de producción. */
// Cargar el .env del backend ANTES de requerir el servicio de tokens: firma con JWT_SECRET,
// y sin esto el test usaría el secreto de respaldo y ninguna firma coincidiría con el server.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const _ax = require('axios');
const axios = _ax.default || _ax;
const bcrypt = require('bcryptjs');
const resetTokens = require('../../src/services/passwordResetTokens');

const API = 'http://127.0.0.1:3002/api';
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
let pass = 0, fail = 0, userId = null;
const ok = (c, l, e = '') => { c ? (pass++, console.log(`   ✅ ${l}`)) : (fail++, console.log(`   ❌ ${l} ${e}`)); };

(async () => {
  try {
    // El correo del dueño de la cuenta de Resend es el único al que se puede enviar hoy.
    const email = 'scinnovationspy@gmail.com';
    const pwdVieja = 'Vieja1234';
    const yaExiste = await prisma.user.findUnique({ where: { email } });
    if (yaExiste) { console.log('⚠️  Ese correo ya tiene cuenta; se aborta para no tocarla.'); process.exit(0); }

    const user = await prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(pwdVieja, 12), firstName: 'Tobías', lastName: 'Prueba', role: 'CLIENT' },
    });
    userId = user.id;

    console.log('\n── 1. Pide el enlace de recuperación ──');
    const r1 = await axios.post(`${API}/auth/forgot-password`, { email });
    ok(r1.data.success === true, `Responde: "${r1.data.message}"`);

    console.log('\n── 2. No revela si el correo existe ──');
    const r2 = await axios.post(`${API}/auth/forgot-password`, { email: 'noexiste-jamas@test.local' });
    ok(r2.data.message === r1.data.message, 'Un correo inexistente recibe la MISMA respuesta (no se puede sondear quién está registrado)');

    console.log('\n── 3. El enlace funciona ──');
    const fresh = await prisma.user.findUnique({ where: { id: userId } });
    const token = resetTokens.create(fresh, 'reset');
    const chk = await axios.get(`${API}/auth/reset-password/check?token=${encodeURIComponent(token)}`);
    ok(chk.data.success === true, `El enlace valida y saluda a ${chk.data.data?.firstName}`);

    console.log('\n── 4. Rechaza contraseñas débiles ──');
    for (const [p, motivo] of [['corta', 'menos de 8'], ['todominuscula1', 'sin mayúscula'], ['SinNumeros', 'sin número']]) {
      try {
        await axios.post(`${API}/auth/reset-password`, { token, newPassword: p });
        ok(false, `DEBERÍA rechazar "${p}" (${motivo})`);
      } catch (e) {
        ok(e.response?.status === 400, `Rechaza "${p}": ${e.response?.data?.message}`);
      }
    }

    console.log('\n── 5. Cambia la contraseña ──');
    const nueva = 'Nueva1234';
    const r5 = await axios.post(`${API}/auth/reset-password`, { token, newPassword: nueva });
    ok(r5.data.success === true, `"${r5.data.message}"`);

    console.log('\n── 6. La contraseña nueva funciona y la vieja no ──');
    const login = await axios.post(`${API}/auth/login`, { email, password: nueva });
    ok(login.data.success === true, 'Entra con la contraseña nueva');
    try {
      await axios.post(`${API}/auth/login`, { email, password: pwdVieja });
      ok(false, 'DEBERÍA rechazar la contraseña vieja');
    } catch (e) { ok(e.response?.status === 401 || e.response?.status === 400, 'La contraseña vieja ya no sirve'); }

    console.log('\n── 7. El enlace ya usado no se puede reutilizar ──');
    try {
      await axios.post(`${API}/auth/reset-password`, { token, newPassword: 'Otra12345' });
      ok(false, 'DEBERÍA rechazar el token ya usado');
    } catch (e) {
      ok(e.response?.status === 400, `Un enlace ya usado se rechaza: "${e.response?.data?.message}"`);
    }

    console.log('\n── 8. Un enlace manipulado se rechaza ──');
    const falso = token.slice(0, -4) + 'aaaa';
    try {
      await axios.get(`${API}/auth/reset-password/check?token=${encodeURIComponent(falso)}`);
      ok(false, 'DEBERÍA rechazar la firma inválida');
    } catch (e) { ok(e.response?.status === 400, 'Token con firma alterada rechazado'); }

    console.log('\n── 9. Enlace vencido ──');
    const userAhora = await prisma.user.findUnique({ where: { id: userId } });
    const viejo = `${userAhora.id}.${Date.now() - 2 * 60 * 60 * 1000}.x`;
    const v = resetTokens.verify(viejo, userAhora, 'reset');
    ok(v.ok === false, `Un enlace de hace 2 horas no vale (motivo: ${v.reason})`);

    console.log('\n── 10. El enlace de confirmar correo NO sirve para cambiar la contraseña ──');
    const userV = await prisma.user.findUnique({ where: { id: userId } });
    const tokenCorreo = resetTokens.create(userV, 'verify-email');
    try {
      await axios.post(`${API}/auth/reset-password`, { token: tokenCorreo, newPassword: 'Robada123' });
      ok(false, '⚠️ FALLA DE SEGURIDAD: el enlace de confirmación cambió la contraseña');
    } catch (e) {
      ok(e.response?.status === 400, 'El enlace de confirmación NO puede cambiar la contraseña (separados por propósito)');
    }
    const sigueEntrando = await axios.post(`${API}/auth/login`, { email, password: nueva });
    ok(sigueEntrando.data.success === true, 'La contraseña quedó intacta tras el intento');

    console.log('\n── 11. Confirmación de correo ──');
    const tk2 = resetTokens.create(await prisma.user.findUnique({ where: { id: userId } }), 'verify-email');
    const ver = await axios.get(`${API}/auth/verify-email?token=${encodeURIComponent(tk2)}`);
    ok(ver.data.success === true, `"${ver.data.message}"`);
    const verificado = await prisma.user.findUnique({ where: { id: userId } });
    ok(!!verificado.emailVerifiedAt, `Queda registrado en la ficha del cliente (${verificado.emailVerifiedAt?.toISOString().slice(0, 16)})`);

  } catch (e) {
    console.error('\n💥', e.response?.status || '', e.response?.data ? JSON.stringify(e.response.data).slice(0, 250) : e.message);
    fail++;
  } finally {
    if (userId) {
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
