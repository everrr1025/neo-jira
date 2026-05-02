ALTER TABLE "Note" ADD COLUMN "deletedAt" DATETIME;

CREATE INDEX "Note_authorId_deletedAt_idx" ON "Note"("authorId", "deletedAt");
