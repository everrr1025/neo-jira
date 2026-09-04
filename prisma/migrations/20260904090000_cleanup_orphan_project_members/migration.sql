UPDATE "Project"
SET "ownerId" = NULL
WHERE "departmentId" IS NOT NULL
  AND "ownerId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "DepartmentMember"
    WHERE "DepartmentMember"."departmentId" = "Project"."departmentId"
      AND "DepartmentMember"."userId" = "Project"."ownerId"
  );

DELETE FROM "ProjectMember"
WHERE EXISTS (
  SELECT 1
  FROM "Project"
  WHERE "Project"."id" = "ProjectMember"."projectId"
    AND "Project"."departmentId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "DepartmentMember"
      WHERE "DepartmentMember"."departmentId" = "Project"."departmentId"
        AND "DepartmentMember"."userId" = "ProjectMember"."userId"
    )
);
