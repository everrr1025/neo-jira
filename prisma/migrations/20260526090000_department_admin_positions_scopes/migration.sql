-- Add department-admin, position, managed-project, and department-task scope data.
ALTER TABLE "DepartmentMember" ADD COLUMN "isDepartmentAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DepartmentMember" ADD COLUMN "positionId" TEXT;
ALTER TABLE "DepartmentMember" ADD COLUMN "projectScopeType" TEXT NOT NULL DEFAULT 'NONE';

UPDATE "DepartmentMember"
SET "isDepartmentAdmin" = true
WHERE "role" IN ('HEAD', 'ASSISTANT');

CREATE TABLE "DepartmentPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DepartmentPosition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DepartmentMemberManagedProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentMemberId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentMemberManagedProject_departmentMemberId_fkey" FOREIGN KEY ("departmentMemberId") REFERENCES "DepartmentMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepartmentMemberManagedProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepartmentMemberManagedProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DepartmentMemberTaskAssigneeScope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentMemberId" TEXT NOT NULL,
    "assigneeUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentMemberTaskAssigneeScope_departmentMemberId_fkey" FOREIGN KEY ("departmentMemberId") REFERENCES "DepartmentMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepartmentMemberTaskAssigneeScope_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DepartmentPosition_departmentId_name_key" ON "DepartmentPosition"("departmentId", "name");
CREATE INDEX "DepartmentPosition_departmentId_sortOrder_idx" ON "DepartmentPosition"("departmentId", "sortOrder");
CREATE INDEX "DepartmentMember_departmentId_isDepartmentAdmin_idx" ON "DepartmentMember"("departmentId", "isDepartmentAdmin");
CREATE INDEX "DepartmentMember_positionId_idx" ON "DepartmentMember"("positionId");
CREATE UNIQUE INDEX "DepartmentMemberManagedProject_projectId_key" ON "DepartmentMemberManagedProject"("projectId");
CREATE UNIQUE INDEX "DepartmentMemberManagedProject_departmentMemberId_projectId_key" ON "DepartmentMemberManagedProject"("departmentMemberId", "projectId");
CREATE INDEX "DepartmentMemberManagedProject_departmentMemberId_idx" ON "DepartmentMemberManagedProject"("departmentMemberId");
CREATE INDEX "DepartmentMemberManagedProject_userId_idx" ON "DepartmentMemberManagedProject"("userId");
CREATE UNIQUE INDEX "DepartmentMemberTaskAssigneeScope_departmentMemberId_assigneeUserId_key" ON "DepartmentMemberTaskAssigneeScope"("departmentMemberId", "assigneeUserId");
CREATE INDEX "DepartmentMemberTaskAssigneeScope_departmentMemberId_idx" ON "DepartmentMemberTaskAssigneeScope"("departmentMemberId");
CREATE INDEX "DepartmentMemberTaskAssigneeScope_assigneeUserId_idx" ON "DepartmentMemberTaskAssigneeScope"("assigneeUserId");
