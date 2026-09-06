-- CreateTable
CREATE TABLE "agent_usage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conversationId" TEXT,
    "taskKind" TEXT,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_usage_createdAt_idx" ON "agent_usage"("createdAt");

-- CreateIndex
CREATE INDEX "agent_usage_sessionId_idx" ON "agent_usage"("sessionId");
