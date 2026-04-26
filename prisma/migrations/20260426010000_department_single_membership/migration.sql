-- Enforce that each user can belong to only one department.
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentMember_userId_key" ON "DepartmentMember"("userId");
