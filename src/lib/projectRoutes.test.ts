import assert from "node:assert/strict";

import {
  getLegacyProjectDestination,
  getProjectPath,
  parseProjectPath,
} from "./projectRoutes";

const basePath = "/departments/department-1/projects/project-1";

assert.equal(getProjectPath("department-1", "project-1"), basePath);
assert.equal(
  getProjectPath("department-1", "project-1", "issues", "issue-1"),
  `${basePath}/issues/issue-1`,
);
assert.deepEqual(parseProjectPath(`${basePath}/plans/plan-1`), {
  departmentId: "department-1",
  projectId: "project-1",
  section: "plans",
  entityId: "plan-1",
});
assert.equal(getLegacyProjectDestination(basePath), "/");
assert.equal(getLegacyProjectDestination(`${basePath}/iterations/sprint-1`), "/iterations/sprint-1");
assert.equal(getLegacyProjectDestination("/departments/department-1/items"), null);

