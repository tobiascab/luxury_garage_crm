const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const logs = await prisma.auditLog.findMany({
    where: { entity: 'webhook' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.dir(logs, { depth: null });
}
main().finally(() => prisma.$disconnect());
