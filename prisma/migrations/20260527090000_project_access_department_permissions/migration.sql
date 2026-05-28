-- Split department project access, task assignment, and announcement scopes.
ALTER TABLE "DepartmentMember" ADD COLUMN "taskProjectScopeType" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "DepartmentMember" ADD COLUMN "canCreateDepartmentAnnouncements" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DepartmentMember" ADD COLUMN "announcementProjectScopeType" TEXT NOT NULL DEFAULT 'NONE';

DROP INDEX IF EXISTS "DepartmentMemberManagedProject_projectId_key";

CREATE TABLE "DepartmentMemberTaskPositionScope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentMemberId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentMemberTaskPositionScope_departmentMemberId_fkey" FOREIGN KEY ("departmentMemberId") REFERENCES "DepartmentMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepartmentMemberTaskPositionScope_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "DepartmentPosition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DepartmentMemberTaskProjectScope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentMemberId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentMemberTaskProjectScope_departmentMemberId_fkey" FOREIGN KEY ("departmentMemberId") REFERENCES "DepartmentMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepartmentMemberTaskProjectScope_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DepartmentMemberAnnouncementProjectScope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentMemberId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentMemberAnnouncementProjectScope_departmentMemberId_fkey" FOREIGN KEY ("departmentMemberId") REFERENCES "DepartmentMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepartmentMemberAnnouncementProjectScope_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DepartmentMemberTaskPositionScope_departmentMemberId_positionId_key" ON "DepartmentMemberTaskPositionScope"("departmentMemberId", "positionId");
CREATE INDEX "DepartmentMemberTaskPositionScope_departmentMemberId_idx" ON "DepartmentMemberTaskPositionScope"("departmentMemberId");
CREATE INDEX "DepartmentMemberTaskPositionScope_positionId_idx" ON "DepartmentMemberTaskPositionScope"("positionId");
CREATE UNIQUE INDEX "DepartmentMemberTaskProjectScope_departmentMemberId_projectId_key" ON "DepartmentMemberTaskProjectScope"("departmentMemberId", "projectId");
CREATE INDEX "DepartmentMemberTaskProjectScope_departmentMemberId_idx" ON "DepartmentMemberTaskProjectScope"("departmentMemberId");
CREATE INDEX "DepartmentMemberTaskProjectScope_projectId_idx" ON "DepartmentMemberTaskProjectScope"("projectId");
CREATE UNIQUE INDEX "DepartmentMemberAnnouncementProjectScope_departmentMemberId_projectId_key" ON "DepartmentMemberAnnouncementProjectScope"("departmentMemberId", "projectId");
CREATE INDEX "DepartmentMemberAnnouncementProjectScope_departmentMemberId_idx" ON "DepartmentMemberAnnouncementProjectScope"("departmentMemberId");
CREATE INDEX "DepartmentMemberAnnouncementProjectScope_projectId_idx" ON "DepartmentMemberAnnouncementProjectScope"("projectId");

UPDATE "DepartmentMember"
SET
  "taskProjectScopeType" = CASE
    WHEN "isDepartmentAdmin" = true OR "projectScopeType" = 'ALL_PROJECTS' THEN 'ALL_PROJECTS'
    WHEN "projectScopeType" = 'SELECTED_PROJECTS' THEN 'SELECTED_PROJECTS'
    ELSE 'NONE'
  END,
  "canCreateDepartmentAnnouncements" = CASE WHEN "isDepartmentAdmin" = true THEN true ELSE false END,
  "announcementProjectScopeType" = CASE
    WHEN "isDepartmentAdmin" = true OR "projectScopeType" = 'ALL_PROJECTS' THEN 'ALL_PROJECTS'
    WHEN "projectScopeType" = 'SELECTED_PROJECTS' THEN 'SELECTED_PROJECTS'
    ELSE 'NONE'
  END;

INSERT OR IGNORE INTO "DepartmentMemberTaskProjectScope" ("id", "departmentMemberId", "projectId")
SELECT lower(hex(randomblob(12))), "departmentMemberId", "projectId"
FROM "DepartmentMemberManagedProject";

INSERT OR IGNORE INTO "DepartmentMemberAnnouncementProjectScope" ("id", "departmentMemberId", "projectId")
SELECT lower(hex(randomblob(12))), "departmentMemberId", "projectId"
FROM "DepartmentMemberManagedProject";
