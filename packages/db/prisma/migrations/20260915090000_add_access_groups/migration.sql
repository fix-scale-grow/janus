-- AlterTable
ALTER TABLE "member" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "access_group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surface" TEXT NOT NULL DEFAULT 'FULL',
    "scope" TEXT NOT NULL DEFAULT 'OWN',
    "policy" JSONB NOT NULL,
    "seedKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_group_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_group_name_key" ON "access_group"("name");

-- CreateIndex
CREATE UNIQUE INDEX "access_group_seedKey_key" ON "access_group"("seedKey");

-- CreateIndex
CREATE INDEX "member_groupId_idx" ON "member"("groupId");

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "access_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
