import assert from "node:assert/strict";
import {
  canNestIssueType,
  getAllowedChildIssueTypes,
  wouldCreateIssueHierarchyCycle,
} from "./issueHierarchy";

assert.deepEqual(getAllowedChildIssueTypes("EPIC"), ["STORY", "TASK", "BUG"]);
assert.deepEqual(getAllowedChildIssueTypes("STORY"), ["TASK", "BUG"]);
assert.deepEqual(getAllowedChildIssueTypes("TASK"), ["BUG"]);
assert.deepEqual(getAllowedChildIssueTypes("BUG"), []);

assert.equal(canNestIssueType("EPIC", "STORY"), true);
assert.equal(canNestIssueType("EPIC", "TASK"), true);
assert.equal(canNestIssueType("EPIC", "BUG"), true);
assert.equal(canNestIssueType("STORY", "TASK"), true);
assert.equal(canNestIssueType("STORY", "BUG"), true);
assert.equal(canNestIssueType("TASK", "BUG"), true);

assert.equal(canNestIssueType("TASK", "TASK"), false);
assert.equal(canNestIssueType("BUG", "BUG"), false);
assert.equal(canNestIssueType("STORY", "EPIC"), false);
assert.equal(canNestIssueType("UNKNOWN", "TASK"), false);

assert.equal(wouldCreateIssueHierarchyCycle("issue-1", ["issue-2", "issue-3"]), false);
assert.equal(wouldCreateIssueHierarchyCycle("issue-1", ["issue-2", "issue-1"]), true);
assert.equal(wouldCreateIssueHierarchyCycle("issue-1", ["issue-2", "issue-3", "issue-2"]), true);
