/*
  Warnings:

  - You are about to drop the column `hashedToken` on the `PasswordResetToken` table. All the data in the column will be lost.
  - Added the required column `resetToken` to the `PasswordResetToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."PasswordResetToken" DROP COLUMN "hashedToken",
ADD COLUMN     "resetToken" TEXT NOT NULL;
