ALTER TABLE "deal" ALTER COLUMN "companyId" DROP NOT NULL;

ALTER TABLE "contact" ADD COLUMN "companyName" TEXT;

UPDATE "contact" SET "companyName" = "company"."name" FROM "company" WHERE "contact"."companyId" = "company"."id";
