-- AlterTable
ALTER TABLE "tenant" ADD COLUMN     "trial_ends_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "promo_code" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_by_user_id" TEXT,
    "tenant_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_email" TEXT,

    CONSTRAINT "promo_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promo_code_codigo_key" ON "promo_code"("codigo");

-- AddForeignKey
ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_used_by_user_id_fkey" FOREIGN KEY ("used_by_user_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
