-- AlterEnum
BEGIN;
CREATE TYPE "FieldEntity_new" AS ENUM ('CONTACT', 'DEAL');
ALTER TABLE "fieldDefinition" ALTER COLUMN "entity" TYPE "FieldEntity_new" USING ("entity"::text::"FieldEntity_new");
ALTER TYPE "FieldEntity" RENAME TO "FieldEntity_old";
ALTER TYPE "FieldEntity_new" RENAME TO "FieldEntity";
DROP TYPE "public"."FieldEntity_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "activity" DROP CONSTRAINT "activity_companyId_fkey";

-- DropForeignKey
ALTER TABLE "agentConversation" DROP CONSTRAINT "agentConversation_companyId_fkey";

-- DropForeignKey
ALTER TABLE "calendarEvent" DROP CONSTRAINT "calendarEvent_companyId_fkey";

-- DropForeignKey
ALTER TABLE "company" DROP CONSTRAINT "company_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "company" DROP CONSTRAINT "company_primaryContactId_fkey";

-- DropForeignKey
ALTER TABLE "companyEnrichment" DROP CONSTRAINT "companyEnrichment_companyId_fkey";

-- DropForeignKey
ALTER TABLE "contact" DROP CONSTRAINT "contact_companyId_fkey";

-- DropForeignKey
ALTER TABLE "deal" DROP CONSTRAINT "deal_companyId_fkey";

-- DropForeignKey
ALTER TABLE "emailThread" DROP CONSTRAINT "emailThread_companyId_fkey";

-- DropForeignKey
ALTER TABLE "fieldValue" DROP CONSTRAINT "fieldValue_companyId_fkey";

-- DropIndex
DROP INDEX "activity_companyId_createdAt_idx";

-- DropIndex
DROP INDEX "agentConversation_companyId_lastMessageAt_idx";

-- DropIndex
DROP INDEX "calendarEvent_companyId_startsAt_idx";

-- DropIndex
DROP INDEX "contact_companyId_idx";

-- DropIndex
DROP INDEX "deal_companyId_idx";

-- DropIndex
DROP INDEX "emailThread_companyId_lastMessageAt_idx";

-- DropIndex
DROP INDEX "fieldValue_companyId_idx";

-- DropIndex
DROP INDEX "fieldValue_fieldId_companyId_key";

-- AlterTable
ALTER TABLE "activity" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "agentConversation" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "agentTask" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "calendarEvent" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "contact" DROP COLUMN "companyId",
DROP COLUMN "githubUrl",
DROP COLUMN "linkedinUrl",
DROP COLUMN "twitterUrl";

-- AlterTable
ALTER TABLE "deal" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "emailThread" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "fieldValue" DROP COLUMN "companyId";

-- DropTable
DROP TABLE "company";

-- DropTable
DROP TABLE "companyEnrichment";
