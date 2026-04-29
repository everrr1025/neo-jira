-- Add project-level issue custom fields.
CREATE TABLE "IssueFieldDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "optionsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IssueFieldDefinition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "IssueFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "valueBoolean" BOOLEAN,
    "valueNumber" REAL,
    "valueText" TEXT,
    "valueOption" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IssueFieldValue_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IssueFieldValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "IssueFieldDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "IssueFieldDefinition_projectId_key_key" ON "IssueFieldDefinition"("projectId", "key");

CREATE UNIQUE INDEX "IssueFieldDefinition_projectId_position_key" ON "IssueFieldDefinition"("projectId", "position");

CREATE INDEX "IssueFieldDefinition_projectId_position_idx" ON "IssueFieldDefinition"("projectId", "position");

CREATE UNIQUE INDEX "IssueFieldValue_issueId_fieldDefinitionId_key" ON "IssueFieldValue"("issueId", "fieldDefinitionId");

CREATE INDEX "IssueFieldValue_fieldDefinitionId_idx" ON "IssueFieldValue"("fieldDefinitionId");
