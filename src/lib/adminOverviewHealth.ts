import type { UsageHealthSummary } from "@/lib/adminOverviewTypes";
import { getInactiveCutoff } from "@/lib/systemUsage";

type UsageHealthUser = {
  lastActiveAt: Date | null;
  activityTrackingStartedAt: Date;
  departmentMembers: Array<{
    department: { id: string; name: string; key: string };
  }>;
};

type UsageHealthDepartment = {
  id: string;
  name: string;
  key: string;
};

const ATTENTION_ACTIVE_RATE = 0.2;

export function buildUsageHealth(users: UsageHealthUser[], departmentList: UsageHealthDepartment[], days: 30 | 90, now: Date): UsageHealthSummary {
  const cutoff = getInactiveCutoff(days, now);
  const departments = new Map<string, {
    id: string;
    name: string;
    key: string;
    users: number;
    activeUsers: number;
    eligibleUsers: number;
  }>(departmentList.map((department) => [department.id, {
    ...department,
    users: 0,
    activeUsers: 0,
    eligibleUsers: 0,
  }]));
  let activeUsers = 0;
  let eligibleUsers = 0;

  for (const user of users) {
    const department = user.departmentMembers[0]?.department;
    if (department) {
      const stats = departments.get(department.id) ?? {
        ...department,
        users: 0,
        activeUsers: 0,
        eligibleUsers: 0,
      };
      stats.users += 1;
      departments.set(department.id, stats);
    }

    const isActive = Boolean(user.lastActiveAt && user.lastActiveAt >= cutoff);
    const isEligible = isActive || user.activityTrackingStartedAt < cutoff;
    if (!isEligible) continue;

    eligibleUsers += 1;
    if (isActive) activeUsers += 1;

    if (!department) continue;
    const stats = departments.get(department.id)!;
    stats.eligibleUsers += 1;
    if (isActive) stats.activeUsers += 1;
    departments.set(department.id, stats);
  }

  const departmentHealth = [...departments.values()]
    .map((department) => ({
      ...department,
      inactiveUsers: department.eligibleUsers - department.activeUsers,
      activeRate: department.eligibleUsers > 0 ? Math.round((department.activeUsers / department.eligibleUsers) * 100) : 0,
    }));
  const attentionDepartments = departmentHealth
    .filter((department) => department.eligibleUsers > 0 && department.activeUsers / department.eligibleUsers < ATTENTION_ACTIVE_RATE)
    .sort((left, right) => left.activeRate - right.activeRate || right.eligibleUsers - left.eligibleUsers || left.name.localeCompare(right.name));

  return {
    activeUsers,
    inactiveUsers: eligibleUsers - activeUsers,
    eligibleUsers,
    activeRate: eligibleUsers > 0 ? Math.round((activeUsers / eligibleUsers) * 100) : 0,
    attentionDepartmentCount: attentionDepartments.length,
    attentionDepartments: attentionDepartments.slice(0, 3),
    departments: departmentHealth,
  };
}
