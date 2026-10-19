ALTER TABLE "FileAsset" ADD COLUMN "projectId" TEXT REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "FileAsset" ADD COLUMN "storageType" TEXT NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "FileAsset" ADD COLUMN "state" TEXT NOT NULL DEFAULT 'READY';
ALTER TABLE "FileAsset" ADD COLUMN "cleanupAfter" DATETIME;
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");
CREATE INDEX "FileAsset_projectId_createdAt_idx" ON "FileAsset"("projectId", "createdAt");
CREATE INDEX "FileAsset_storageType_state_cleanupAfter_idx" ON "FileAsset"("storageType", "state", "cleanupAfter");

CREATE TABLE "KnowledgeItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "parentId" TEXT REFERENCES "KnowledgeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "type" TEXT NOT NULL CHECK ("type" IN ('FOLDER', 'DOCUMENT', 'FILE')),
  "title" TEXT NOT NULL,
  "contentHtml" TEXT NOT NULL DEFAULT '',
  "fileAssetId" TEXT REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "position" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "creatorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "updaterId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "deletedAt" DATETIME,
  "deleteBatchId" TEXT
);
CREATE INDEX "KnowledgeItem_projectId_parentId_deletedAt_idx" ON "KnowledgeItem"("projectId", "parentId", "deletedAt");
CREATE INDEX "KnowledgeItem_projectId_updatedAt_idx" ON "KnowledgeItem"("projectId", "updatedAt");
CREATE INDEX "KnowledgeItem_fileAssetId_idx" ON "KnowledgeItem"("fileAssetId");
CREATE INDEX "KnowledgeItem_deleteBatchId_idx" ON "KnowledgeItem"("deleteBatchId");
CREATE TABLE "KnowledgeAttachment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "documentId" TEXT NOT NULL REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "fileAssetId" TEXT NOT NULL REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "usage" TEXT NOT NULL CHECK ("usage" IN ('INLINE', 'ATTACHMENT')),
  "displayName" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "KnowledgeAttachment_fileAssetId_idx" ON "KnowledgeAttachment"("fileAssetId");
CREATE UNIQUE INDEX "KnowledgeAttachment_documentId_fileAssetId_usage_key" ON "KnowledgeAttachment"("documentId", "fileAssetId", "usage");
