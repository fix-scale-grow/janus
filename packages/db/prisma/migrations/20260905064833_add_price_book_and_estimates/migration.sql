-- CreateEnum
CREATE TYPE "ServiceUnit" AS ENUM ('PER_SQUARE', 'PER_LINEAR_FT', 'PER_EACH', 'FLAT');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "EstimateTier" AS ENUM ('GOOD', 'BETTER', 'BEST');

-- CreateTable
CREATE TABLE "service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade" TEXT NOT NULL DEFAULT 'roofing',
    "unit" "ServiceUnit" NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "costCents" INTEGER,
    "priceGoodCents" INTEGER,
    "priceBestCents" INTEGER,
    "symbolId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled estimate',
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "selectedTier" "EstimateTier" NOT NULL DEFAULT 'BETTER',
    "dealId" TEXT,
    "contactId" TEXT,
    "drawingId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_line_item" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "unit" "ServiceUnit" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "priceGoodCents" INTEGER NOT NULL,
    "priceBetterCents" INTEGER NOT NULL,
    "priceBestCents" INTEGER NOT NULL,
    "areaLabel" TEXT,
    "scopeId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_line_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_symbolId_key" ON "service"("symbolId");

-- CreateIndex
CREATE INDEX "service_trade_idx" ON "service"("trade");

-- CreateIndex
CREATE INDEX "service_active_idx" ON "service"("active");

-- CreateIndex
CREATE INDEX "estimate_dealId_idx" ON "estimate"("dealId");

-- CreateIndex
CREATE INDEX "estimate_drawingId_idx" ON "estimate"("drawingId");

-- CreateIndex
CREATE INDEX "estimate_status_idx" ON "estimate"("status");

-- CreateIndex
CREATE INDEX "estimate_updatedAt_idx" ON "estimate"("updatedAt");

-- CreateIndex
CREATE INDEX "estimate_line_item_estimateId_sortOrder_idx" ON "estimate_line_item"("estimateId", "sortOrder");

-- AddForeignKey
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_drawingId_fkey" FOREIGN KEY ("drawingId") REFERENCES "drawing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_line_item" ADD CONSTRAINT "estimate_line_item_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_line_item" ADD CONSTRAINT "estimate_line_item_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
