-- DropForeignKey
ALTER TABLE "project" DROP CONSTRAINT "project_dealId_fkey";

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "estimateId" TEXT,
ADD COLUMN     "invoiceId" TEXT,
ALTER COLUMN "dealId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "project_contactId_idx" ON "project"("contactId");

-- CreateIndex
CREATE INDEX "project_estimateId_idx" ON "project"("estimateId");

-- CreateIndex
CREATE INDEX "project_invoiceId_idx" ON "project"("invoiceId");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
