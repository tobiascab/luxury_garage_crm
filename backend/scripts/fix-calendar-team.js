#!/usr/bin/env node
require('dotenv').config();
const arizar = require('../src/services/arizarService');

const USER_ID = '89e3yzXH69WZtVDlxrPt'; // Tobias Cabral Arteta
const CAL_ID = '0H4eHSKKDigbTAIuECww'; // Detailing Services

(async () => {
  // Fetch current calendar config
  const current = await arizar._safe(async () => {
    const r = await arizar.client.get(`/calendars/${CAL_ID}`);
    return r.data;
  });
  const cal = current?.calendar;
  if (!cal) { console.error('calendar no encontrado'); process.exit(1); }

  console.log(`Calendar actual: "${cal.name}", teamMembers: ${cal.teamMembers?.length || 0}`);
  console.log('groupId:', cal.groupId || '(none)');
  console.log('slotDuration:', cal.slotDuration, cal.slotDurationUnit);
  console.log('openHours:', JSON.stringify(cal.openHours || [], null, 2).slice(0, 200));

  // Construct updated payload — need to assign at least one teamMember with priority
  const updated = {
    teamMembers: [{
      userId: USER_ID,
      priority: 1,
      selected: true,
    }],
  };

  console.log('\nPATCHing /calendars/:id con teamMembers...');
  const res = await arizar._safe(async () => {
    const r = await arizar.client.put(`/calendars/${CAL_ID}`, updated);
    return r.data;
  });

  if (res) {
    console.log('✅ Calendario actualizado');
    console.log('teamMembers ahora:', JSON.stringify(res.calendar?.teamMembers, null, 2));
  }
})().catch(e => {
  console.error('FATAL:', e.response?.status, JSON.stringify(e.response?.data || e.message));
  process.exit(1);
});
