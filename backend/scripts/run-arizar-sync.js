#!/usr/bin/env node
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const ArizarSync = require('../src/services/arizarSync');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const sync = new ArizarSync(prisma);

  console.log('=== Bulk sync (CLIENT role) ===');
  const clientResult = await sync.bulkSyncAllUsers();
  console.log('CLIENT result:', clientResult);

  console.log('\n=== Sync non-CLIENT (admin/lavador) ===');
  const staff = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN', 'EMPLOYEE'] } },
    include: { memberships: { where: { status: 'ACTIVE' }, include: { plan: true }, take: 1 } },
  });

  const arizarService = require('../src/services/arizarService');
  for (const u of staff) {
    try {
      const res = await arizarService.upsertContact({
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        tags: ['luxury-garage', `role-${u.role.toLowerCase()}`, 'staff'],
        source: 'staff-sync',
      });
      const contactId = res?.contact?.id || res?.contactId;
      if (contactId && !u.arizarContactId) {
        await prisma.user.update({ where: { id: u.id }, data: { arizarContactId: contactId } });
      }
      console.log(`✅ ${u.email} (${u.role}) → ${contactId || 'sin id'}`);
    } catch (e) {
      console.error(`❌ ${u.email}: ${e.response?.data?.message || e.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n=== Estado final ===');
  const stats = await sync.getSyncStats();
  console.log(JSON.stringify(stats, null, 2));

  await prisma.$disconnect();
})();
