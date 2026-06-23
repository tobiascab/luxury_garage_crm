-- Precio por tamaño de vehículo + adicionales por servicio.

-- Service: precios por tamaño y adicionales
ALTER TABLE "services"
  ADD COLUMN "pricing_by_size" JSONB,
  ADD COLUMN "addons" JSONB;

-- Vehicle: categoría de tamaño (small|suv|truck|pickup)
ALTER TABLE "vehicles"
  ADD COLUMN "size" TEXT;

-- Appointment: snapshot de tamaño, adicionales elegidos y precio calculado
ALTER TABLE "appointments"
  ADD COLUMN "vehicle_size" TEXT,
  ADD COLUMN "selected_addons" JSONB,
  ADD COLUMN "total_price_gs" INTEGER;

-- Taxonomía de tamaños de vehículo (configurable desde la BD)
CREATE TABLE "vehicle_sizes" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicle_sizes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vehicle_sizes_key_key" ON "vehicle_sizes"("key");
