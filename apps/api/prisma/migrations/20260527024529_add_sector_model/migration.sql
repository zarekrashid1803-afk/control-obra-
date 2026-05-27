-- AlterTable
ALTER TABLE "promo_code" ADD COLUMN     "sector_id" TEXT;

-- AlterTable
ALTER TABLE "tenant" ADD COLUMN     "sector_id" TEXT;

-- CreateTable
CREATE TABLE "sector" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "icon_emoji" TEXT NOT NULL DEFAULT '🏗️',
    "config_json" JSONB,
    "orden" INTEGER NOT NULL DEFAULT 100,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sector_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
