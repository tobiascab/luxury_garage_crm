-- Sistema de inventario real: proveedores, ledger de movimientos, recetas de consumo
-- + evolución de inventory_items.

-- InventoryItem: nuevos campos
ALTER TABLE "inventory_items"
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "brand" TEXT,
  ADD COLUMN "max_stock" INTEGER,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "supplier_id" TEXT,
  ADD COLUMN "expires_at" TIMESTAMP(3),
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "inventory_items_sku_key" ON "inventory_items"("sku");

-- Proveedores
CREATE TABLE "suppliers" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contact" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- Ledger de movimientos de stock
CREATE TABLE "stock_movements" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "quantity_before" INTEGER NOT NULL,
  "quantity_after" INTEGER NOT NULL,
  "reason" TEXT,
  "unit_cost_gs" INTEGER,
  "user_id" TEXT,
  "service_record_id" TEXT,
  "supplier_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_movements_item_id_created_at_idx" ON "stock_movements"("item_id", "created_at");
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type");

-- Recetas de consumo por servicio (BOM)
CREATE TABLE "service_consumptions" (
  "id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "vehicle_size" TEXT,
  "quantity" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_consumptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "service_consumptions_service_id_item_id_vehicle_size_key" ON "service_consumptions"("service_id", "item_id", "vehicle_size");
CREATE INDEX "service_consumptions_service_id_idx" ON "service_consumptions"("service_id");

-- Foreign keys
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_consumptions" ADD CONSTRAINT "service_consumptions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_consumptions" ADD CONSTRAINT "service_consumptions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
