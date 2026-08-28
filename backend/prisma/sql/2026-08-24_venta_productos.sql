-- ═══════════════════════════════════════════════════════════════════════════════
-- Venta de productos de mostrador: catálogo sobre el inventario, pedidos y caja.
--
-- DDL A MANO A PROPÓSITO: el historial de migraciones de este proyecto está divergido
-- y `prisma db push` revierte payments.bancard_shop_process_id de bigint a integer,
-- lo que rompe TODOS los cobros con tarjeta. Este script es idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Cara comercial de los ítems que se venden ──────────────────────────────
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_for_sale   boolean NOT NULL DEFAULT false;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sale_price_gs integer;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS image_url     text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sale_category text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sale_order    integer;
CREATE INDEX IF NOT EXISTS inventory_items_is_for_sale_sale_category_idx
  ON inventory_items (is_for_sale, sale_category);

-- ── 2. Caja del día ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_sessions (
  id            text PRIMARY KEY,
  status        text NOT NULL DEFAULT 'OPEN',
  opened_at     timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  opened_by_id  text REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  closed_at     timestamp(3) without time zone,
  closed_by_id  text REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  total_gs      integer,
  orders_count  integer,
  notes         text
);
CREATE INDEX IF NOT EXISTS cash_sessions_status_idx    ON cash_sessions (status);
CREATE INDEX IF NOT EXISTS cash_sessions_opened_at_idx ON cash_sessions (opened_at);

-- ── 3. Pedidos ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                      text PRIMARY KEY,
  user_id                 text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  employee_id             text REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  status                  text NOT NULL DEFAULT 'PENDING',
  total_gs                integer NOT NULL,
  payment_method          text,
  card_id                 text,
  payment_id              text,
  credit_id               text,
  -- bigint como en payments: guarda Date.now() (13 dígitos) y en integer desborda.
  bancard_shop_process_id bigint UNIQUE,
  cash_session_id         text REFERENCES cash_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
  decline_reason          text,
  void_reason             text,
  qr_issued_at            timestamp(3) without time zone,
  expires_at              timestamp(3) without time zone,
  scanned_at              timestamp(3) without time zone,
  paid_at                 timestamp(3) without time zone,
  created_at              timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS orders_user_id_status_idx    ON orders (user_id, status);
CREATE INDEX IF NOT EXISTS orders_status_created_at_idx ON orders (status, created_at);
CREATE INDEX IF NOT EXISTS orders_cash_session_id_idx   ON orders (cash_session_id);

-- ── 4. Líneas del pedido (nombre y precio congelados) ─────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id            text PRIMARY KEY,
  order_id      text NOT NULL REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  item_id       text NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  name_snapshot text NOT NULL,
  unit_price_gs integer NOT NULL,
  qty           integer NOT NULL,
  line_total_gs integer NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_item_id_idx  ON order_items (item_id);

-- ── 5. La venta es un movimiento de stock más ─────────────────────────────────
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS order_id text;
CREATE INDEX IF NOT EXISTS stock_movements_order_id_idx ON stock_movements (order_id);
