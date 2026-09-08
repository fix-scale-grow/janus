-- CreateEnum
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'MESSAGE', 'EMAIL', 'PHONE', 'ADDRESS', 'SELECT');

-- AlterEnum
ALTER TYPE "RecordSource" ADD VALUE 'FORM';

-- AlterTable
ALTER TABLE "formSubmission" ADD COLUMN     "formId" TEXT;

-- CreateTable
CREATE TABLE "form" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intro" TEXT,
    "buttonLabel" TEXT NOT NULL DEFAULT 'Send',
    "confirmation" TEXT NOT NULL DEFAULT 'Thanks — we''ll be in touch shortly.',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createLead" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmails" TEXT,
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_field" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "type" "FormFieldType" NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "contactFieldKey" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_field_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_active_idx" ON "form"("active");

-- CreateIndex
CREATE INDEX "form_field_formId_position_idx" ON "form_field"("formId", "position");

-- CreateIndex
CREATE INDEX "formSubmission_formId_idx" ON "formSubmission"("formId");

-- AddForeignKey
ALTER TABLE "form" ADD CONSTRAINT "form_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_field" ADD CONSTRAINT "form_field_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formSubmission" ADD CONSTRAINT "formSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE SET NULL ON UPDATE CASCADE;
