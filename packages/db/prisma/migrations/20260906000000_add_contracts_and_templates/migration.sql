-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('EMAIL', 'CONTRACT');

-- CreateEnum
CREATE TYPE "TemplatePurpose" AS ENUM ('ESTIMATE_SEND', 'INVOICE_SEND', 'CONTRACT_SEND', 'CONTRACT_BODY');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'VOID');

-- CreateTable
CREATE TABLE "template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TemplateType" NOT NULL,
    "purpose" "TemplatePurpose" NOT NULL,
    "subject" TEXT,
    "blocks" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "body" JSONB NOT NULL,
    "dealId" TEXT,
    "contactId" TEXT,
    "estimateId" TEXT,
    "invoiceId" TEXT,
    "createdById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentTo" TEXT,
    "signedAt" TIMESTAMP(3),
    "signerName" TEXT,
    "signatureKind" TEXT,
    "signatureData" TEXT,
    "signingToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_purpose_key" ON "template"("purpose");

-- CreateIndex
CREATE UNIQUE INDEX "contract_number_key" ON "contract"("number");

-- CreateIndex
CREATE UNIQUE INDEX "contract_signingToken_key" ON "contract"("signingToken");

-- CreateIndex
CREATE INDEX "contract_dealId_idx" ON "contract"("dealId");

-- CreateIndex
CREATE INDEX "contract_contactId_idx" ON "contract"("contactId");

-- CreateIndex
CREATE INDEX "contract_estimateId_idx" ON "contract"("estimateId");

-- CreateIndex
CREATE INDEX "contract_status_idx" ON "contract"("status");

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

