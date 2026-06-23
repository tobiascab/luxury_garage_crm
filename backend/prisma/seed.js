const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

// Contraseñas iniciales: NUNCA hardcodeadas (era un riesgo en producción: cuentas con clave conocida).
// Vienen de variables de entorno (SEED_*_PASSWORD); si faltan, se genera una aleatoria fuerte y se
// imprime UNA vez para que el operador la guarde.
function seedPassword(envVar, label) {
  const fromEnv = process.env[envVar];
  if (fromEnv && fromEnv.length >= 8) return fromEnv;
  const gen = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 14) + 'A9!';
  console.log(`🔑 ${label}: contraseña generada (GUARDALA, no se vuelve a mostrar): ${gen}`);
  return gen;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed de Luxury Garage...');

  // Super Admin
  const adminPassword = await bcrypt.hash(seedPassword('SEED_ADMIN_PASSWORD', 'admin@luxurygarage.com'), 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@luxurygarage.com' },
    update: {},
    create: { email: 'admin@luxurygarage.com', passwordHash: adminPassword, firstName: 'Super', lastName: 'Admin', role: 'SUPER_ADMIN', phone: '+595991000000' }
  });
  console.log('✅ Super Admin creado:', admin.email);

  // Employee demo
  const empPassword = await bcrypt.hash(seedPassword('SEED_EMPLOYEE_PASSWORD', 'lavador@luxurygarage.com'), 12);
  const employee = await prisma.user.upsert({
    where: { email: 'lavador@luxurygarage.com' },
    update: {},
    create: { email: 'lavador@luxurygarage.com', passwordHash: empPassword, firstName: 'Carlos', lastName: 'Lavador', role: 'EMPLOYEE', phone: '+595992000000' }
  });
  console.log('✅ Empleado demo creado:', employee.email);

  // Client demo
  const clientPassword = await bcrypt.hash(seedPassword('SEED_CLIENT_PASSWORD', 'cliente@luxurygarage.com'), 12);
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
      servicesIncluded: [{ slug: 'ducha-cera-carnauba', quota: 4, includedAddons: [] }] },
    { name: 'Plan Premium', slug: 'premium', description: 'Lavados Exteriores Ilimitados + 2 Full + Detailing', priceGs: 450000, discountPercent: 20, sortOrder: 2,
      features: ['Exteriores Completos ILIMITADOS', '2 Lavados Full/mes', '1 Detailing Express/mes', 'Tratamiento de Llantas', 'Agenda prioritaria', '20% descuento en extras', 'Referidos +1 lavado gratis'],
      limitsJson: { maxWashesPerMonth: -1, includesFull: 2, includesDetailing: 1 },
      servicesIncluded: [{ slug: 'ducha-cera-carnauba', quota: -1, includedAddons: ['parte_baja'] }, { slug: 'sellador-ceramico', quota: 1, includedAddons: [] }] },
    { name: 'Plan VIP', slug: 'vip', description: 'TODOS los servicios ILIMITADOS + A domicilio + 2 vehículos', priceGs: 750000, discountPercent: 30, sortOrder: 3,
      features: ['TODOS los servicios ILIMITADOS', '1 Detailing Premium/mes', '1 Coating/trimestre', 'Servicio a domicilio', 'Agenda VIP exclusiva', '30% en TODO extra', 'Soporte WhatsApp directo', 'Sala VIP', '2 vehículos incluidos', 'Reportes mensuales del vehículo'],
      limitsJson: { maxWashesPerMonth: -1, maxVehicles: 2, includesPickup: true },
      servicesIncluded: [{ slug: 'ducha-cera-carnauba', quota: -1, includedAddons: 'all' }, { slug: 'sellador-ceramico', quota: -1, includedAddons: 'all' }] },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({ where: { slug: p.slug }, update: p, create: p });
  }
  console.log('✅ 3 Planes creados: Básico, Premium, VIP');

  // Services — catálogo REAL (modo prueba). Precio por tamaño de vehículo + adicionales.
  // small=Auto pequeño · suv=Auto/SUV · truck=Camioneta · pickup=Pick-Up
  const services = [
    {
      name: 'Ducha, aspirado y cera carnauba', slug: 'ducha-cera-carnauba', category: 'standard',
      durationMinutes: 40, basePriceGs: 50000, icon: '🚿', sortOrder: 1,
      description: 'Lavado con ducha + aspirado interior + cera carnauba',
      pricingBySize: { small: 50000, suv: 60000, truck: 70000, pickup: 80000 },
      addons: [
        { key: 'parte_baja', name: 'Parte baja', priceGs: 20000 },
        { key: 'motor', name: 'Motor', priceGs: 50000 },
      ],
    },
    {
      name: 'Sellador cerámico', slug: 'sellador-ceramico', category: 'premium',
      durationMinutes: 120, basePriceGs: 120000, icon: '🛡️', sortOrder: 2,
      description: 'Aplicación de sellador cerámico de protección',
      pricingBySize: { small: 120000, suv: 150000, truck: 200000, pickup: 250000 },
      addons: [],
    },
  ];
  const activeSlugs = services.map((s) => s.slug);
  for (const s of services) {
    await prisma.service.upsert({ where: { slug: s.slug }, update: s, create: s });
  }
  // Desactivar cualquier servicio histórico que ya no se ofrece (no se borran por integridad referencial).
  const deactivated = await prisma.service.updateMany({
    where: { slug: { notIn: activeSlugs }, isActive: true },
    data: { isActive: false },
  });
  console.log(`✅ 2 servicios reales sembrados; ${deactivated.count} servicios viejos desactivados`);

  // Vehicle sizes — taxonomía configurable (carga inicial; luego editable desde la BD/admin)
  const vehicleSizes = [
    { key: 'small', label: 'Auto pequeño', sortOrder: 1 },
    { key: 'suv', label: 'Auto / SUV', sortOrder: 2 },
    { key: 'truck', label: 'Camioneta', sortOrder: 3 },
    { key: 'pickup', label: 'Pick-Up', sortOrder: 4 },
  ];
  for (const vs of vehicleSizes) {
    await prisma.vehicleSize.upsert({ where: { key: vs.key }, update: vs, create: vs });
  }
  console.log(`✅ ${vehicleSizes.length} tamaños de vehículo sembrados`);

  // Inventario: proveedor + insumos reales + recetas de consumo (ejemplos editables)
  const supplier = await prisma.supplier.upsert({
    where: { id: 'demo-supplier' },
    update: {},
    create: { id: 'demo-supplier', name: 'Distribuidora AutoClean', phone: '0981 000000', contact: 'Ventas' },
  });
  const invItems = [
    { id: 'inv-shampoo', name: 'Shampoo automotriz', sku: 'SHP-001', category: 'Químicos', unit: 'ml', currentStock: 5000, minStockAlert: 1000, maxStock: 8000, costPerUnit: 8 },
    { id: 'inv-cera', name: 'Cera carnauba', sku: 'CER-001', category: 'Químicos', unit: 'g', currentStock: 2000, minStockAlert: 300, maxStock: 3000, costPerUnit: 25 },
    { id: 'inv-sellador', name: 'Sellador cerámico', sku: 'SEL-001', category: 'Químicos', unit: 'ml', currentStock: 1000, minStockAlert: 200, maxStock: 1500, costPerUnit: 150 },
    { id: 'inv-microfibra', name: 'Microfibra', sku: 'MIC-001', category: 'Insumos', unit: 'unidad', currentStock: 100, minStockAlert: 20, maxStock: 150, costPerUnit: 12000 },
    { id: 'inv-descon', name: 'Descontaminante', sku: 'DES-001', category: 'Químicos', unit: 'ml', currentStock: 2000, minStockAlert: 400, maxStock: 3000, costPerUnit: 20 },
  ];
  for (const it of invItems) {
    await prisma.inventoryItem.upsert({ where: { id: it.id }, update: {}, create: { ...it, supplierId: supplier.id } });
  }
  const duchaSvc = await prisma.service.findUnique({ where: { slug: 'ducha-cera-carnauba' } });
  const selladorSvc = await prisma.service.findUnique({ where: { slug: 'sellador-ceramico' } });
  const recipes = [];
  if (duchaSvc) recipes.push(
    { serviceId: duchaSvc.id, itemId: 'inv-shampoo', vehicleSize: null, quantity: 100 },
    { serviceId: duchaSvc.id, itemId: 'inv-cera', vehicleSize: null, quantity: 40 },
    { serviceId: duchaSvc.id, itemId: 'inv-microfibra', vehicleSize: null, quantity: 2 },
  );
  if (selladorSvc) recipes.push(
    { serviceId: selladorSvc.id, itemId: 'inv-sellador', vehicleSize: null, quantity: 20 },
    { serviceId: selladorSvc.id, itemId: 'inv-descon', vehicleSize: null, quantity: 30 },
    { serviceId: selladorSvc.id, itemId: 'inv-microfibra', vehicleSize: null, quantity: 2 },
  );
  for (const r of recipes) {
    const existing = await prisma.serviceConsumption.findFirst({ where: { serviceId: r.serviceId, itemId: r.itemId, vehicleSize: r.vehicleSize } });
    if (existing) await prisma.serviceConsumption.update({ where: { id: existing.id }, data: { quantity: r.quantity } });
    else await prisma.serviceConsumption.create({ data: r });
  }
  console.log(`✅ Inventario: 1 proveedor, ${invItems.length} insumos, ${recipes.length} recetas`);

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

  // Plan de cuentas base (partida doble). Idempotente vía upsert por code (@unique).
  const accounts = [
    { code: '1.1.01', name: 'Caja/Banco', type: 'asset' },
    { code: '1.1.02', name: 'IVA Crédito Fiscal', type: 'asset' },
    { code: '2.1.01', name: 'IVA Débito Fiscal', type: 'liability' },
    { code: '4.1.01', name: 'Ingresos Membresías', type: 'income' },
    { code: '4.1.02', name: 'Ingresos Servicios', type: 'income' },
    { code: '4.1.03', name: 'Ingresos Billetera', type: 'income' },
    { code: '5.1.01', name: 'Gastos Operativos', type: 'expense' },
  ];
  for (const a of accounts) {
    await prisma.account.upsert({
      where: { code: a.code },
      update: { name: a.name, type: a.type },
      create: a,
    });
  }
  console.log('✅ Plan de cuentas base creado');

  console.log('\n🚗 ¡Seed completado! Credenciales:');
  console.log('   Admin:    admin@luxurygarage.com');
  console.log('   Empleado: lavador@luxurygarage.com');
  console.log('   Cliente:  cliente@luxurygarage.com');
  console.log('   (contraseñas: las de SEED_*_PASSWORD o las aleatorias impresas arriba en este seed)');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
