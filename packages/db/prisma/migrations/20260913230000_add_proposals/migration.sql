-- AlterEnum
ALTER TYPE "TemplatePurpose" ADD VALUE 'PROPOSAL_BODY';
ALTER TYPE "TemplatePurpose" ADD VALUE 'PROPOSAL_SEND';

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'VOID');

-- CreateTable
CREATE TABLE "proposal" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "coverTitle" TEXT,
    "coverSubtitle" TEXT,
    "body" JSONB NOT NULL,
    "estimateId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentTo" TEXT,
    "viewToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "acceptedTier" "EstimateTier",
    "acceptedName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proposal_number_key" ON "proposal"("number");
CREATE UNIQUE INDEX "proposal_estimateId_key" ON "proposal"("estimateId");
CREATE UNIQUE INDEX "proposal_viewToken_key" ON "proposal"("viewToken");
CREATE INDEX "proposal_status_idx" ON "proposal"("status");

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
