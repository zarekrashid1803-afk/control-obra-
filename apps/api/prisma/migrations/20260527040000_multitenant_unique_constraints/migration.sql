-- Multi-tenant: códigos únicos POR tenant en vez de global.
-- Permite que tenants distintos repitan FR-001, RQ-2026-0001, NIT, etc.

-- Proveedor
DROP INDEX "proveedor_codigo_key";
DROP INDEX "proveedor_nit_key";
CREATE UNIQUE INDEX "proveedor_tenant_id_codigo_key" ON "proveedor"("tenant_id", "codigo");
CREATE UNIQUE INDEX "proveedor_tenant_id_nit_key" ON "proveedor"("tenant_id", "nit");
CREATE INDEX "proveedor_tenant_id_idx" ON "proveedor"("tenant_id");

-- Material
DROP INDEX "material_sku_key";
CREATE UNIQUE INDEX "material_tenant_id_sku_key" ON "material"("tenant_id", "sku");
CREATE INDEX "material_tenant_id_idx" ON "material"("tenant_id");

-- Requisicion
DROP INDEX "requisicion_codigo_key";
CREATE UNIQUE INDEX "requisicion_tenant_id_codigo_key" ON "requisicion"("tenant_id", "codigo");
CREATE INDEX "requisicion_tenant_id_idx" ON "requisicion"("tenant_id");

-- OrdenCompra
DROP INDEX "orden_compra_codigo_key";
CREATE UNIQUE INDEX "orden_compra_tenant_id_codigo_key" ON "orden_compra"("tenant_id", "codigo");
CREATE INDEX "orden_compra_tenant_id_idx" ON "orden_compra"("tenant_id");

-- MovimientoCaja
DROP INDEX "movimiento_caja_codigo_key";
CREATE UNIQUE INDEX "movimiento_caja_tenant_id_codigo_key" ON "movimiento_caja"("tenant_id", "codigo");
CREATE INDEX "movimiento_caja_tenant_id_idx" ON "movimiento_caja"("tenant_id");

-- DocumentoSoporte
DROP INDEX "documento_soporte_codigo_key";
CREATE UNIQUE INDEX "documento_soporte_tenant_id_codigo_key" ON "documento_soporte"("tenant_id", "codigo");
CREATE INDEX "documento_soporte_tenant_id_idx" ON "documento_soporte"("tenant_id");
