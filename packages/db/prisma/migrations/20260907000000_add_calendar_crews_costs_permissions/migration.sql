-- CreateEnum
CREATE TYPE "JobCostCategory" AS ENUM ('MATERIALS', 'LABOR', 'SUBCONTRACTOR', 'EQUIPMENT', 'PERMITS_FEES', 'OTHER');

-- AlterTable
ALTER TABLE "project_task" ADD COLUMN     "crewId" TEXT,
ADD COLUMN     "endDay" TIMESTAMP(3),
ADD COLUMN     "startDay" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "crew" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_cost" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "category" "JobCostCategory" NOT NULL,
    "note" TEXT,
    "receiptPath" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_cost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_cost_dealId_date_idx" ON "job_cost"("dealId", "date");

-- CreateIndex
CREATE INDEX "job_cost_category_idx" ON "job_cost"("category");

-- CreateIndex
CREATE INDEX "job_cost_date_idx" ON "job_cost"("date");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_userId_key_key" ON "user_permission"("userId", "key");

-- CreateIndex
CREATE INDEX "project_task_projectId_startDay_idx" ON "project_task"("projectId", "startDay");

-- CreateIndex
CREATE INDEX "project_task_crewId_startDay_idx" ON "project_task"("crewId", "startDay");

-- AddForeignKey
ALTER TABLE "project_task" ADD CONSTRAINT "project_task_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "crew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cost" ADD CONSTRAINT "job_cost_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cost" ADD CONSTRAINT "job_cost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission" ADD CONSTRAINT "user_permission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission" ADD CONSTRAINT "user_permission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "project_task" SET "startDay" = "day", "endDay" = "day" WHERE "day" IS NOT NULL;
