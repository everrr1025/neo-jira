import assert from "node:assert/strict";

import {
  buildPersistedIssueListQuery,
  hasExplicitIssueListParams,
  mergePlanContextLayout,
  normalizeLayoutPreference,
  replaceVisibleKeyOrder,
  splitLayoutForStorage,
} from "./issueListPreferences";

const availableKeys = ["column:key", "column:title", "issueField:effort", "planField:budget"];
const defaultWidths = {
  "column:key": 80,
  "column:title": 320,
  "issueField:effort": 140,
  "planField:budget": 140,
};

const normalized = normalizeLayoutPreference(
  {
    orderedKeys: ["column:title", "column:key", "column:removed"],
    hiddenKeys: ["column:key", "column:removed"],
    widths: { "column:title": 500, "column:removed": 200 },
  },
  availableKeys,
  defaultWidths
);
assert.deepEqual(normalized.orderedKeys, availableKeys.slice(0, 2).reverse().concat(availableKeys.slice(2)));
assert.deepEqual(normalized.hiddenKeys, ["column:key"]);
assert.equal(normalized.widths["column:title"], 500);
assert.equal(normalized.widths["issueField:effort"], 140);

const merged = mergePlanContextLayout(
  {
    orderedKeys: ["column:title", "issueField:effort", "column:key"],
    hiddenKeys: ["column:key"],
    widths: { "column:title": 400, "issueField:effort": 180, "column:key": 80 },
  },
  {
    orderedKeys: ["column:key", "planField:budget", "column:title", "issueField:effort"],
    hiddenKeys: ["planField:budget"],
    widths: { "planField:budget": 260 },
  },
  availableKeys,
  defaultWidths
);
assert.deepEqual(merged.orderedKeys, ["column:title", "planField:budget", "issueField:effort", "column:key"]);
assert.deepEqual(new Set(merged.hiddenKeys), new Set(["column:key", "planField:budget"]));
assert.equal(merged.widths["planField:budget"], 260);

const split = splitLayoutForStorage(merged);
assert.equal(split.base.orderedKeys.includes("planField:budget"), false);
assert.deepEqual(split.context.orderedKeys, merged.orderedKeys);
assert.deepEqual(split.context.hiddenKeys, ["planField:budget"]);

assert.deepEqual(
  replaceVisibleKeyOrder(
    ["column:key", "hidden:x", "column:title", "issueField:effort"],
    ["column:key", "column:title", "issueField:effort"],
    ["issueField:effort", "column:key", "column:title"]
  ),
  ["issueField:effort", "hidden:x", "column:key", "column:title"]
);

const query = new URLSearchParams(
  "status=TODO&issueField_effort_op=GTE&issueField_effort=3&page=4&pageSize=20&layout=list"
);
assert.equal(
  buildPersistedIssueListQuery(query),
  "status=TODO&issueField_effort_op=GTE&issueField_effort=3&pageSize=20"
);
assert.equal(hasExplicitIssueListParams({ layout: "list" }), false);
assert.equal(hasExplicitIssueListParams({ page: "2" }), true);
assert.equal(hasExplicitIssueListParams({ planField_budget_op: "GTE" }), true);

console.log("issue list preference checks passed");
