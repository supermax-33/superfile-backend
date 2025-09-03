/*
  Warnings:

  - You are about to drop the column `hashedToken` on the `RefreshToken` table. All the data in the column will be lost.
  - You are about to drop the column `hashedToken` on the `VerificationToken` table. All the data in the column will be lost.
  - Added the required column `refreshToken` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `verificationToken` to the `VerificationToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."RefreshToken" DROP COLUMN "hashedToken",
ADD COLUMN     "refreshToken" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."VerificationToken" DROP COLUMN "hashedToken",
ADD COLUMN     "verificationToken" TEXT NOT NULL;
