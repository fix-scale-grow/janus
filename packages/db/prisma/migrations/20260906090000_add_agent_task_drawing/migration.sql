-- AlterTable
ALTER TABLE "agentTask" ADD COLUMN     "drawingId" TEXT;

-- CreateIndex
CREATE INDEX "agentTask_drawingId_idx" ON "agentTask"("drawingId");
