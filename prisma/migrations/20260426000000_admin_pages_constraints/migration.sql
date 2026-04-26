-- Allow projects to continue existing after their owner account is deleted.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT,
    "departmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Project" ("createdAt", "departmentId", "description", "id", "key", "name", "ownerId", "updatedAt")
SELECT "createdAt", "departmentId", "description", "id", "key", "name", "ownerId", "updatedAt" FROM "Project";

DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_key_key" ON "Project"("key");

CREATE UNIQUE INDEX IF NOT EXISTS "Department_name_key" ON "Department"("name");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
