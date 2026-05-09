#!/usr/bin/env node
require('dotenv').config();
const arizar = require('../src/services/arizarService');

(async () => {
  console.log('Calendar ID configurado:', arizar.calendarId);
  console.log('Location ID:', arizar.locationId);

  // Get calendar info
  const cal = await arizar._safe(async () => {
    const r = await arizar.client.get(`/calendars/${arizar.calendarId}`);
    return r.data;
  });
  console.log('\n--- Calendar info ---');
  console.log(JSON.stringify(cal, null, 2));

  // List all calendars for this location
  console.log('\n--- Calendars disponibles en la location ---');
  const calendars = await arizar._safe(async () => {
    const r = await arizar.client.get('/calendars/', { params: { locationId: arizar.locationId } });
    return r.data;
  });
  for (const c of (calendars?.calendars || [])) {
    console.log(`  · ${c.id}  "${c.name}"  teamMembers=${c.teamMembers?.length || 0}  active=${c.isActive}`);
  }

  // List users of the location
  console.log('\n--- Users asignables ---');
  const users = await arizar._safe(async () => {
    const r = await arizar.client.get('/users/', { params: { locationId: arizar.locationId } });
    return r.data;
  });
  for (const u of (users?.users || []).slice(0, 10)) {
    console.log(`  · ${u.id}  ${u.firstName} ${u.lastName}  ${u.email}`);
  }
})().catch(e => { console.error('FATAL:', e.response?.data || e.message); process.exit(1); });
