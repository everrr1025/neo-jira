CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "mimeType" TEXT,
    "uploaderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileAsset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "FileAsset" ("id", "fileName", "fileUrl", "fileSize", "uploaderId", "createdAt")
SELECT 'legacy-' || "id", "fileName", "fileUrl", 0, "uploaderId", "createdAt"
FROM "Attachment";

CREATE UNIQUE INDEX "FileAsset_fileUrl_key" ON "FileAsset"("fileUrl");
CREATE INDEX "FileAsset_createdAt_idx" ON "FileAsset"("createdAt");
CREATE INDEX "FileAsset_uploaderId_createdAt_idx" ON "FileAsset"("uploaderId", "createdAt");
