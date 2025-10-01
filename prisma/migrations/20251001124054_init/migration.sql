-- CreateEnum
CREATE TYPE "public"."AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "public"."FileStatus" AS ENUM ('processing', 'available', 'failed');

-- CreateEnum
CREATE TYPE "public"."ConversationRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "provider" "public"."AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "providerId" TEXT,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verificationToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resetToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Space" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vectorStoreId" VARCHAR(255),

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SpaceLogo" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "data" BYTEA,
    "contentType" VARCHAR(255),
    "hash" VARCHAR(64),

    CONSTRAINT "SpaceLogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "previousTokenHash" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."File" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "filename" VARCHAR(1024) NOT NULL,
    "mimetype" VARCHAR(255) NOT NULL,
    "size" BIGINT NOT NULL,
    "status" "public"."FileStatus" NOT NULL DEFAULT 'processing',
    "s3Key" VARCHAR(2048) NOT NULL,
    "vectorStoreId" VARCHAR(255),
    "openAiFileId" VARCHAR(255),
    "error" VARCHAR(2000),
    "note" VARCHAR(2000),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FileShare" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "note" VARCHAR(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Conversation" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "title" VARCHAR(255),
    "manuallyRenamed" BOOLEAN NOT NULL DEFAULT false,
    "autoTitleGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "public"."ConversationRole" NOT NULL DEFAULT 'USER',
    "content" VARCHAR(8000) NOT NULL,
    "references" JSONB,
    "actions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Reminder" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_FileToReminder" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FileToReminder_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_ConversationMessageToReminder" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ConversationMessageToReminder_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_providerId_key" ON "public"."User"("providerId");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_idx" ON "public"."VerificationToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "public"."PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Space_slug_key" ON "public"."Space"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Space_vectorStoreId_key" ON "public"."Space"("vectorStoreId");

-- CreateIndex
CREATE INDEX "Space_ownerId_idx" ON "public"."Space"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "SpaceLogo_spaceId_key" ON "public"."SpaceLogo"("spaceId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE INDEX "File_spaceId_status_idx" ON "public"."File"("spaceId", "status");

-- CreateIndex
CREATE INDEX "File_spaceId_uploadedAt_idx" ON "public"."File"("spaceId", "uploadedAt");

-- CreateIndex
CREATE INDEX "File_spaceId_openAiFileId_idx" ON "public"."File"("spaceId", "openAiFileId");

-- CreateIndex
CREATE UNIQUE INDEX "FileShare_shareToken_key" ON "public"."FileShare"("shareToken");

-- CreateIndex
CREATE INDEX "FileShare_fileId_spaceId_idx" ON "public"."FileShare"("fileId", "spaceId");

-- CreateIndex
CREATE INDEX "FileShare_spaceId_idx" ON "public"."FileShare"("spaceId");

-- CreateIndex
CREATE INDEX "Conversation_spaceId_createdAt_idx" ON "public"."Conversation"("spaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "public"."ConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Reminder_spaceId_remindAt_idx" ON "public"."Reminder"("spaceId", "remindAt");

-- CreateIndex
CREATE INDEX "_FileToReminder_B_index" ON "public"."_FileToReminder"("B");

-- CreateIndex
CREATE INDEX "_ConversationMessageToReminder_B_index" ON "public"."_ConversationMessageToReminder"("B");

-- AddForeignKey
ALTER TABLE "public"."VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Space" ADD CONSTRAINT "Space_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpaceLogo" ADD CONSTRAINT "SpaceLogo_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "public"."Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."File" ADD CONSTRAINT "File_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "public"."Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FileShare" ADD CONSTRAINT "FileShare_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FileShare" ADD CONSTRAINT "FileShare_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "public"."Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "public"."Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reminder" ADD CONSTRAINT "Reminder_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "public"."Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_FileToReminder" ADD CONSTRAINT "_FileToReminder_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_FileToReminder" ADD CONSTRAINT "_FileToReminder_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ConversationMessageToReminder" ADD CONSTRAINT "_ConversationMessageToReminder_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."ConversationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ConversationMessageToReminder" ADD CONSTRAINT "_ConversationMessageToReminder_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
