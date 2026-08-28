import assert from "node:assert/strict";

import { buildUsageHealth } from "./adminOverviewHealth";

const now = new Date("2026-08-27T08:00:00.000Z");
const activeAt = new Date("2026-08-20T08:00:00.000Z");
const oldActiveAt = new Date("2026-01-01T08:00:00.000Z");
const oldTrackingStart = new Date("2025-01-01T08:00:00.000Z");
const newTrackingStart = new Date("2026-08-20T08:00:00.000Z");
const department = (id: string, name: string) => [{ department: { id, name, key: id.toUpperCase() } }];

const users = [
  { lastActiveAt: activeAt, activityTrackingStartedAt: oldTrackingStart, departmentMembers: department("d1", "健康部门") },
  { lastActiveAt: oldActiveAt, activityTrackingStartedAt: oldTrackingStart, departmentMembers: department("d1", "健康部门") },
  { lastActiveAt: activeAt, activityTrackingStartedAt: oldTrackingStart, departmentMembers: department("d2", "低活跃部门") },
  ...Array.from({ length: 5 }, () => ({ lastActiveAt: oldActiveAt, activityTrackingStartedAt: oldTrackingStart, departmentMembers: department("d2", "低活跃部门") })),
  ...Array.from({ length: 2 }, () => ({ lastActiveAt: null, activityTrackingStartedAt: oldTrackingStart, departmentMembers: department("d3", "零活跃部门") })),
  { lastActiveAt: null, activityTrackingStartedAt: newTrackingStart, departmentMembers: department("d3", "零活跃部门") },
  { lastActiveAt: null, activityTrackingStartedAt: oldTrackingStart, departmentMembers: [] },
];
const departments = [
  { id: "d1", name: "健康部门", key: "D1" },
  { id: "d2", name: "低活跃部门", key: "D2" },
  { id: "d3", name: "零活跃部门", key: "D3" },
  { id: "d4", name: "空部门", key: "D4" },
];

const result = buildUsageHealth(users, departments, 30, now);

assert.deepEqual(
  {
    activeUsers: result.activeUsers,
    inactiveUsers: result.inactiveUsers,
    eligibleUsers: result.eligibleUsers,
    activeRate: result.activeRate,
    attentionDepartmentCount: result.attentionDepartmentCount,
  },
  { activeUsers: 2, inactiveUsers: 9, eligibleUsers: 11, activeRate: 18, attentionDepartmentCount: 2 },
);
assert.deepEqual(
  result.attentionDepartments.map((item) => [item.id, item.activeRate, item.activeUsers, item.eligibleUsers]),
  [["d3", 0, 0, 2], ["d2", 17, 1, 6]],
);
assert.deepEqual(
  result.departments.map((item) => [item.id, item.users, item.activeUsers, item.inactiveUsers, item.activeRate]),
  [["d1", 2, 1, 1, 50], ["d2", 6, 1, 5, 17], ["d3", 3, 0, 2, 0], ["d4", 0, 0, 0, 0]],
);

const periodUser = [{
  lastActiveAt: new Date("2026-07-01T08:00:00.000Z"),
  activityTrackingStartedAt: oldTrackingStart,
  departmentMembers: department("d1", "健康部门"),
}];
assert.equal(buildUsageHealth(periodUser, departments, 30, now).activeUsers, 0);
assert.equal(buildUsageHealth(periodUser, departments, 90, now).activeUsers, 1);

console.log("admin overview health checks passed");
