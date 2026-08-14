import assert from "node:assert/strict";
import {
  canTransitionPlanStatus,
  getPlanDateHint,
  getPlanStatusOrder,
  isTerminalPlanStatus,
  partitionPlanIssues,
} from "./planLifecycle";

assert.equal(canTransitionPlanStatus("PLANNED", "ACTIVE"), true);
assert.equal(canTransitionPlanStatus("PLANNED", "COMPLETED"), false);
assert.equal(canTransitionPlanStatus("ACTIVE", "COMPLETED"), true);
assert.equal(canTransitionPlanStatus("COMPLETED", "ACTIVE"), true);
assert.equal(canTransitionPlanStatus("CANCELLED", "PLANNED"), false);
assert.equal(isTerminalPlanStatus("COMPLETED"), true);
assert.equal(isTerminalPlanStatus("ACTIVE"), false);
assert.deepEqual(["CANCELLED", "PLANNED", "COMPLETED", "ACTIVE"].sort((a, b) => getPlanStatusOrder(a) - getPlanStatusOrder(b)), [
  "ACTIVE", "PLANNED", "COMPLETED", "CANCELLED",
]);

const now = new Date(2026, 7, 13, 12);
assert.equal(getPlanDateHint({ status: "ACTIVE", startDate: "2026-08-01", endDate: "2026-08-13" }, "zh", now), "今天结束");
assert.equal(getPlanDateHint({ status: "ACTIVE", startDate: "2026-08-01", endDate: "2026-08-11" }, "zh", now), "已逾期 2 天");
assert.equal(getPlanDateHint({ status: "PLANNED", startDate: "2026-08-15", endDate: "2026-08-30" }, "zh", now), "距开始 2 天");
assert.equal(getPlanDateHint({ status: "COMPLETED", startDate: "2026-08-01", endDate: "2026-08-11" }, "zh", now), null);

const partitioned = partitionPlanIssues(
  [{ key: "A-1", status: "RELEASED" }, { key: "A-2", status: "DOING" }],
  ["DONE", "RELEASED"],
);
assert.deepEqual(partitioned.completed.map((issue) => issue.key), ["A-1"]);
assert.deepEqual(partitioned.unfinished.map((issue) => issue.key), ["A-2"]);
assert.equal(partitionPlanIssues([], ["DONE"]).completed.length, 0);

console.log("planLifecycle tests passed");
