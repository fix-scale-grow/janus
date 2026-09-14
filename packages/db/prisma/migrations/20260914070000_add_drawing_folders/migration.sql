-- AlterTable
ALTER TABLE "drawing" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "drawing_folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drawing_folder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drawing_folder_name_key" ON "drawing_folder"("name");

-- CreateIndex
CREATE INDEX "drawing_folderId_idx" ON "drawing"("folderId");

-- AddForeignKey
ALTER TABLE "drawing" ADD CONSTRAINT "drawing_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "drawing_folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

