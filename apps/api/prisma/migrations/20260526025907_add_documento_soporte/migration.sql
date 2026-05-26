-- CreateTable
CREATE TABLE "documento_soporte" (
    "id" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 1,
    "codigo" TEXT NOT NULL,
    "cuds" TEXT,
    "proveedor_id" TEXT,
    "es_ad_hoc" BOOLEAN NOT NULL DEFAULT false,
    "tipo_documento" TEXT NOT NULL,
    "numero_documento" TEXT NOT NULL,
    "nombre_proveedor" TEXT NOT NULL,
    "direccion" TEXT,
    "ciudad" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "servicio_prestado" TEXT NOT NULL,
    "frente_id" TEXT,
    "fecha_documento" TIMESTAMP(3) NOT NULL,
    "forma_pago" TEXT NOT NULL DEFAULT 'transferencia',
    "subtotal_centavos" BIGINT NOT NULL,
    "iva_centavos" BIGINT NOT NULL DEFAULT 0,
    "retencion_fuente_centavos" BIGINT NOT NULL DEFAULT 0,
    "retencion_iva_centavos" BIGINT NOT NULL DEFAULT 0,
    "retencion_ica_centavos" BIGINT NOT NULL DEFAULT 0,
    "total_centavos" BIGINT NOT NULL,
    "identificacion_adjunto_id" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "motivo_anulacion" TEXT,
    "creado_por_id" TEXT NOT NULL,
    "emitido_at" TIMESTAMP(3),
    "anulado_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documento_soporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documento_soporte_codigo_key" ON "documento_soporte"("codigo");

-- CreateIndex
CREATE INDEX "documento_soporte_estado_idx" ON "documento_soporte"("estado");

-- CreateIndex
CREATE INDEX "documento_soporte_numero_documento_idx" ON "documento_soporte"("numero_documento");

-- CreateIndex
CREATE INDEX "documento_soporte_fecha_documento_idx" ON "documento_soporte"("fecha_documento");

-- AddForeignKey
ALTER TABLE "documento_soporte" ADD CONSTRAINT "documento_soporte_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_soporte" ADD CONSTRAINT "documento_soporte_frente_id_fkey" FOREIGN KEY ("frente_id") REFERENCES "frente_obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_soporte" ADD CONSTRAINT "documento_soporte_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
