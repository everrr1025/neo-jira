-- Existing plans whose start date is still in the future become planned.
-- Started and overdue plans remain active; completion must be explicit.
UPDATE "Plan"
SET "status" = 'PLANNED'
WHERE "status" = 'ACTIVE'
  AND "startDate" > (CAST(strftime('%s', 'now') AS INTEGER) * 1000);

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "targetCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "projectId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Plan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Plan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Plan" ("createdAt", "description", "endDate", "id", "name", "ownerId", "projectId", "startDate", "status", "targetCount", "updatedAt")
SELECT "createdAt", "description", "endDate", "id", "name", "ownerId", "projectId", "startDate", "status", "targetCount", "updatedAt" FROM "Plan";
DROP TABLE "Plan";
ALTER TABLE "new_Plan" RENAME TO "Plan";
CREATE INDEX "Plan_projectId_status_idx" ON "Plan"("projectId", "status");
CREATE INDEX "Plan_ownerId_idx" ON "Plan"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
