-- CreateTable
CREATE TABLE "ProjectWorkflowStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectWorkflowStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectWorkflowTransition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "fromStatusId" TEXT NOT NULL,
    "toStatusId" TEXT NOT NULL,
    CONSTRAINT "ProjectWorkflowTransition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectWorkflowTransition_fromStatusId_fkey" FOREIGN KEY ("fromStatusId") REFERENCES "ProjectWorkflowStatus" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectWorkflowTransition_toStatusId_fkey" FOREIGN KEY ("toStatusId") REFERENCES "ProjectWorkflowStatus" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProjectWorkflowStatus_projectId_category_position_idx" ON "ProjectWorkflowStatus"("projectId", "category", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectWorkflowStatus_projectId_key_key" ON "ProjectWorkflowStatus"("projectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectWorkflowStatus_projectId_position_key" ON "ProjectWorkflowStatus"("projectId", "position");

-- CreateIndex
CREATE INDEX "ProjectWorkflowTransition_projectId_fromStatusId_idx" ON "ProjectWorkflowTransition"("projectId", "fromStatusId");

-- CreateIndex
CREATE INDEX "ProjectWorkflowTransition_projectId_toStatusId_idx" ON "ProjectWorkflowTransition"("projectId", "toStatusId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectWorkflowTransition_projectId_fromStatusId_toStatusId_key" ON "ProjectWorkflowTransition"("projectId", "fromStatusId", "toStatusId");

-- Seed default workflow template for existing projects
INSERT INTO "ProjectWorkflowStatus" ("id", "projectId", "key", "name", "category", "position", "isInitial", "createdAt", "updatedAt")
SELECT "id" || '_wf_todo', "id", 'TODO', 'TODO', 'TODO', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Project";

INSERT INTO "ProjectWorkflowStatus" ("id", "projectId", "key", "name", "category", "position", "isInitial", "createdAt", "updatedAt")
SELECT "id" || '_wf_in_progress', "id", 'IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS', 1, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Project";

INSERT INTO "ProjectWorkflowStatus" ("id", "projectId", "key", "name", "category", "position", "isInitial", "createdAt", "updatedAt")
SELECT "id" || '_wf_in_testing', "id", 'IN_TESTING', 'IN_TESTING', 'IN_PROGRESS', 2, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Project";

INSERT INTO "ProjectWorkflowStatus" ("id", "projectId", "key", "name", "category", "position", "isInitial", "createdAt", "updatedAt")
SELECT "id" || '_wf_done', "id", 'DONE', 'DONE', 'DONE', 3, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Project";

INSERT INTO "ProjectWorkflowTransition" ("id", "projectId", "fromStatusId", "toStatusId")
SELECT "id" || '_wf_todo_to_in_progress', "id", "id" || '_wf_todo', "id" || '_wf_in_progress'
FROM "Project";

INSERT INTO "ProjectWorkflowTransition" ("id", "projectId", "fromStatusId", "toStatusId")
SELECT "id" || '_wf_in_progress_to_todo', "id", "id" || '_wf_in_progress', "id" || '_wf_todo'
FROM "Project";

INSERT INTO "ProjectWorkflowTransition" ("id", "projectId", "fromStatusId", "toStatusId")
SELECT "id" || '_wf_in_progress_to_in_testing', "id", "id" || '_wf_in_progress', "id" || '_wf_in_testing'
FROM "Project";

INSERT INTO "ProjectWorkflowTransition" ("id", "projectId", "fromStatusId", "toStatusId")
SELECT "id" || '_wf_in_progress_to_done', "id", "id" || '_wf_in_progress', "id" || '_wf_done'
FROM "Project";

INSERT INTO "ProjectWorkflowTransition" ("id", "projectId", "fromStatusId", "toStatusId")
SELECT "id" || '_wf_in_testing_to_in_progress', "id", "id" || '_wf_in_testing', "id" || '_wf_in_progress'
FROM "Project";

INSERT INTO "ProjectWorkflowTransition" ("id", "projectId", "fromStatusId", "toStatusId")
SELECT "id" || '_wf_in_testing_to_done', "id", "id" || '_wf_in_testing', "id" || '_wf_done'
FROM "Project";

INSERT INTO "ProjectWorkflowTransition" ("id", "projectId", "fromStatusId", "toStatusId")
SELECT "id" || '_wf_done_to_in_progress', "id", "id" || '_wf_done', "id" || '_wf_in_progress'
FROM "Project";
