ALTER TABLE "Issue" ADD COLUMN "parentIssueId" TEXT REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Issue_parentIssueId_idx" ON "Issue"("parentIssueId");
