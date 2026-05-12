-- Expand department announcements into delivered notifications with per-recipient read state.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "departmentId" TEXT,
    "projectId" TEXT,
    "authorId" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" TEXT,
    "revokedAt" DATETIME,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Announcement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Announcement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Announcement" (
    "id", "level", "title", "content", "status", "departmentId", "projectId", "authorId",
    "isPinned", "sentAt", "createdAt", "updatedAt"
)
SELECT
    "id",
    CASE WHEN "projectId" IS NULL THEN 'DEPARTMENT' ELSE 'PROJECT' END,
    "title",
    "content",
    'SENT',
    "departmentId",
    "projectId",
    "authorId",
    "isPinned",
    "createdAt",
    "createdAt",
    "updatedAt"
FROM "Announcement";

DROP TABLE "Announcement";
ALTER TABLE "new_Announcement" RENAME TO "Announcement";

CREATE UNIQUE INDEX "Announcement_dedupeKey_key" ON "Announcement"("dedupeKey");
CREATE INDEX "Announcement_departmentId_status_createdAt_idx" ON "Announcement"("departmentId", "status", "createdAt");
CREATE INDEX "Announcement_projectId_status_createdAt_idx" ON "Announcement"("projectId", "status", "createdAt");
CREATE INDEX "Announcement_level_createdAt_idx" ON "Announcement"("level", "createdAt");
CREATE INDEX "Announcement_authorId_createdAt_idx" ON "Announcement"("authorId", "createdAt");

CREATE TABLE "AnnouncementReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnouncementReceipt_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnouncementReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnouncementReceipt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT OR IGNORE INTO "AnnouncementReceipt" ("id", "announcementId", "userId", "projectId", "read", "createdAt")
SELECT lower(hex(randomblob(12))), "Announcement"."id", "DepartmentMember"."userId", NULL, false, "Announcement"."createdAt"
FROM "Announcement"
JOIN "DepartmentMember" ON "DepartmentMember"."departmentId" = "Announcement"."departmentId"
WHERE "Announcement"."level" = 'DEPARTMENT';

INSERT OR IGNORE INTO "AnnouncementReceipt" ("id", "announcementId", "userId", "projectId", "read", "createdAt")
SELECT lower(hex(randomblob(12))), "Announcement"."id", "ProjectMember"."userId", "Announcement"."projectId", false, "Announcement"."createdAt"
FROM "Announcement"
JOIN "ProjectMember" ON "ProjectMember"."projectId" = "Announcement"."projectId"
WHERE "Announcement"."level" = 'PROJECT';

CREATE UNIQUE INDEX "AnnouncementReceipt_announcementId_userId_key" ON "AnnouncementReceipt"("announcementId", "userId");
CREATE INDEX "AnnouncementReceipt_userId_read_createdAt_idx" ON "AnnouncementReceipt"("userId", "read", "createdAt");
CREATE INDEX "AnnouncementReceipt_userId_createdAt_idx" ON "AnnouncementReceipt"("userId", "createdAt");
CREATE INDEX "AnnouncementReceipt_projectId_createdAt_idx" ON "AnnouncementReceipt"("projectId", "createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
