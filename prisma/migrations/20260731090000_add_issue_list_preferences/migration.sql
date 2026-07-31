CREATE TABLE "IssueListPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contextKey" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IssueListPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IssueListPreference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "IssueListPreference_userId_projectId_surface_kind_contextKey_key"
ON "IssueListPreference"("userId", "projectId", "surface", "kind", "contextKey");

CREATE INDEX "IssueListPreference_userId_projectId_surface_idx"
ON "IssueListPreference"("userId", "projectId", "surface");

CREATE INDEX "IssueListPreference_projectId_idx"
ON "IssueListPreference"("projectId");
