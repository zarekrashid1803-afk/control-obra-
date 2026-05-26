-- CreateTable
CREATE TABLE "tenant" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol" (
    "id" TEXT NOT NULL,
    "nombre_display" TEXT NOT NULL,
    "descripcion" TEXT,
    "permisos" JSONB NOT NULL,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 1,
    "email" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "iniciales" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_change_required" BOOLEAN NOT NULL DEFAULT true,
    "mfa_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "frentes_asignados" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_rol" (
    "usuario_id" TEXT NOT NULL,
    "rol_id" TEXT NOT NULL,
    "asignado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("usuario_id","rol_id")
);

-- CreateTable
CREATE TABLE "sesion" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "emitido_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_at" TIMESTAMP(3) NOT NULL,
    "revocado_at" TIMESTAMP(3),

    CONSTRAINT "sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frente_obra" (
    "id" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 1,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "presupuesto_total_centavos" BIGINT NOT NULL,
    "consumido_centavos" BIGINT NOT NULL DEFAULT 0,
    "color_hex" TEXT NOT NULL DEFAULT '#2f5d8a',
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin_estimada" TIMESTAMP(3),
    "ubicacion" TEXT,
    "responsable_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "frente_obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 1,
    "codigo" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "razon_social" TEXT NOT NULL,
    "tipo_persona" TEXT NOT NULL DEFAULT 'juridica',
    "regimen_iva" TEXT NOT NULL DEFAULT 'responsable_iva',
    "autorretenedor" BOOLEAN NOT NULL DEFAULT false,
    "gran_contribuyente" BOOLEAN NOT NULL DEFAULT false,
    "direccion" TEXT,
    "ciudad" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "condiciones_pago" TEXT NOT NULL DEFAULT 'credito_30',
    "rating" DECIMAL(2,1),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material" (
    "id" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 1,
    "sku" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "categoria" TEXT,
    "precio_referencia_centavos" BIGINT NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "proveedor_preferente_id" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisicion" (
    "id" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 1,
    "codigo" TEXT NOT NULL,
    "frente_id" TEXT NOT NULL,
    "solicitante_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "prioridad" TEXT NOT NULL DEFAULT 'normal',
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "motivo_rechazo" TEXT,
    "aprobador_id" TEXT,
    "avalador_id" TEXT,
    "subtotal_centavos" BIGINT NOT NULL DEFAULT 0,
    "iva_centavos" BIGINT NOT NULL DEFAULT 0,
    "retenciones_centavos" BIGINT NOT NULL DEFAULT 0,
    "total_centavos" BIGINT NOT NULL DEFAULT 0,
    "sobre_presupuesto" BOOLEAN NOT NULL DEFAULT false,
    "orden_compra_id" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_aprobacion" TIMESTAMP(3),
    "fecha_cierre" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "requisicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisicion_item" (
    "id" TEXT NOT NULL,
    "requisicion_id" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "material_id" TEXT,
    "descripcion_snapshot" TEXT NOT NULL,
    "unidad_snapshot" TEXT NOT NULL,
    "cantidad" DECIMAL(15,3) NOT NULL,
    "precio_unitario_centavos_snapshot" BIGINT NOT NULL,
    "subtotal_centavos" BIGINT NOT NULL,
    "notas" TEXT,

    CONSTRAINT "requisicion_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisicion_estado_historial" (
    "id" TEXT NOT NULL,
    "requisicion_id" TEXT NOT NULL,
    "estado_anterior" TEXT,
    "estado_nuevo" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "observacion" TEXT,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requisicion_estado_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisicion_observacion" (
    "id" TEXT NOT NULL,
    "requisicion_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requisicion_observacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_compra" (
    "id" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 1,
    "codigo" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "frente_id" TEXT NOT NULL,
    "generada_por_id" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "condiciones_pago" TEXT NOT NULL,
    "fecha_emision" TIMESTAMP(3),
    "fecha_entrega_prometida" TIMESTAMP(3),
    "fecha_entrega_real" TIMESTAMP(3),
    "subtotal_centavos" BIGINT NOT NULL DEFAULT 0,
    "descuento_centavos" BIGINT NOT NULL DEFAULT 0,
    "iva_centavos" BIGINT NOT NULL DEFAULT 0,
    "retencion_fuente_centavos" BIGINT NOT NULL DEFAULT 0,
    "retencion_iva_centavos" BIGINT NOT NULL DEFAULT 0,
    "retencion_ica_centavos" BIGINT NOT NULL DEFAULT 0,
    "total_centavos" BIGINT NOT NULL DEFAULT 0,
    "cufe_factura_proveedor" TEXT,
    "pdf_url_s3" TEXT,
    "enviada_at" TIMESTAMP(3),
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orden_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_compra_item" (
    "id" TEXT NOT NULL,
    "orden_compra_id" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "material_id" TEXT,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" DECIMAL(15,3) NOT NULL,
    "precio_unitario_centavos" BIGINT NOT NULL,
    "descuento_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal_centavos" BIGINT NOT NULL,

    CONSTRAINT "orden_compra_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_caja" (
    "id" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 1,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto_centavos" BIGINT NOT NULL,
    "frente_id" TEXT,
    "orden_compra_id" TEXT,
    "proveedor_id" TEXT,
    "categoria" TEXT,
    "soporte_adjunto_id" TEXT,
    "retencion_fuente_centavos" BIGINT NOT NULL DEFAULT 0,
    "retencion_iva_centavos" BIGINT NOT NULL DEFAULT 0,
    "retencion_ica_centavos" BIGINT NOT NULL DEFAULT 0,
    "arqueo_id" TEXT,
    "idempotency_key" TEXT,
    "autorizado_por_id" TEXT NOT NULL,
    "fecha_movimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arqueo_caja" (
    "id" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 1,
    "fecha" TIMESTAMP(3) NOT NULL,
    "responsable_id" TEXT NOT NULL,
    "saldo_inicial_centavos" BIGINT NOT NULL,
    "saldo_esperado_centavos" BIGINT NOT NULL,
    "saldo_real_centavos" BIGINT NOT NULL,
    "diferencia_centavos" BIGINT NOT NULL DEFAULT 0,
    "justificacion_diferencia" TEXT,
    "cerrado_at" TIMESTAMP(3),
    "firma_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arqueo_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bodega_entrada" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "orden_compra_id" TEXT NOT NULL,
    "recibido_por_id" TEXT NOT NULL,
    "firma_url" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bodega_entrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bodega_entrada_item" (
    "id" TEXT NOT NULL,
    "entrada_id" TEXT NOT NULL,
    "oc_item_id" TEXT NOT NULL,
    "cantidad_esperada" DECIMAL(15,3) NOT NULL,
    "cantidad_recibida" DECIMAL(15,3) NOT NULL,
    "estado_item" TEXT NOT NULL DEFAULT 'completo',
    "observaciones" TEXT,

    CONSTRAINT "bodega_entrada_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bodega_salida" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "frente_id" TEXT NOT NULL,
    "despachado_por_id" TEXT NOT NULL,
    "requisicion_ref" TEXT,
    "firma_receptor_url" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bodega_salida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bodega_salida_item" (
    "id" TEXT NOT NULL,
    "salida_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "cantidad" DECIMAL(15,3) NOT NULL,

    CONSTRAINT "bodega_salida_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario_frente" (
    "id" TEXT NOT NULL,
    "frente_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "cantidad" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventario_frente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjunto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanio_bytes" INTEGER NOT NULL,
    "url_s3" TEXT NOT NULL,
    "checksum_sha256" TEXT,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "subido_por_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacion" (
    "id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "payload" JSONB,
    "leida_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 1,
    "actor_id" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "cambios" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_key" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "response_snapshot" JSONB,
    "expira_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 1,
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "descripcion" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integracion_log" (
    "id" TEXT NOT NULL,
    "sistema" TEXT NOT NULL,
    "operacion" TEXT NOT NULL,
    "payload" JSONB,
    "response" JSONB,
    "estado" TEXT NOT NULL,
    "latencia_ms" INTEGER,
    "intentos" INTEGER NOT NULL DEFAULT 1,
    "error_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integracion_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_nit_key" ON "tenant"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_tenant_id_idx" ON "usuario"("tenant_id");

-- CreateIndex
CREATE INDEX "usuario_activo_idx" ON "usuario"("activo");

-- CreateIndex
CREATE INDEX "sesion_usuario_id_idx" ON "sesion"("usuario_id");

-- CreateIndex
CREATE INDEX "sesion_refresh_token_hash_idx" ON "sesion"("refresh_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "frente_obra_codigo_key" ON "frente_obra"("codigo");

-- CreateIndex
CREATE INDEX "frente_obra_estado_idx" ON "frente_obra"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "proveedor_codigo_key" ON "proveedor"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "proveedor_nit_key" ON "proveedor"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "material_sku_key" ON "material"("sku");

-- CreateIndex
CREATE INDEX "material_sku_idx" ON "material"("sku");

-- CreateIndex
CREATE INDEX "material_activo_idx" ON "material"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "requisicion_codigo_key" ON "requisicion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "requisicion_orden_compra_id_key" ON "requisicion"("orden_compra_id");

-- CreateIndex
CREATE INDEX "requisicion_estado_idx" ON "requisicion"("estado");

-- CreateIndex
CREATE INDEX "requisicion_frente_id_estado_idx" ON "requisicion"("frente_id", "estado");

-- CreateIndex
CREATE INDEX "requisicion_solicitante_id_idx" ON "requisicion"("solicitante_id");

-- CreateIndex
CREATE INDEX "requisicion_created_at_idx" ON "requisicion"("created_at");

-- CreateIndex
CREATE INDEX "requisicion_item_requisicion_id_idx" ON "requisicion_item"("requisicion_id");

-- CreateIndex
CREATE INDEX "requisicion_estado_historial_requisicion_id_idx" ON "requisicion_estado_historial"("requisicion_id");

-- CreateIndex
CREATE INDEX "requisicion_observacion_requisicion_id_idx" ON "requisicion_observacion"("requisicion_id");

-- CreateIndex
CREATE UNIQUE INDEX "orden_compra_codigo_key" ON "orden_compra"("codigo");

-- CreateIndex
CREATE INDEX "orden_compra_estado_idx" ON "orden_compra"("estado");

-- CreateIndex
CREATE INDEX "orden_compra_proveedor_id_idx" ON "orden_compra"("proveedor_id");

-- CreateIndex
CREATE INDEX "orden_compra_fecha_entrega_prometida_idx" ON "orden_compra"("fecha_entrega_prometida");

-- CreateIndex
CREATE INDEX "orden_compra_item_orden_compra_id_idx" ON "orden_compra_item"("orden_compra_id");

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_caja_codigo_key" ON "movimiento_caja"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_caja_idempotency_key_key" ON "movimiento_caja"("idempotency_key");

-- CreateIndex
CREATE INDEX "movimiento_caja_fecha_movimiento_idx" ON "movimiento_caja"("fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimiento_caja_frente_id_fecha_movimiento_idx" ON "movimiento_caja"("frente_id", "fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimiento_caja_arqueo_id_idx" ON "movimiento_caja"("arqueo_id");

-- CreateIndex
CREATE UNIQUE INDEX "arqueo_caja_tenant_id_fecha_key" ON "arqueo_caja"("tenant_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "bodega_entrada_codigo_key" ON "bodega_entrada"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "bodega_salida_codigo_key" ON "bodega_salida"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_frente_frente_id_material_id_key" ON "inventario_frente"("frente_id", "material_id");

-- CreateIndex
CREATE INDEX "adjunto_entidad_entidad_id_idx" ON "adjunto"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "notificacion_target_user_id_leida_at_idx" ON "notificacion"("target_user_id", "leida_at");

-- CreateIndex
CREATE INDEX "audit_log_entidad_entidad_id_idx" ON "audit_log"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "audit_log_creado_at_idx" ON "audit_log"("creado_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_key_key_key" ON "idempotency_key"("key");

-- CreateIndex
CREATE INDEX "idempotency_key_expira_at_idx" ON "idempotency_key"("expira_at");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_tenant_id_clave_key" ON "configuracion"("tenant_id", "clave");

-- CreateIndex
CREATE INDEX "integracion_log_sistema_estado_idx" ON "integracion_log"("sistema", "estado");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frente_obra" ADD CONSTRAINT "frente_obra_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frente_obra" ADD CONSTRAINT "frente_obra_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedor" ADD CONSTRAINT "proveedor_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material" ADD CONSTRAINT "material_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material" ADD CONSTRAINT "material_proveedor_preferente_id_fkey" FOREIGN KEY ("proveedor_preferente_id") REFERENCES "proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicion" ADD CONSTRAINT "requisicion_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicion" ADD CONSTRAINT "requisicion_frente_id_fkey" FOREIGN KEY ("frente_id") REFERENCES "frente_obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicion" ADD CONSTRAINT "requisicion_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicion" ADD CONSTRAINT "requisicion_avalador_id_fkey" FOREIGN KEY ("avalador_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicion" ADD CONSTRAINT "requisicion_aprobador_id_fkey" FOREIGN KEY ("aprobador_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicion" ADD CONSTRAINT "requisicion_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "orden_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicion_item" ADD CONSTRAINT "requisicion_item_requisicion_id_fkey" FOREIGN KEY ("requisicion_id") REFERENCES "requisicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicion_item" ADD CONSTRAINT "requisicion_item_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicion_estado_historial" ADD CONSTRAINT "requisicion_estado_historial_requisicion_id_fkey" FOREIGN KEY ("requisicion_id") REFERENCES "requisicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicion_estado_historial" ADD CONSTRAINT "requisicion_estado_historial_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicion_observacion" ADD CONSTRAINT "requisicion_observacion_requisicion_id_fkey" FOREIGN KEY ("requisicion_id") REFERENCES "requisicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicion_observacion" ADD CONSTRAINT "requisicion_observacion_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_frente_id_fkey" FOREIGN KEY ("frente_id") REFERENCES "frente_obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_generada_por_id_fkey" FOREIGN KEY ("generada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_item" ADD CONSTRAINT "orden_compra_item_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "orden_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_item" ADD CONSTRAINT "orden_compra_item_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_frente_id_fkey" FOREIGN KEY ("frente_id") REFERENCES "frente_obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "orden_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_autorizado_por_id_fkey" FOREIGN KEY ("autorizado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_arqueo_id_fkey" FOREIGN KEY ("arqueo_id") REFERENCES "arqueo_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arqueo_caja" ADD CONSTRAINT "arqueo_caja_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arqueo_caja" ADD CONSTRAINT "arqueo_caja_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodega_entrada" ADD CONSTRAINT "bodega_entrada_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "orden_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodega_entrada" ADD CONSTRAINT "bodega_entrada_recibido_por_id_fkey" FOREIGN KEY ("recibido_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodega_entrada_item" ADD CONSTRAINT "bodega_entrada_item_entrada_id_fkey" FOREIGN KEY ("entrada_id") REFERENCES "bodega_entrada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodega_entrada_item" ADD CONSTRAINT "bodega_entrada_item_oc_item_id_fkey" FOREIGN KEY ("oc_item_id") REFERENCES "orden_compra_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodega_salida" ADD CONSTRAINT "bodega_salida_frente_id_fkey" FOREIGN KEY ("frente_id") REFERENCES "frente_obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodega_salida" ADD CONSTRAINT "bodega_salida_despachado_por_id_fkey" FOREIGN KEY ("despachado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodega_salida_item" ADD CONSTRAINT "bodega_salida_item_salida_id_fkey" FOREIGN KEY ("salida_id") REFERENCES "bodega_salida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodega_salida_item" ADD CONSTRAINT "bodega_salida_item_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_frente" ADD CONSTRAINT "inventario_frente_frente_id_fkey" FOREIGN KEY ("frente_id") REFERENCES "frente_obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_frente" ADD CONSTRAINT "inventario_frente_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
