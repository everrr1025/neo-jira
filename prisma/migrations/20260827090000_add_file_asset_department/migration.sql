ALTER TABLE "FileAsset" ADD COLUMN "departmentId" TEXT REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "FileAsset"
SET "departmentId" = (
    SELECT "Project"."departmentId"
    FROM "Attachment"
    JOIN "Issue" ON "Issue"."id" = "Attachment"."issueId"
    JOIN "Project" ON "Project"."id" = "Issue"."projectId"
    WHERE "Attachment"."fileUrl" = "FileAsset"."fileUrl"
      AND "Project"."departmentId" IS NOT NULL
    LIMIT 1
)
WHERE "departmentId" IS NULL;

UPDATE "FileAsset"
SET "departmentId" = (
    SELECT "DepartmentMember"."departmentId"
    FROM "DepartmentMember"
    WHERE "DepartmentMember"."userId" = "FileAsset"."uploaderId"
    LIMIT 1
)
WHERE "departmentId" IS NULL
  AND "uploaderId" IS NOT NULL;

CREATE INDEX "FileAsset_departmentId_createdAt_idx" ON "FileAsset"("departmentId", "createdAt");
