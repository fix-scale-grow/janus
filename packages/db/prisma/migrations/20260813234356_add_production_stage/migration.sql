-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETE', 'PAID');

-- AlterTable
ALTER TABLE "deal" ADD COLUMN     "productionStage" "ProductionStage",
ADD COLUMN     "productionStageChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "deal_productionStage_idx" ON "deal"("productionStage");
