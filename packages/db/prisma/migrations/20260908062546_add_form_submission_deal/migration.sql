-- AlterTable
ALTER TABLE "formSubmission" ADD COLUMN     "dealId" TEXT;

-- CreateIndex
CREATE INDEX "formSubmission_dealId_idx" ON "formSubmission"("dealId");

-- AddForeignKey
ALTER TABLE "formSubmission" ADD CONSTRAINT "formSubmission_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
