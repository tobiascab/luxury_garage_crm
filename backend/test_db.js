const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const apps = await prisma.appointment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3
    });
    console.log(JSON.stringify(apps, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
