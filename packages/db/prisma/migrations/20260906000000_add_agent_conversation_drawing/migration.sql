-- AlterTable
ALTER TABLE "agentConversation" ADD COLUMN     "drawingId" TEXT;

-- CreateIndex
CREATE INDEX "agentConversation_drawingId_lastMessageAt_idx" ON "agentConversation"("drawingId", "lastMessageAt");

-- AddForeignKey
ALTER TABLE "agentConversation" ADD CONSTRAINT "agentConversation_drawingId_fkey" FOREIGN KEY ("drawingId") REFERENCES "drawing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
