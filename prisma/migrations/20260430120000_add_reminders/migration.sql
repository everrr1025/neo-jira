-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME,
    "remindAt" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "scopeType" TEXT NOT NULL DEFAULT 'PERSONAL',
    "departmentId" TEXT,
    "projectId" TEXT,
    "issueId" TEXT,
    "creatorId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reminder_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reminder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reminder_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reminder_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reminder_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Reminder_creatorId_startAt_idx" ON "Reminder"("creatorId", "startAt");

-- CreateIndex
CREATE INDEX "Reminder_assigneeId_startAt_idx" ON "Reminder"("assigneeId", "startAt");

-- CreateIndex
CREATE INDEX "Reminder_departmentId_startAt_idx" ON "Reminder"("departmentId", "startAt");

-- CreateIndex
CREATE INDEX "Reminder_projectId_startAt_idx" ON "Reminder"("projectId", "startAt");

-- CreateIndex
CREATE INDEX "Reminder_issueId_idx" ON "Reminder"("issueId");
