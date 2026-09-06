-- AlterTable
ALTER TABLE "estimate" ADD COLUMN "drawingSyncedAt" TIMESTAMP(3);

UPDATE "estimate" SET "drawingSyncedAt" = "createdAt" WHERE "drawingId" IS NOT NULL;
