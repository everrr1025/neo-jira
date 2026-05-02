CREATE TABLE "NoteFolder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "ownerId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "NoteFolder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Note" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "authorId" TEXT NOT NULL,
  "folderId" TEXT,
  "departmentId" TEXT,
  "projectId" TEXT,
  "issueId" TEXT,
  "taskId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Note_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "NoteFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Note_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Note_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Note_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Reminder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NoteFolder_ownerId_name_key" ON "NoteFolder"("ownerId", "name");
CREATE INDEX "NoteFolder_ownerId_position_idx" ON "NoteFolder"("ownerId", "position");
CREATE INDEX "Note_authorId_updatedAt_idx" ON "Note"("authorId", "updatedAt");
CREATE INDEX "Note_departmentId_updatedAt_idx" ON "Note"("departmentId", "updatedAt");
CREATE INDEX "Note_folderId_updatedAt_idx" ON "Note"("folderId", "updatedAt");
CREATE INDEX "Note_projectId_idx" ON "Note"("projectId");
CREATE INDEX "Note_issueId_idx" ON "Note"("issueId");
CREATE INDEX "Note_taskId_idx" ON "Note"("taskId");
