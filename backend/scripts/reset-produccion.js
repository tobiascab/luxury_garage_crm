#!/usr/bin/env node
/**
 * RESET A PRODUCCIÓN — borra TODOS los datos transaccionales de la etapa de pruebas.
 *
 * Qué borra:
 *   • Plata      → payments, bancard_operations, credits (billetera), credit_notes,
 *                  journal_entries + journal_lines (contabilidad), memberships, payment_cards.
 *   • Pedidos    → appointments, service_records (los service_records caen por CASCADE,
 *                  igual se borran explícito para dejar traza en el resumen).
 *   • Clientes   → usuarios con role=CLIENT + sus vehículos, notificaciones, reviews,
 *                  referidos y suscripciones push (todo por CASCADE desde users).
 *   • Auditoría  → audit_logs (quedarían apuntando a pagos/usuarios inexistentes).
 *   • Chat       → conversations + messages de la etapa de prueba.
 *
 * Qué NO toca (config real del negocio):
 *   planes, servicios, tamaños de vehículo, inventario y sus recetas de consumo,
 *   movimientos de stock, plan de cuentas, categorías de gasto, settings,
 *   y las cuentas de admin/empleado.
 *
 * Todo corre en UNA transacción: o pasa entero, o no pasa nada.
 *
 * Uso:
 *   node scripts/reset-produccion.js --dry-run   → simula (ROLLBACK), no cambia nada
 *   node scripts/reset-produccion.js --confirm   → aplica (COMMIT)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');

const DRY_RUN = !process.argv.includes('--confirm');

if (!process.env.DATABASE_URL) {
  console.error('❌ Falta DATABASE_URL en backend/.env');
  process.exit(1);
}
const client = new Client({ connectionString: process.env.DATABASE_URL });

// Orden IMPORTA: respeta las claves foráneas RESTRICT
// (payments→users, journal_entries→users, service_records→users(employee)).
const STEPS = [
  ['journal_lines', 'DELETE FROM journal_lines'],
  ['journal_entries', 'DELETE FROM journal_entries'],
  ['credit_notes', 'DELETE FROM credit_notes'],
  ['payments', 'DELETE FROM payments'],
  ['bancard_operations', 'DELETE FROM bancard_operations'],
  ['credits (billetera)', 'DELETE FROM credits'],
  ['payment_cards', 'DELETE FROM payment_cards'],
  ['reviews', 'DELETE FROM reviews'],
  ['service_records', 'DELETE FROM service_records'],
  ['appointments', 'DELETE FROM appointments'],
  ['memberships', 'DELETE FROM memberships'],
  ['notifications', 'DELETE FROM notifications'],
  ['referrals', 'DELETE FROM referrals'],
  ['push_subscriptions', 'DELETE FROM push_subscriptions'],
  ['membership_requests', 'DELETE FROM membership_requests'],
  ['messages', 'DELETE FROM messages'],
  ['conversations', 'DELETE FROM conversations'],
  ['audit_logs', 'DELETE FROM audit_logs'],
  ['vehículos de clientes', `DELETE FROM vehicles WHERE user_id IN (SELECT id FROM users WHERE role='CLIENT')`],
  ['usuarios CLIENT', `DELETE FROM users WHERE role='CLIENT'`],
];

const SURVIVE = ['plans', 'services', 'vehicle_sizes', 'inventory_items', 'service_consumptions',
  'stock_movements', 'accounts', 'expense_categories', 'settings', 'users'];

(async () => {
  await client.connect();
  await client.query('BEGIN');
  const done = [];
  try {
    for (const [label, sql] of STEPS) {
      const r = await client.query(sql).catch((e) => {
        // Una tabla ausente no debe abortar el reset (p.ej. chat no instalado).
        if (e.code === '42P01') { done.push(`${label}: (tabla inexistente, omitida)`); return null; }
        throw e;
      });
      if (r) done.push(`${label}: ${r.rowCount} fila(s) borrada(s)`);
    }

    console.log(DRY_RUN ? '🧪 DRY-RUN — se haría esto (y luego ROLLBACK):' : '🔥 Aplicando borrado:');
    done.forEach((d) => console.log('   • ' + d));

    console.log('\n📋 Estado que queda:');
    for (const t of SURVIVE) {
      const r = await client.query(`SELECT count(*)::int n FROM "${t}"`).catch(() => ({ rows: [{ n: '?' }] }));
      console.log(`   • ${t}: ${r.rows[0].n}`);
    }
    const u = await client.query(`SELECT role, count(*)::int n FROM users GROUP BY role ORDER BY 1`);
    console.log('   • usuarios por rol: ' + u.rows.map((x) => `${x.role}=${x.n}`).join(', '));

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('\n🧪 ROLLBACK hecho: la base quedó IGUAL. Corré con --confirm para aplicar.');
    } else {
      await client.query('COMMIT');
      console.log('\n✅ COMMIT. Base limpia y lista para producción.');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ROLLBACK por error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
