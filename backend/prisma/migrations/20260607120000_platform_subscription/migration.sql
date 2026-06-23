-- Suscripción de plataforma: el negocio (cuenta conectada) le paga una cuota SaaS
-- recurrente a la plataforma (Avanzantec), debitada de su saldo Stripe (stripe_balance).

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "platform_subscription_id" TEXT,
  ADD COLUMN "platform_subscription_status" TEXT,
  ADD COLUMN "platform_balance_payment_method_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_platform_subscription_id_key" ON "users"("platform_subscription_id");
