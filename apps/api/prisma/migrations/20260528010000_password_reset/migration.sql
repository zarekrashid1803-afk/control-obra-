-- Tokens de recuperación de contraseña (flujo "olvidé mi contraseña").
-- token = "selector.secret"; solo se guarda el hash del secreto. Un uso, 1h.

CREATE TABLE "password_reset" (
  "id"         TEXT NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "selector"   TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expira_at"  TIMESTAMP(3) NOT NULL,
  "usado_at"   TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_selector_key" ON "password_reset"("selector");
CREATE INDEX "password_reset_usuario_id_idx" ON "password_reset"("usuario_id");

ALTER TABLE "password_reset" ADD CONSTRAINT "password_reset_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
