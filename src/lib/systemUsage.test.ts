import assert from "node:assert/strict";

import { buildUsagePeriod, daysSince, getDateKeys, getInactiveCutoff, getShanghaiDateKey } from "./systemUsage";

assert.equal(getShanghaiDateKey(new Date("2026-08-18T15:59:59.000Z")), "2026-08-18");
assert.equal(getShanghaiDateKey(new Date("2026-08-18T16:00:00.000Z")), "2026-08-19");
assert.deepEqual(getDateKeys(3, new Date("2026-08-18T16:30:00.000Z")), ["2026-08-17", "2026-08-18", "2026-08-19"]);
assert.equal(getInactiveCutoff(30, new Date("2026-08-19T04:00:00.000Z")).toISOString(), "2026-07-19T16:00:00.000Z");
assert.equal(daysSince(new Date("2026-07-19T18:00:00.000Z"), new Date("2026-08-19T04:00:00.000Z")), 30);
assert.deepEqual(
  buildUsagePeriod(
    ["2026-08-17", "2026-08-18", "2026-08-19"],
    [
      { activityDate: "2026-08-18", userId: "u1", departmentIdSnapshot: "d1" },
      { activityDate: "2026-08-18", userId: "u1", departmentIdSnapshot: "d1" },
      { activityDate: "2026-08-18", userId: "u2", departmentIdSnapshot: "d1" },
      { activityDate: "2026-08-19", userId: "u1", departmentIdSnapshot: "d2" },
    ],
  ),
  {
    activeUsers: 2,
    activeDepartments: 2,
    trend: [
      { date: "2026-08-17", activeUsers: 0, activeDepartments: 0 },
      { date: "2026-08-18", activeUsers: 2, activeDepartments: 1 },
      { date: "2026-08-19", activeUsers: 1, activeDepartments: 1 },
    ],
  },
);

console.log("systemUsage tests passed");
