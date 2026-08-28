#!/usr/bin/env node
/**
 * Carga un catálogo de PRUEBA en la tienda (bebidas, snacks y accesorios) con fotos reales,
 * para poder testear el flujo de compra sin esperar a que se cargue el catálogo de verdad.
 *
 *   node scripts/seed-productos-demo.js            → carga los productos
 *   node scripts/seed-productos-demo.js --limpiar  → los borra todos
 *
 * Todos llevan `sku` con prefijo DEMO-, que es lo que permite borrarlos después sin tocar ni
 * un solo producto real. Las fotos salen de Wikimedia Commons (licencia libre): son fotos de
 * producto de verdad y, a diferencia de las de una búsqueda de imágenes cualquiera, se pueden
 * usar sin quedarse con material con derechos de terceros en un catálogo comercial.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ilustracion } = require('./lib/ilustracionProducto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
const DESTINO = path.join(__dirname, '../uploads/productos');
const UA = 'LuxuryGarageCRM/1.0 (catalogo de prueba; contacto: admin@luxurygarage.com)';

// Precios de mostrador de Paraguay, redondeados como se cobra en la práctica.
const PRODUCTOS = [
  { sku: 'DEMO-COCA-500',   name: 'Coca-Cola 500 ml',       brand: 'Coca-Cola',    cat: 'Bebidas',    precio: 8000,  costo: 5000,  stock: 48, arte: ['botella',   { color: '#e01b24', liquido: '#3b1a12', texto: 'Coca-Cola', marca: 'Original' }] },
  { sku: 'DEMO-AGUA-500',   name: 'Agua mineral 500 ml',    brand: 'Pureza',       cat: 'Bebidas',    precio: 5000,  costo: 2500,  stock: 60, arte: ['agua',      { color: '#0ea5e9', texto: 'Agua', marca: '500 ml' }] },
  { sku: 'DEMO-SPRITE',     name: 'Sprite lata 350 ml',     brand: 'Sprite',       cat: 'Bebidas',    precio: 7000,  costo: 4500,  stock: 36, arte: ['lata',      { color: '#16a34a', texto: 'Sprite', marca: 'lima limón' }] },
  { sku: 'DEMO-PEPSI',      name: 'Pepsi 500 ml',           brand: 'Pepsi',        cat: 'Bebidas',    precio: 7500,  costo: 4500,  stock: 30, arte: ['botella',   { color: '#1d4ed8', liquido: '#2c1810', texto: 'Pepsi', marca: 'cola' }] },
  { sku: 'DEMO-GATORADE',   name: 'Gatorade 500 ml',        brand: 'Gatorade',     cat: 'Bebidas',    precio: 12000, costo: 8000,  stock: 24, arte: ['deportiva', { color: '#ea580c', texto: 'Gatorade', marca: 'sport' }] },
  { sku: 'DEMO-REDBULL',    name: 'Red Bull 250 ml',        brand: 'Red Bull',     cat: 'Bebidas',    precio: 18000, costo: 12000, stock: 18, arte: ['lata',      { color: '#1e3a8a', texto: 'Red Bull', marca: 'energizante' }] },
  { sku: 'DEMO-JUGO',       name: 'Jugo de naranja 1 L',    brand: 'Watts',        cat: 'Bebidas',    precio: 11000, costo: 7000,  stock: 20, arte: ['carton',    { color: '#f59e0b', texto: 'Naranja', marca: '1 litro' }] },
  { sku: 'DEMO-CAFE',       name: 'Café expreso',           brand: null,           cat: 'Bebidas',    precio: 10000, costo: 3000,  stock: 99, arte: ['taza',      {}] },
  { sku: 'DEMO-PAPAS',      name: 'Papas fritas 100 g',     brand: "Lay's",        cat: 'Snacks',     precio: 9000,  costo: 6000,  stock: 28, arte: ['bolsa',     { color: '#eab308', texto: 'Papas', marca: 'clásicas' }] },
  { sku: 'DEMO-OREO',       name: 'Galletitas Oreo',        brand: 'Oreo',         cat: 'Snacks',     precio: 7000,  costo: 4500,  stock: 32, arte: ['paquete',   { color: '#1e40af', texto: 'Oreo', marca: 'galletitas' }] },
  { sku: 'DEMO-CHOCO',      name: 'Chocolate con leche',    brand: 'Milka',        cat: 'Snacks',     precio: 8500,  costo: 5500,  stock: 25, arte: ['tableta',   { color: '#7e22ce', texto: 'Chocolate', marca: 'con leche' }] },
  { sku: 'DEMO-MANI',       name: 'Maní salado 80 g',       brand: null,           cat: 'Snacks',     precio: 6000,  costo: 3500,  stock: 40, arte: ['bolsa',     { color: '#b45309', texto: 'Maní', marca: 'salado' }] },
  { sku: 'DEMO-AROMA',      name: 'Aromatizante para auto', brand: 'Little Trees', cat: 'Accesorios', precio: 25000, costo: 15000, stock: 15, arte: ['arbolito',  { color: '#15803d', texto: 'AUTO' }] },
  { sku: 'DEMO-MICROFIBRA', name: 'Paño de microfibra',     brand: null,           cat: 'Accesorios', precio: 35000, costo: 20000, stock: 12, arte: ['pano',      { color: '#0f2b80', texto: 'MICROFIBRA' }] },
];


async function limpiar() {
  const demo = await prisma.inventoryItem.findMany({ where: { sku: { startsWith: 'DEMO-' } } });
  console.log(`\n  Borrando ${demo.length} producto(s) de prueba...`);
  for (const p of demo) {
    // Si alguno se llegó a vender, se deja: borrarlo rompería el historial de esa venta.
    const vendido = await prisma.orderItem.count({ where: { itemId: p.id } });
    if (vendido) {
      await prisma.inventoryItem.update({ where: { id: p.id }, data: { isForSale: false, isActive: false } });
      console.log(`   ~ ${p.name}: tiene ventas, se oculta en vez de borrarse`);
      continue;
    }
    if (p.imageUrl?.startsWith('/uploads/productos/')) {
      fs.promises.unlink(path.join(__dirname, '..', p.imageUrl)).catch(() => {});
    }
    await prisma.stockMovement.deleteMany({ where: { itemId: p.id } });
    await prisma.inventoryItem.delete({ where: { id: p.id } });
    console.log(`   − ${p.name}`);
  }
}

(async () => {
  if (process.argv.includes('--limpiar')) {
    await limpiar();
    await prisma.$disconnect();
    return;
  }

  fs.mkdirSync(DESTINO, { recursive: true });
  console.log(`\n  Cargando ${PRODUCTOS.length} productos de prueba en la tienda\n`);
  let creados = 0, actualizados = 0;

  for (const p of PRODUCTOS) {
    const existente = await prisma.inventoryItem.findUnique({ where: { sku: p.sku } });

    // La ilustración se regenera siempre: así un cambio de estilo se refleja en todo el catálogo.
    const archivo = `${p.sku.toLowerCase()}.svg`;
    fs.writeFileSync(path.join(DESTINO, archivo), ilustracion(p.arte[0], p.arte[1]));
    const imageUrl = `/uploads/productos/${archivo}`;

    const datos = {
      name: p.name, brand: p.brand, category: p.cat.toUpperCase(), unit: 'unidad',
      minStockAlert: 5, costPerUnit: p.costo, isActive: true,
      isForSale: true, salePriceGs: p.precio, saleCategory: p.cat, imageUrl,
    };

    if (existente) {
      await prisma.inventoryItem.update({ where: { id: existente.id }, data: datos });
      actualizados++;
    } else {
      await prisma.inventoryItem.create({ data: { ...datos, sku: p.sku, currentStock: p.stock } });
      creados++;
    }
    console.log(`   ${p.name.padEnd(28)} ₲${p.precio.toLocaleString('es-PY').padStart(7)}  ${p.cat}`);
  }

  console.log(`\n  ${creados} creados · ${actualizados} actualizados · ${PRODUCTOS.length} ilustraciones`);
  console.log('  Para borrarlos: node scripts/seed-productos-demo.js --limpiar\n');
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('\n  falló:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
