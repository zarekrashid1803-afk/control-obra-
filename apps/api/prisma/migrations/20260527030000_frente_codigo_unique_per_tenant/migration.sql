-- DropIndex: el código deja de ser único global
DROP INDEX "frente_obra_codigo_key";

-- CreateIndex: índice por tenant
CREATE INDEX "frente_obra_tenant_id_idx" ON "frente_obra"("tenant_id");

-- CreateIndex: código único POR tenant (FR-001 puede repetirse entre tenants)
CREATE UNIQUE INDEX "frente_obra_tenant_id_codigo_key" ON "frente_obra"("tenant_id", "codigo");
