const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed de Luxury Garage...');

  // Super Admin
  const adminPassword = await bcrypt.hash('LuxuryAdmin2026!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@luxurygarage.com' },
    update: {},
    create: { email: 'admin@luxurygarage.com', passwordHash: adminPassword, firstName: 'Super', lastName: 'Admin', role: 'SUPER_ADMIN', phone: '+595991000000' }
  });
  console.log('✅ Super Admin creado:', admin.email);

  // Employee demo
  const empPassword = await bcrypt.hash('Empleado2026!', 12);
  const employee = await prisma.user.upsert({
    where: { email: 'lavador@luxurygarage.com' },
    update: {},
    create: { email: 'lavador@luxurygarage.com', passwordHash: empPassword, firstName: 'Carlos', lastName: 'Lavador', role: 'EMPLOYEE', phone: '+595992000000' }
  });
  console.log('✅ Empleado demo creado:', employee.email);

  // Client demo
  const clientPassword = await bcrypt.hash('Cliente2026!', 12);
  const client = await prisma.user.upsert({
    where: { email: 'cliente@luxurygarage.com' },
    update: {},
    create: { email: 'cliente@luxurygarage.com', passwordHash: clientPassword, firstName: 'María', lastName: 'González', role: 'CLIENT', phone: '+595993000000' }
  });
  console.log('✅ Cliente demo creado:', client.email);

  // Plans
  const plans = [
    { name: 'Plan Básico', slug: 'basico', description: '4 Lavados Express + 1 Interior al mes', priceGs: 250000, discountPercent: 10, sortOrder: 1,
      features: ['4 Lavados Exterior Express/mes', '1 Lavado Interior/mes', 'Agendamiento digital', 'Historial digital', '10% descuento en extras'],
      limitsJson: { maxWashesPerMonth: 5, includesInterior: 1, includesExterior: 4 },
      servicesIncluded: ['lavado-exterior-express', 'lavado-interior'] },
    { name: 'Plan Premium', slug: 'premium', description: 'Lavados Exteriores Ilimitados + 2 Full + Detailing', priceGs: 450000, discountPercent: 20, sortOrder: 2,
      features: ['Exteriores Completos ILIMITADOS', '2 Lavados Full/mes', '1 Detailing Express/mes', 'Tratamiento de Llantas', 'Agenda prioritaria', '20% descuento en extras', 'Referidos +1 lavado gratis'],
      limitsJson: { maxWashesPerMonth: -1, includesFull: 2, includesDetailing: 1 },
      servicesIncluded: ['lavado-exterior-completo', 'lavado-full', 'detailing-express', 'tratamiento-llantas'] },
    { name: 'Plan VIP', slug: 'vip', description: 'TODOS los servicios ILIMITADOS + A domicilio + 2 vehículos', priceGs: 750000, discountPercent: 30, sortOrder: 3,
      features: ['TODOS los servicios ILIMITADOS', '1 Detailing Premium/mes', '1 Coating/trimestre', 'Servicio a domicilio', 'Agenda VIP exclusiva', '30% en TODO extra', 'Soporte WhatsApp directo', 'Sala VIP', '2 vehículos incluidos', 'Reportes mensuales del vehículo'],
      limitsJson: { maxWashesPerMonth: -1, maxVehicles: 2, includesPickup: true },
      servicesIncluded: ['all'] },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({ where: { slug: p.slug }, update: p, create: p });
  }
  console.log('✅ 3 Planes creados: Básico, Premium, VIP');

  // Services
  const services = [
    { name: 'Lavado Exterior Express', slug: 'lavado-exterior-express', category: 'standard', durationMinutes: 20, basePriceGs: 50000, icon: '🚿', sortOrder: 1, description: 'Agua a presión + jabón + enjuague + secado' },
    { name: 'Lavado Exterior Completo', slug: 'lavado-exterior-completo', category: 'standard', durationMinutes: 40, basePriceGs: 80000, icon: '🧽', sortOrder: 2, description: 'Express + descontaminación + cera rápida + llantas' },
    { name: 'Lavado Interior', slug: 'lavado-interior', category: 'standard', durationMinutes: 45, basePriceGs: 70000, icon: '🪣', sortOrder: 3, description: 'Aspirado + tablero + vidrios + pisos + asientos' },
    { name: 'Lavado Full', slug: 'lavado-full', category: 'standard', durationMinutes: 80, basePriceGs: 130000, icon: '✨', sortOrder: 4, description: 'Interior + Exterior completo' },
    { name: 'Detailing Express', slug: 'detailing-express', category: 'premium', durationMinutes: 120, basePriceGs: 200000, icon: '💎', sortOrder: 5, description: 'Full + pulido + abrillantado' },
    { name: 'Tratamiento de Llantas', slug: 'tratamiento-llantas', category: 'premium', durationMinutes: 30, basePriceGs: 50000, icon: '🛞', sortOrder: 6, description: 'Limpieza profunda + acondicionamiento + brillo' },
    { name: 'Tratamiento de Vidrios', slug: 'tratamiento-vidrios', category: 'premium', durationMinutes: 30, basePriceGs: 60000, icon: '🪟', sortOrder: 7, description: 'Anti-lluvia hidrofóbico en todos los vidrios' },
    { name: 'Detailing Premium Completo', slug: 'detailing-premium', category: 'vip', durationMinutes: 240, basePriceGs: 400000, icon: '🏆', sortOrder: 8, description: 'Descontaminación + corrección + sellador + cuero + motor' },
    { name: 'Coating Cerámico', slug: 'coating-ceramico', category: 'vip', durationMinutes: 360, basePriceGs: 800000, icon: '🛡️', sortOrder: 9, description: 'Protección cerámica profesional de larga duración' },
    { name: 'Restauración de Ópticas', slug: 'restauracion-opticas', category: 'vip', durationMinutes: 45, basePriceGs: 100000, icon: '💡', sortOrder: 10, description: 'Pulido y sellado de faros' },
    // Addons
    { name: 'Eliminación de Olores', slug: 'eliminacion-olores', category: 'addon', durationMinutes: 60, basePriceGs: 80000, icon: '🌸', sortOrder: 20, isAddon: true, description: 'Tratamiento con ozono' },
    { name: 'Limpieza para Mascotas', slug: 'limpieza-mascotas', category: 'addon', durationMinutes: 45, basePriceGs: 60000, icon: '🐕', sortOrder: 21, isAddon: true, description: 'Limpieza especializada de pelos y olores' },
    { name: 'Limpieza de Motor', slug: 'limpieza-motor', category: 'addon', durationMinutes: 45, basePriceGs: 90000, icon: '⚙️', sortOrder: 22, isAddon: true, description: 'Limpieza profunda del motor' },
    { name: 'Lavado de Tapizados', slug: 'lavado-tapizados', category: 'addon', durationMinutes: 90, basePriceGs: 120000, icon: '🪑', sortOrder: 23, isAddon: true, description: 'Limpieza profunda de tapizados tela/cuero' },
  ];
  for (const s of services) {
    await prisma.service.upsert({ where: { slug: s.slug }, update: s, create: s });
  }
  console.log('✅ 14 Servicios creados (4 estándar + 3 premium + 3 VIP + 4 addons)');

  // Membership for demo client
  const basicPlan = await prisma.plan.findUnique({ where: { slug: 'premium' } });
  if (basicPlan) {
    const start = new Date();
    const end = new Date(); end.setMonth(end.getMonth() + 1);
    await prisma.membership.upsert({
      where: { id: 'demo-membership' },
      update: { startDate: start, endDate: end },
      create: { id: 'demo-membership', userId: client.id, planId: basicPlan.id, status: 'ACTIVE', startDate: start, endDate: end }
    });
    console.log('✅ Membresía Premium asignada al cliente demo');
  }

  // Demo vehicle
  await prisma.vehicle.upsert({
    where: { id: 'demo-vehicle' },
    update: {},
    create: { id: 'demo-vehicle', userId: client.id, brand: 'Toyota', model: 'Hilux', year: 2024, color: 'Blanco', licensePlate: 'ABC-1234', isPrimary: true }
  });
  console.log('✅ Vehículo demo creado: Toyota Hilux ABC-1234');

  // Settings
  await prisma.setting.upsert({
    where: { key: 'business_info' },
    update: {},
    create: { key: 'business_info', value: { name: 'Luxury Garage', phone: '+595991000000', address: 'Asunción, Paraguay', openHours: 'Lun-Sáb 07:00-18:00', bays: 3, timezone: 'America/Asuncion' } }
  });
  console.log('✅ Configuración del negocio creada');

  console.log('\n🚗 ¡Seed completado! Credenciales:');
  console.log('   Admin:    admin@luxurygarage.com / LuxuryAdmin2026!');
  console.log('   Empleado: lavador@luxurygarage.com / Empleado2026!');
  console.log('   Cliente:  cliente@luxurygarage.com / Cliente2026!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
