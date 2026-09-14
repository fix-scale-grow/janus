-- AlterEnum
ALTER TYPE "ProposalStatus" ADD VALUE 'DECLINED' BEFORE 'VOID';

-- AlterTable
ALTER TABLE "proposal" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "firstViewedAt" TIMESTAMP(3),
ADD COLUMN "lastViewedAt" TIMESTAMP(3),
ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "declinedAt" TIMESTAMP(3),
ADD COLUMN "declinedName" TEXT,
ADD COLUMN "declineNote" TEXT;

-- DropIndex
DROP INDEX "proposal_estimateId_key";

-- CreateIndex
CREATE INDEX "proposal_estimateId_revision_idx" ON "proposal"("estimateId", "revision");
