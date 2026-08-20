PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "avatar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME,
    "lastActiveAt" DATETIME,
    "activityTrackingStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_User" ("id", "name", "email", "password", "role", "avatar", "createdAt", "updatedAt", "activityTrackingStartedAt")
SELECT "id", "name", "email", "password", "role", "avatar", "createdAt", "updatedAt", CURRENT_TIMESTAMP FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "UserDailyActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "activityDate" TEXT NOT NULL,
    "departmentIdSnapshot" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserDailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserDailyActivity_userId_activityDate_key" ON "UserDailyActivity"("userId", "activityDate");
CREATE INDEX "UserDailyActivity_activityDate_idx" ON "UserDailyActivity"("activityDate");
CREATE INDEX "UserDailyActivity_departmentIdSnapshot_activityDate_idx" ON "UserDailyActivity"("departmentIdSnapshot", "activityDate");
CREATE INDEX "AuditLog_entityType_action_createdAt_idx" ON "AuditLog"("entityType", "action", "createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
