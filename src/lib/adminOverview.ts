import "server-only";

import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import type { AdminOverviewData, InactiveUserSummary } from "@/lib/adminOverviewTypes";
import { buildUsagePeriod, daysSince, getDateKeys, getInactiveCutoff } from "@/lib/systemUsage";

const GOVERNANCE_ENTITY_TYPES = ["USER", "DEPARTMENT", "PROJECT"];

function parseMetadata(value: string | null) {
  if (!value) return {} as Record<string, string>;
  try {
    return JSON.parse(value) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

async function getInactiveUsers(days: 30 | 90, now: Date) {
  const cutoff = getInactiveCutoff(days, now);
  const where: Prisma.UserWhereInput = {
    role: "USER",
    OR: [
      { lastActiveAt: { lt: cutoff } },
      { lastActiveAt: null, activityTrackingStartedAt: { lt: cutoff } },
    ],
  };

  const [count, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        lastActiveAt: true,
        activityTrackingStartedAt: true,
        departmentMembers: {
          select: { department: { select: { name: true } } },
          take: 1,
        },
      },
    }),
  ]);

  const summaries: InactiveUserSummary[] = users
    .map((user) => ({
      id: user.id,
      name: user.name || user.email,
      email: user.email,
      departmentName: user.departmentMembers[0]?.department.name ?? null,
      lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
      inactiveDays: daysSince(user.lastActiveAt ?? user.activityTrackingStartedAt, now),
    }))
    .sort((a, b) => b.inactiveDays - a.inactiveDays || a.name.localeCompare(b.name))
    .slice(0, 8);

  return { count, users: summaries };
}

export async function getAdminOverviewData(now = new Date()): Promise<AdminOverviewData> {
  const dateKeys30 = getDateKeys(30, now);
  const dateKeys7 = dateKeys30.slice(-7);

  const [userCount, departmentCount, projectCount, activities, inactive30, inactive90, unknownActivityUsers, logs] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.department.count(),
    prisma.project.count(),
    prisma.userDailyActivity.findMany({
      where: { activityDate: { gte: dateKeys30[0] }, user: { role: "USER" } },
      select: { activityDate: true, userId: true, departmentIdSnapshot: true },
    }),
    getInactiveUsers(30, now),
    getInactiveUsers(90, now),
    prisma.user.count({
      where: { role: "USER", lastActiveAt: null, activityTrackingStartedAt: { gte: getInactiveCutoff(30, now) } },
    }),
    prisma.auditLog.findMany({
      where: { entityType: { in: GOVERNANCE_ENTITY_TYPES } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        entityId: true,
        entityType: true,
        action: true,
        field: true,
        metadata: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
  ]);

  return {
    totals: { users: userCount, departments: departmentCount, projects: projectCount, unknownActivityUsers },
    periods: {
      7: buildUsagePeriod(dateKeys7, activities),
      30: buildUsagePeriod(dateKeys30, activities),
    },
    inactive: { 30: inactive30, 90: inactive90 },
    recentLogs: logs.map((log) => {
      const metadata = parseMetadata(log.metadata);
      return {
        id: log.id,
        entityType: log.entityType,
        action: log.action,
        field: log.field,
        actorName: log.actor?.name || log.actor?.email || metadata.actorName || "System",
        targetName: metadata.name || metadata.email || metadata.key || metadata.projectName || metadata.departmentName || metadata.userId || log.entityId,
        createdAt: log.createdAt.toISOString(),
      };
    }),
  };
}
