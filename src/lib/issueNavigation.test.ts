import assert from "node:assert/strict";
import { buildIssueDetailHref, resolveIssueReturnTo } from "./issueNavigation";

assert.equal(
  buildIssueDetailHref("issue-1", "/iterations/sprint-1?layout=list&page=2"),
  "/issues/issue-1?returnTo=%2Fiterations%2Fsprint-1%3Flayout%3Dlist%26page%3D2"
);

assert.equal(
  buildIssueDetailHref(
    "issue-1",
    "/departments/department-1/projects/project-1/iterations/sprint-1?layout=list",
  ),
  "/departments/department-1/projects/project-1/issues/issue-1?returnTo=%2Fdepartments%2Fdepartment-1%2Fprojects%2Fproject-1%2Fiterations%2Fsprint-1%3Flayout%3Dlist",
);

assert.equal(
  resolveIssueReturnTo("/iterations/sprint-1?layout=list&page=2"),
  "/iterations/sprint-1?layout=list&page=2"
);
assert.equal(resolveIssueReturnTo("/plans/plan-1?page=3"), "/plans/plan-1?page=3");
assert.equal(resolveIssueReturnTo("/issues?status=OPEN"), "/issues?status=OPEN");
assert.equal(
  resolveIssueReturnTo("/departments/department-1/projects/project-1/plans/plan-1?page=3"),
  "/departments/department-1/projects/project-1/plans/plan-1?page=3",
);
assert.equal(resolveIssueReturnTo("https://example.com"), "/issues");
assert.equal(resolveIssueReturnTo("//example.com"), "/issues");
assert.equal(resolveIssueReturnTo("/settings"), "/issues");
assert.equal(resolveIssueReturnTo(null), "/issues");
