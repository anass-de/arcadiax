-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Release" DROP CONSTRAINT "Release_authorId_fkey";

-- DropIndex
DROP INDEX "Account_userId_idx";

-- DropIndex
DROP INDEX "Comment_authorId_createdAt_idx";

-- DropIndex
DROP INDEX "Release_authorId_idx";

-- DropIndex
DROP INDEX "Release_createdAt_idx";

-- DropIndex
DROP INDEX "Session_expires_idx";

-- DropIndex
DROP INDEX "Session_userId_idx";

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
