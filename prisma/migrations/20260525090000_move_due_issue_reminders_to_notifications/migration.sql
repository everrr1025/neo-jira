-- Move issue due reminders from department announcements into personal notifications.

ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;

INSERT OR IGNORE INTO "Notification" (
    "id", "type", "message", "link", "dedupeKey", "read", "userId", "actorId", "createdAt"
)
SELECT
    lower(hex(randomblob(12))),
    'ISSUE_DUE',
    "Announcement"."title",
    '/issues/' || substr(
        "Announcement"."dedupeKey",
        length('issue-due:') + 1,
        instr(substr("Announcement"."dedupeKey", length('issue-due:') + 1), ':') - 1
    ),
    "Announcement"."dedupeKey" || ':' || "AnnouncementReceipt"."userId",
    "AnnouncementReceipt"."read",
    "AnnouncementReceipt"."userId",
    NULL,
    "Announcement"."createdAt"
FROM "Announcement"
JOIN "AnnouncementReceipt" ON "AnnouncementReceipt"."announcementId" = "Announcement"."id"
WHERE "Announcement"."level" = 'SYSTEM'
  AND "Announcement"."dedupeKey" LIKE 'issue-due:%';

DELETE FROM "Announcement"
WHERE "level" = 'SYSTEM'
  AND "dedupeKey" LIKE 'issue-due:%';

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
