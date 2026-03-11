-- CreateTable
CREATE TABLE "release_likes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,

    CONSTRAINT "release_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "release_likes_userId_idx" ON "release_likes"("userId");

-- CreateIndex
CREATE INDEX "release_likes_releaseId_idx" ON "release_likes"("releaseId");

-- CreateIndex
CREATE UNIQUE INDEX "release_likes_userId_releaseId_key" ON "release_likes"("userId", "releaseId");

-- AddForeignKey
ALTER TABLE "release_likes" ADD CONSTRAINT "release_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_likes" ADD CONSTRAINT "release_likes_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
