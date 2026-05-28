-- Verificación de correo en el registro (no bloqueante).

ALTER TABLE "usuario" ADD COLUMN "email_verificado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "usuario" ADD COLUMN "email_verificado_at" TIMESTAMP(3);

CREATE TABLE "verificacion_email" (
  "id"         TEXT NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "selector"   TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expira_at"  TIMESTAMP(3) NOT NULL,
  "usado_at"   TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verificacion_email_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verificacion_email_selector_key" ON "verificacion_email"("selector");
CREATE INDEX "verificacion_email_usuario_id_idx" ON "verificacion_email"("usuario_id");

ALTER TABLE "verificacion_email" ADD CONSTRAINT "verificacion_email_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
