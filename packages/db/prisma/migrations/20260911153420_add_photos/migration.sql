-- CreateEnum
CREATE TYPE "ProjectPhotoStage" AS ENUM ('BEFORE', 'IN_PROGRESS', 'AFTER', 'FINAL');

-- CreateTable
CREATE TABLE "photo" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "contactId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_photo" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "includeInPdf" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_photo" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "includeInPdf" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_photo" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "stageLabel" "ProjectPhotoStage" NOT NULL DEFAULT 'BEFORE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "photo_dealId_createdAt_idx" ON "photo"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "photo_contactId_createdAt_idx" ON "photo"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "estimate_photo_estimateId_sortOrder_idx" ON "estimate_photo"("estimateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_photo_estimateId_photoId_key" ON "estimate_photo"("estimateId", "photoId");

-- CreateIndex
CREATE INDEX "invoice_photo_invoiceId_sortOrder_idx" ON "invoice_photo"("invoiceId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_photo_invoiceId_photoId_key" ON "invoice_photo"("invoiceId", "photoId");

-- CreateIndex
CREATE INDEX "project_photo_projectId_sortOrder_idx" ON "project_photo"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "project_photo_projectId_photoId_key" ON "project_photo"("projectId", "photoId");

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_photo" ADD CONSTRAINT "estimate_photo_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_photo" ADD CONSTRAINT "estimate_photo_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_photo" ADD CONSTRAINT "invoice_photo_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_photo" ADD CONSTRAINT "invoice_photo_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_photo" ADD CONSTRAINT "project_photo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_photo" ADD CONSTRAINT "project_photo_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
