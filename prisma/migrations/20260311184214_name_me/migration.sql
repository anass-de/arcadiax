-- CreateEnum
CREATE TYPE "UserMediaType" AS ENUM ('IMAGE', 'VIDEO', 'FILE');

-- CreateTable
CREATE TABLE "user_media" (
    "id" TEXT NOT NULL,
    "type" "UserMediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "user_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_media_authorId_idx" ON "user_media"("authorId");

-- CreateIndex
CREATE INDEX "user_media_type_idx" ON "user_media"("type");

-- CreateIndex
CREATE INDEX "user_media_createdAt_idx" ON "user_media"("createdAt");

-- AddForeignKey
ALTER TABLE "user_media" ADD CONSTRAINT "user_media_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
