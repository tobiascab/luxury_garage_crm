-- Control de baja de plan: un admin debe habilitar el downgrade (de un solo uso).
ALTER TABLE "memberships"
  ADD COLUMN "downgrade_allowed" BOOLEAN NOT NULL DEFAULT false;
