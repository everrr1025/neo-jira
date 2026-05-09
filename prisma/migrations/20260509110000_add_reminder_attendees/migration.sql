CREATE TABLE "ReminderAttendee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reminderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReminderAttendee_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReminderAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReminderAttendee_reminderId_userId_key" ON "ReminderAttendee"("reminderId", "userId");
CREATE INDEX "ReminderAttendee_userId_status_idx" ON "ReminderAttendee"("userId", "status");
CREATE INDEX "ReminderAttendee_reminderId_status_idx" ON "ReminderAttendee"("reminderId", "status");
