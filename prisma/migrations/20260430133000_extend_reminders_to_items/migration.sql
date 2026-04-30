-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN "itemType" TEXT NOT NULL DEFAULT 'REMINDER';

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN "isImportant" BOOLEAN NOT NULL DEFAULT false;
