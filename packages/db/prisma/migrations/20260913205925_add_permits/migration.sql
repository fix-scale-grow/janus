-- CreateEnum
CREATE TYPE "JurisdictionKind" AS ENUM ('CITY', 'COUNTY', 'STATE');

-- CreateEnum
CREATE TYPE "PermitType" AS ENUM ('BUILDING', 'ROOFING', 'ELECTRICAL', 'PLUMBING', 'MECHANICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('DRAFT', 'READY_TO_SUBMIT', 'SUBMITTED', 'ISSUED', 'INSPECTIONS', 'CLOSED', 'DENIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- AlterTable
ALTER TABLE "appSetting" ADD COLUMN     "permitDisclaimerAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "permitDisclaimerAcceptedById" TEXT,
ADD COLUMN     "permitDisclaimerVersion" INTEGER,
ADD COLUMN     "permitStates" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "permitTriggerStageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "permitsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "jurisdiction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "JurisdictionKind" NOT NULL,
    "state" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permit_playbook" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "permitType" "PermitType" NOT NULL,
    "typeLabel" TEXT NOT NULL DEFAULT '',
    "facts" JSONB NOT NULL DEFAULT '{}',
    "worksheetTemplate" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permit_playbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permit" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "playbookId" TEXT,
    "status" "PermitStatus" NOT NULL DEFAULT 'DRAFT',
    "permitType" "PermitType" NOT NULL,
    "typeLabel" TEXT NOT NULL DEFAULT '',
    "permitNumber" TEXT,
    "feeCents" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "deniedReason" TEXT,
    "worksheetAnswers" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permit_document" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "filePath" TEXT,
    "lockerDocumentId" TEXT,
    "attachedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "permit_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permit_inspection" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "criticalNote" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "result" "InspectionResult" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "permit_inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locker_document" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locker_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permit_prompt_dismissal" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permit_prompt_dismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jurisdiction_matchKey_key" ON "jurisdiction"("matchKey");

-- CreateIndex
CREATE UNIQUE INDEX "permit_playbook_jurisdictionId_permitType_typeLabel_key" ON "permit_playbook"("jurisdictionId", "permitType", "typeLabel");

-- CreateIndex
CREATE INDEX "permit_dealId_idx" ON "permit"("dealId");

-- CreateIndex
CREATE INDEX "permit_status_idx" ON "permit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "permit_document_permitId_slotKey_key" ON "permit_document"("permitId", "slotKey");

-- CreateIndex
CREATE INDEX "permit_inspection_permitId_idx" ON "permit_inspection"("permitId");

-- CreateIndex
CREATE UNIQUE INDEX "permit_prompt_dismissal_dealId_key" ON "permit_prompt_dismissal"("dealId");

-- AddForeignKey
ALTER TABLE "permit_playbook" ADD CONSTRAINT "permit_playbook_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit" ADD CONSTRAINT "permit_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit" ADD CONSTRAINT "permit_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit" ADD CONSTRAINT "permit_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "permit_playbook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit" ADD CONSTRAINT "permit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_document" ADD CONSTRAINT "permit_document_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_document" ADD CONSTRAINT "permit_document_lockerDocumentId_fkey" FOREIGN KEY ("lockerDocumentId") REFERENCES "locker_document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_inspection" ADD CONSTRAINT "permit_inspection_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locker_document" ADD CONSTRAINT "locker_document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_prompt_dismissal" ADD CONSTRAINT "permit_prompt_dismissal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
