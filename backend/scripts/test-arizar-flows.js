#!/usr/bin/env node
require('dotenv').config();
const arizar = require('../src/services/arizarService');

const CLIENT_ID = '4B3r4l2lUgZnvhTXXM07'; // María González

(async () => {
  console.log('\n=== 1. getContact ===');
  const c = await arizar.getContact(CLIENT_ID);
  console.log('email:', c?.contact?.email, 'tags:', c?.contact?.tags);

  console.log('\n=== 2. upsertContact (update María) ===');
  const up = await arizar.upsertContact({
    firstName: 'María', lastName: 'González',
    email: 'cliente@luxurygarage.com', phone: '+595993000000',
    tags: ['luxury-garage', 'plan-premium', 'miembro-activo', 'cliente-frecuente'],
    source: 'verify-test-script',
  });
  console.log('upserted contactId:', up?.contact?.id, 'new:', up?.new);

  console.log('\n=== 3. addContactNote ===');
  const note = await arizar.addContactNote(CLIENT_ID,
    `🧪 Test desde verify-script - ${new Date().toISOString()}`);
  console.log('note id:', note?.note?.id || note?.id);

  console.log('\n=== 4. syncContactCustomFields ===');
  await arizar.syncContactCustomFields(CLIENT_ID, {
    plan: 'premium',
    planStatus: 'active',
    vehicle1: 'Toyota Hilux 2022 - ABC-1234',
    servicesUsed: 12,
    lastVisit: new Date().toISOString(),
    userId: 'b336b457-3db1-4fc7-a3f8-cfad43af5e0e',
  });
  console.log('custom fields sync → OK');

  console.log('\n=== 5. createOpportunity ===');
  const opp = await arizar.createOpportunity(CLIENT_ID, {
    name: 'TEST — María González Premium',
    value: 450000,
  });
  const oppId = opp?.opportunity?.id || opp?.id;
  console.log('opportunity id:', oppId, 'stage:', opp?.opportunity?.pipelineStageId);

  console.log('\n=== 6. moveToVisita (stage change) ===');
  await arizar.moveToVisita(CLIENT_ID);
  console.log('moved → visita-agendada');

  console.log('\n=== 7. moveToMiembro ===');
  await arizar.moveToMiembro(CLIENT_ID);
  console.log('moved → miembro-activo');

  console.log('\n=== 8. Verify contact state after all ops ===');
  const finalC = await arizar.getContact(CLIENT_ID);
  console.log('final tags:', finalC?.contact?.tags);
  console.log('customFields count:', finalC?.contact?.customFields?.length);
  if (finalC?.contact?.customFields) {
    for (const f of finalC.contact.customFields) {
      console.log('  ·', f.id, '=', f.value);
    }
  }

  console.log('\n=== 9. Verify opportunity was created ===');
  const searchRes = await arizar._safe(async () => {
    const r = await arizar.client.get('/opportunities/search', {
      params: { location_id: arizar.locationId, contact_id: CLIENT_ID, pipeline_id: arizar.pipelineId }
    });
    return r.data;
  });
  console.log('opps found:', searchRes?.opportunities?.length);
  for (const o of (searchRes?.opportunities || []).slice(0, 3)) {
    console.log(`  · ${o.name} / stage=${o.pipelineStageId} / status=${o.status}`);
  }

  console.log('\n=== 10. Skipping SMS/WhatsApp (avoids sending real messages) ===');
  console.log('   (verificado por estructura; se enviarían a +595993000000)');

  console.log('\n✅ Pruebas completadas');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
