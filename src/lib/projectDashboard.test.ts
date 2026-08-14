import assert from "node:assert/strict";

import { getIterationTiming, selectInitialDashboardIssueTab } from "./projectDashboard";

const today = new Date(2026, 7, 13, 10, 30);

assert.deepEqual(getIterationTiming(new Date(2026, 7, 16), today), { state: "active", days: 3 });
assert.deepEqual(getIterationTiming(new Date(2026, 7, 13, 23, 59), today), { state: "ends-today", days: 0 });
assert.deepEqual(getIterationTiming(new Date(2026, 7, 12), today), { state: "overdue", days: 1 });
assert.deepEqual(getIterationTiming(new Date(2026, 7, 1), today), { state: "overdue", days: 12 });
assert.equal(getIterationTiming(null, today), null);

const emptyCounts = { assigned: 0, watched: 0, priority: 0, overdue: 0, "due-soon": 0 };

assert.equal(
  selectInitialDashboardIssueTab({ ...emptyCounts, overdue: 2, priority: 3 }),
  "overdue",
);
assert.equal(selectInitialDashboardIssueTab({ ...emptyCounts, priority: 3 }), "priority");
assert.equal(selectInitialDashboardIssueTab({ ...emptyCounts, watched: 4 }), "watched");
assert.equal(selectInitialDashboardIssueTab(emptyCounts), "assigned");
