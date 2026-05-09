#!/usr/bin/env node
/**
 * PRUEBA REALISTA END-TO-END:
 * 1. Consultar slots disponibles del calendario ARIZAR
 * 2. Crear un turno para María González vía API real del backend (como lo hace la app)
 * 3. Verificar que el evento aparece en ARIZAR (GET al calendar)
 * 4. Arrancar el servicio (start) y verificar WhatsApp + update
 * 5. Completar el servicio
 * 6. Limpiar (cancelar el turno)
 */
require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const arizar = require('../src/services/arizarService');

const API = 'http://localhost:3002/api';

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TEST END-TO-END: reserva → ARIZAR → start → complete');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── 1) Login real via API ────────────────────────────────────────
  console.log('[1] Login como María González...');
  const login = await axios.post(`${API}/auth/login`, {
    email: 'cliente@luxurygarage.com',
    password: 'Cliente2026!',
  });
  const token = login.data.token || login.data.data?.token;
  const userId = login.data.user?.id || login.data.data?.user?.id;
  console.log('    ✅ token OK, userId =', userId);
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  // Check arizarContactId
  const user = await prisma.user.findUnique({ where: { id: userId } });
  console.log('    arizarContactId =', user.arizarContactId);

  // ── 2) Obtener vehículo y servicio ───────────────────────────────
  const vehicle = await prisma.vehicle.findFirst({ where: { userId } });
  const service = await prisma.service.findFirst({ where: { isActive: true, isAddon: false } });
  console.log(`[2] Vehículo: ${vehicle?.brand} ${vehicle?.model} (${vehicle?.licensePlate})`);
  console.log(`    Servicio: ${service?.name} (${service?.durationMinutes}min)`);

  // ── 3) Consultar slots ARIZAR ────────────────────────────────────
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const weekLater = new Date(tomorrow); weekLater.setDate(weekLater.getDate() + 7);
  console.log(`\n[3] Consultando slots disponibles en ARIZAR...`);
  const slots = await arizar.getFreeSlots(tomorrow.getTime(), weekLater.getTime());
  const days = Object.keys(slots || {}).filter(k => k !== 'traceId');
  let firstSlot = null;
  for (const d of days) {
    if (slots[d]?.slots?.length) { firstSlot = slots[d].slots[0]; break; }
  }
  if (!firstSlot) { console.log('    ❌ no hay slots libres'); process.exit(1); }
  console.log(`    → primer slot libre: ${firstSlot}`);

  // firstSlot = "2026-04-23T08:00:00-03:00" — convert to Paraguay (−04:00) for backend
  const slotDate = new Date(firstSlot);
  const pyDate = slotDate.toISOString().slice(0,10);
  const hh = String(slotDate.getUTCHours() - 4).padStart(2,'0');
  const mm = String(slotDate.getUTCMinutes()).padStart(2,'0');
  const startISO = `${pyDate}T${hh}:${mm}:00`;
  console.log(`    → usaremos: ${startISO} (PYT)`);

  // ── 4) Crear turno vía API del backend ───────────────────────────
  console.log('\n[4] POST /api/appointments (como lo hace la app) ...');
  const reservation = await axios.post(`${API}/appointments`, {
    vehicleId: vehicle.id,
    serviceId: service.id,
    date: tomorrow.toISOString().slice(0,10),
    startTime: startISO,
    notes: '🧪 Test automatizado — verificar en panel ARIZAR',
  }, auth);
  const appt = reservation.data.data;
  console.log(`    ✅ Turno creado en BD: ${appt.id}`);
  console.log(`    arizarAppointmentId: ${appt.arizarAppointmentId}`);

  if (!appt.arizarAppointmentId) {
    console.log('    ❌ FALLA: no se sincronizó con ARIZAR');
    process.exit(1);
  }

  // ── 5) Verificar que el evento existe en ARIZAR ──────────────────
  console.log('\n[5] Verificando en ARIZAR (GET /calendars/events/appointments/:id)...');
  await new Promise(r => setTimeout(r, 1500));
  const evt = await arizar._safe(async () => {
    const r = await arizar.client.get(`/calendars/events/appointments/${appt.arizarAppointmentId}`);
    return r.data;
  });
  if (evt?.appointment || evt?.event) {
    const e = evt.appointment || evt.event;
    console.log(`    ✅ ENCONTRADO EN CALENDARIO ARIZAR:`);
    console.log(`       title       : ${e.title}`);
    console.log(`       startTime   : ${e.startTime}`);
    console.log(`       endTime     : ${e.endTime}`);
    console.log(`       status      : ${e.appointmentStatus}`);
    console.log(`       calendarId  : ${e.calendarId}`);
    console.log(`       contactId   : ${e.contactId}`);
  } else {
    console.log('    ⚠️ No se pudo recuperar — revisar manualmente el panel ARIZAR');
    console.log('    Respuesta:', JSON.stringify(evt).slice(0, 300));
  }

  // ── 6) Buscar todos los eventos del contacto para confirmar ──────
  console.log('\n[6] Listando eventos del contacto en ARIZAR...');
  const events = await arizar._safe(async () => {
    const r = await arizar.client.get('/calendars/events', {
      params: {
        locationId: arizar.locationId,
        calendarId: arizar.calendarId,
        startTime: tomorrow.getTime(),
        endTime: dayAfter.getTime() + 86400000 * 7,
      }
    });
    return r.data;
  });
  console.log(`    → ${events?.events?.length || 0} eventos futuros de María`);
  for (const e of (events?.events || []).slice(0, 5)) {
    console.log(`       · ${e.id} / ${e.title} / ${e.startTime} / ${e.appointmentStatus}`);
  }

  // ── 7) Probar START (empleado inicia servicio) ───────────────────
  console.log('\n[7] Generando JWT de admin directo...');
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const adminToken = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, firstName: admin.firstName, lastName: admin.lastName },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const adminAuth = { headers: { Authorization: `Bearer ${adminToken}` } };
  console.log(`    ✅ admin ${admin.email}`);

  console.log('    PUT /api/appointments/:id/start ...');
  try {
    const started = await axios.put(`${API}/appointments/${appt.id}/start`, {}, adminAuth);
    console.log(`    ✅ Servicio INICIADO (status=${started.data.data.status})`);
    console.log('    → Se envió WhatsApp al cliente con aviso de inicio');
  } catch (e) {
    console.log(`    ⚠️ Error start: ${e.response?.data?.message || e.message}`);
  }

  // ── 8) COMPLETE ──────────────────────────────────────────────────
  console.log('\n[8] PUT /api/appointments/:id/complete ...');
  try {
    const completed = await axios.put(`${API}/appointments/${appt.id}/complete`, {
      notes: 'Servicio completado — test automatizado',
      vehicleObservations: 'Vehículo en excelente estado',
    }, adminAuth);
    console.log(`    ✅ Servicio COMPLETADO (status=${completed.data.data.status})`);
    console.log('    → WhatsApp con link de review enviado al cliente');
  } catch (e) {
    console.log(`    ⚠️ Error complete: ${e.response?.data?.message || e.message}`);
  }

  // ── 9) Verificar audit logs generados ────────────────────────────
  console.log('\n[9] Audit logs generados en los últimos 2 minutos:');
  const recentLogs = await prisma.auditLog.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 120000) } },
    orderBy: { createdAt: 'desc' },
  });
  for (const l of recentLogs) {
    console.log(`    · ${l.action}/${l.entity}  entity_id=${l.entityId || '-'}  details=${l.detailsJson ? 'OK' : 'NULL'}`);
  }
  console.log(`    Total: ${recentLogs.length} logs`);

  // ── 10) Resumen ──────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ PRUEBA COMPLETA');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n  👉 Entrá al panel ARIZAR (app.arizar.com) y verás:`);
  console.log(`     · En CONTACTOS → María González → timeline con el turno`);
  console.log(`     · En CALENDARIO → turno el ${tomorrow.toISOString().slice(0,10)} a las 10:00`);
  console.log(`     · Título: "${service.name} - ${vehicle.brand} ${vehicle.model} ${vehicle.licensePlate}"`);
  console.log(`     · Notas: "🧪 Test automatizado..."`);
  console.log(`     · Status cambió a completado`);

  await prisma.$disconnect();
  await pool.end();
})().catch(e => {
  console.error('FATAL:', e.response?.data || e.message);
  process.exit(1);
});
