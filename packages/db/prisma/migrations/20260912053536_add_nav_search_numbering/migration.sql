-- AlterTable
ALTER TABLE "appSetting" ADD COLUMN     "dealNumberStart" INTEGER,
ADD COLUMN     "navLayout" TEXT;

-- AlterTable
ALTER TABLE "deal" ADD COLUMN     "number" SERIAL NOT NULL;

UPDATE "deal" d
SET "number" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS rn
  FROM "deal"
) sub
WHERE d.id = sub.id;

SELECT setval(pg_get_serial_sequence('"deal"', 'number'), COALESCE(MAX("number"), 1), MAX("number") IS NOT NULL) FROM "deal";

-- CreateTable
CREATE TABLE "recent_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "touchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recent_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recent_record_userId_touchedAt_idx" ON "recent_record"("userId", "touchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "recent_record_userId_kind_recordId_key" ON "recent_record"("userId", "kind", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_number_key" ON "deal"("number");

-- AddForeignKey
ALTER TABLE "recent_record" ADD CONSTRAINT "recent_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS "deal_name_trgm_idx" ON "deal" USING GIN ("name" gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "contact_firstName_trgm_idx" ON "contact" USING GIN ("firstName" gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "contact_lastName_trgm_idx" ON "contact" USING GIN ("lastName" gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "contact_companyName_trgm_idx" ON "contact" USING GIN ("companyName" gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "drawing_address_trgm_idx" ON "drawing" USING GIN ("address" gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
