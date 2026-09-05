-- CreateEnum
CREATE TYPE "DrawingBackground" AS ENUM ('WHITEBOARD', 'IMAGE', 'SATELLITE');

-- CreateTable
CREATE TABLE "drawing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled drawing',
    "background" "DrawingBackground" NOT NULL DEFAULT 'WHITEBOARD',
    "scene" JSONB NOT NULL,
    "scale" JSONB,
    "address" TEXT,
    "thumbnailUrl" TEXT,
    "dealId" TEXT,
    "contactId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drawing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawing_version" (
    "id" TEXT NOT NULL,
    "drawingId" TEXT NOT NULL,
    "scene" JSONB NOT NULL,
    "scale" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drawing_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drawing_dealId_idx" ON "drawing"("dealId");

-- CreateIndex
CREATE INDEX "drawing_contactId_idx" ON "drawing"("contactId");

-- CreateIndex
CREATE INDEX "drawing_updatedAt_idx" ON "drawing"("updatedAt");

-- CreateIndex
CREATE INDEX "drawing_version_drawingId_createdAt_idx" ON "drawing_version"("drawingId", "createdAt");

-- AddForeignKey
ALTER TABLE "drawing" ADD CONSTRAINT "drawing_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing" ADD CONSTRAINT "drawing_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing" ADD CONSTRAINT "drawing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_version" ADD CONSTRAINT "drawing_version_drawingId_fkey" FOREIGN KEY ("drawingId") REFERENCES "drawing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
