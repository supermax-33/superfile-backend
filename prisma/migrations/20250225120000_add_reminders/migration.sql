-- CreateTable
CREATE TABLE "public"."Reminder" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_ReminderFiles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ReminderFiles_AB_unique" ON "public"."_ReminderFiles"("A", "B");

-- CreateIndex
CREATE INDEX "_ReminderFiles_B_index" ON "public"."_ReminderFiles"("B");

-- AddForeignKey
ALTER TABLE "public"."Reminder" ADD CONSTRAINT "Reminder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ReminderFiles" ADD CONSTRAINT "_ReminderFiles_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ReminderFiles" ADD CONSTRAINT "_ReminderFiles_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
