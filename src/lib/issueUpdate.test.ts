import assert from "node:assert/strict";

import { getEditableIssueUpdate } from "./issueUpdate";

const editable = getEditableIssueUpdate({
  title: "Updated title",
  status: "IN_PROGRESS",
  planId: null,
});

assert.deepEqual(editable, {
  title: "Updated title",
  status: "IN_PROGRESS",
  planId: null,
});

assert.throws(
  () => getEditableIssueUpdate({ projectId: "another-project" }),
  /Unsupported issue field: projectId/,
);
assert.throws(
  () => getEditableIssueUpdate({ reporterId: "another-user" }),
  /Unsupported issue field: reporterId/,
);
assert.throws(() => getEditableIssueUpdate(null), /Invalid issue update/);

console.log("issueUpdate tests passed");
