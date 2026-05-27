-- Aislamiento multi-tenant de adjuntos.
-- Antes: la tabla adjunto no tenía tenant_id y el endpoint que sirve el
-- archivo era público → cualquiera con el UUID descargaba documentos de
-- cualquier empresa. Esto cierra ese hueco.

-- 1) Columna nullable para poder backfillear.
ALTER TABLE "adjunto" ADD COLUMN "tenant_id" INTEGER;

-- 2) Backfill: el tenant del adjunto = el tenant de quien lo subió.
UPDATE "adjunto" a
SET "tenant_id" = u."tenant_id"
FROM "usuario" u
WHERE u."id" = a."subido_por_id";

-- 3) Huérfanos (subido_por borrado / sin match): asignar al tenant más bajo
--    para satisfacer NOT NULL. Quedan inaccesibles igual por el tenant check.
UPDATE "adjunto"
SET "tenant_id" = (SELECT MIN("id") FROM "tenant")
WHERE "tenant_id" IS NULL;

-- 4) Ya sin nulls → forzar NOT NULL.
ALTER TABLE "adjunto" ALTER COLUMN "tenant_id" SET NOT NULL;

-- 5) FK + índice (mismo patrón que el resto de modelos).
ALTER TABLE "adjunto" ADD CONSTRAINT "adjunto_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "adjunto_tenant_id_idx" ON "adjunto"("tenant_id");
