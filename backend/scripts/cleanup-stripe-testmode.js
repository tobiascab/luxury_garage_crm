#!/usr/bin/env node
/**
 * Limpieza de BD (independiente del ambiente): elimina TODO lo de Stripe (columnas + tablas)
 * y el flag de modo prueba (is_test_mode), ya sin uso en el código. Renombra
 * credit_notes.stripe_refund_id → bancard_rollback_ref (el ref del rollback de Bancard
 * vivía en esa columna reutilizada).
 *
 * NO usa `prisma db push` a propósito: db push revierte payments.bancard_shop_process_id
 * de bigint a integer y rompe TODOS los cobros con tarjeta. Este script solo toca lo que debe.
 *
 * Todo corre en UNA transacción (o pasa entero, o no pasa nada). Idempotente: se puede
 * correr más de una vez sin error (usa IF EXISTS y chequeos previos).
 *
 * Uso:
 *   node scripts/apply-prod-cleanup.js            → aplica (COMMIT)
 *   node scripts/apply-prod-cleanup.js --dry-run  → simula (ROLLBACK), no cambia nada
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');

if (!process.env.DATABASE_URL) {
  console.error('❌ Falta DATABASE_URL en backend/.env');
  process.exit(1);
}
const client = new Client({ connectionString: process.env.DATABASE_URL });

const DROP_COLUMNS = {
  users: [
    'is_test_mode',
    'stripe_customer_id', 'stripe_connect_account_id', 'stripe_account_status',
    'default_payment_method_id',
    'platform_subscription_id', 'platform_subscription_status', 'platform_balance_payment_method_id',
  ],
  plans: ['stripe_product_id', 'stripe_price_id'],
  memberships: ['stripe_subscription_id'],
  payments: ['stripe_payment_intent_id', 'stripe_charge_id', 'stripe_session_id', 'stripe_connect_account_id'],
  payment_cards: ['stripe_payment_method_id'],
};
const DROP_TABLES = ['stripe_ledger_entries', 'stripe_webhook_events'];

async function columnExists(table, col) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [table, col]);
  return r.rowCount > 0;
}

(async () => {
  await client.connect();
  await client.query('BEGIN');
  const done = [];
  try {
    // 1. Rename credit_notes.stripe_refund_id → bancard_rollback_ref (preserva datos si los hubiera)
    const hasOld = await columnExists('credit_notes', 'stripe_refund_id');
    const hasNew = await columnExists('credit_notes', 'bancard_rollback_ref');
    if (hasOld && !hasNew) {
      await client.query(`ALTER TABLE credit_notes RENAME COLUMN stripe_refund_id TO bancard_rollback_ref`);
      done.push('RENAME credit_notes.stripe_refund_id → bancard_rollback_ref');
    } else if (hasNew) {
      done.push('(credit_notes.bancard_rollback_ref ya existe — sin cambios)');
    }

    // 2. Drop columnas Stripe + is_test_mode
    for (const [table, cols] of Object.entries(DROP_COLUMNS)) {
      for (const col of cols) {
        await client.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${col}"`);
      }
      done.push(`DROP COLUMNS en ${table}: ${cols.join(', ')}`);
    }

    // 3. Drop tablas Stripe (muertas)
    for (const t of DROP_TABLES) {
      await client.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
      done.push(`DROP TABLE ${t}`);
    }

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('🧪 DRY-RUN (ROLLBACK, nada se cambió). Operaciones que SÍ correrían:');
    } else {
      await client.query('COMMIT');
      console.log('✅ COMMIT. Cambios aplicados:');
    }
    done.forEach(d => console.log('   • ' + d));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ROLLBACK por error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
