-- CreateTable
CREATE TABLE "PlanFieldDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "optionsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanFieldDefinition_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanIssueFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "valueBoolean" BOOLEAN,
    "valueNumber" REAL,
    "valueText" TEXT,
    "valueOption" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanIssueFieldValue_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanIssueFieldValue_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanIssueFieldValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "PlanFieldDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanFieldDefinition_planId_key_key" ON "PlanFieldDefinition"("planId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PlanFieldDefinition_planId_position_key" ON "PlanFieldDefinition"("planId", "position");

-- CreateIndex
CREATE INDEX "PlanFieldDefinition_planId_position_idx" ON "PlanFieldDefinition"("planId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PlanIssueFieldValue_planId_issueId_fieldDefinitionId_key" ON "PlanIssueFieldValue"("planId", "issueId", "fieldDefinitionId");

-- CreateIndex
CREATE INDEX "PlanIssueFieldValue_planId_fieldDefinitionId_idx" ON "PlanIssueFieldValue"("planId", "fieldDefinitionId");

-- CreateIndex
CREATE INDEX "PlanIssueFieldValue_issueId_idx" ON "PlanIssueFieldValue"("issueId");
