ALTER TABLE "AuditLog" ADD COLUMN "actorNameSnapshot" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "actorEmailSnapshot" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "targetNameSnapshot" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "targetKeySnapshot" TEXT;

UPDATE "AuditLog"
SET
  "actorNameSnapshot" = (
    SELECT COALESCE("User"."name", "User"."email")
    FROM "User"
    WHERE "User"."id" = "AuditLog"."actorId"
  ),
  "actorEmailSnapshot" = (
    SELECT "User"."email"
    FROM "User"
    WHERE "User"."id" = "AuditLog"."actorId"
  ),
  "targetNameSnapshot" = COALESCE(
    CASE "AuditLog"."entityType"
      WHEN 'USER' THEN (SELECT COALESCE("User"."name", "User"."email") FROM "User" WHERE "User"."id" = "AuditLog"."entityId")
      WHEN 'DEPARTMENT' THEN (SELECT "Department"."name" FROM "Department" WHERE "Department"."id" = "AuditLog"."entityId")
      WHEN 'PROJECT' THEN (SELECT "Project"."name" FROM "Project" WHERE "Project"."id" = "AuditLog"."entityId")
    END,
    json_extract("AuditLog"."metadata", '$.name'),
    json_extract("AuditLog"."metadata", '$.email')
  ),
  "targetKeySnapshot" = COALESCE(
    CASE "AuditLog"."entityType"
      WHEN 'USER' THEN (SELECT "User"."email" FROM "User" WHERE "User"."id" = "AuditLog"."entityId")
      WHEN 'DEPARTMENT' THEN (SELECT "Department"."key" FROM "Department" WHERE "Department"."id" = "AuditLog"."entityId")
      WHEN 'PROJECT' THEN (SELECT "Project"."key" FROM "Project" WHERE "Project"."id" = "AuditLog"."entityId")
    END,
    json_extract("AuditLog"."metadata", '$.key'),
    json_extract("AuditLog"."metadata", '$.email')
  );
