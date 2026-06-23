-- Modelo híbrido de reserva: una reserva puede estar cubierta por el plan,
-- pagada por servicio, o cargada al próximo ciclo (overage).
ALTER TABLE "appointments"
  ADD COLUMN "covered_by_membership" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "billing_mode" TEXT;
