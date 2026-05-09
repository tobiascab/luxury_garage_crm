#!/usr/bin/env node
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const [users, usersWithArizar, apts, aptsWithArizar, logs, credits, payments, activeMem] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { arizarContactId: { not: null } } }),
    prisma.appointment.count(),
    prisma.appointment.count({ where: { arizarAppointmentId: { not: null } } }),
    prisma.auditLog.count(),
    prisma.credit.count(),
    prisma.payment.count(),
    prisma.membership.count({ where: { status: 'ACTIVE' } }),
  ]);

  console.log('users         :', users, '  (w/arizar:', usersWithArizar, ')');
  console.log('appointments  :', apts, ' (w/arizar:', aptsWithArizar, ')');
  console.log('audit_logs    :', logs);
  console.log('credits       :', credits);
  console.log('payments      :', payments);
  console.log('active memb.  :', activeMem);

  const lastLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' }, take: 5,
    select: { action: true, entity: true, detailsJson: true, createdAt: true },
  });
  console.log('\n--- últimos 5 audit logs ---');
  for (const l of lastLogs) {
    console.log(`${l.createdAt.toISOString()}  ${l.action}/${l.entity}  details=${l.detailsJson ? 'OK' : 'NULL'}`);
  }

  await prisma.$disconnect();
  await pool.end();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
