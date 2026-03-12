/*
  Warnings:

  - You are about to drop the `user_media` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_media" DROP CONSTRAINT "user_media_authorId_fkey";

-- DropTable
DROP TABLE "user_media";

-- DropEnum
DROP TYPE "UserMediaType";
