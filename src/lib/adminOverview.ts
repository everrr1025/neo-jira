import "server-only";

import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import type { AdminOverviewData } from "@/lib/adminOverviewTypes";
import { getStoragePeriodStart } from "@/lib/fileStorage";
import { buildUsagePeriod, getDateKeys, getInactiveCutoff } from "@/lib/systemUsage";

const GOVERNANCE_ENTITY_TYPES = ["USER", "DEPARTMENT", "PROJECT"];

function parseMetadata(value: string | null) {
  if (!value) return {} as Record<string, string>;
  try {
    return JSON.parse(value) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

async function getInactivityCounts(days: 30 | 90, now: Date) {
  const cutoff = getInactiveCutoff(days, now);
  const inactiveUserWhere: Prisma.UserWhereInput = {
    role: "USER",
    OR: [
      { lastActiveAt: { lt: cutoff } },
      { lastActiveAt: null, activityTrackingStartedAt: { lt: cutoff } },
    ],
  };

  const [count, departmentCount] = await Promise.all([
    prisma.user.count({ where: inactiveUserWhere }),
    prisma.department.count({
      where: {
        members: {
          some: { user: { role: "USER" } },
          none: {
            user: {
              role: "USER",
              OR: [
                { lastActiveAt: { gte: cutoff } },
                { lastActiveAt: null, activityTrackingStartedAt: { gte: cutoff } },
              ],
            },
          },
        },
      },
    }),
  ]);

  return { count, departmentCount };
}

export async function getAdminOverviewData(now = new Date()): Promise<AdminOverviewData> {
  const dateKeys30 = getDateKeys(30, now);
  const dateKeys7 = dateKeys30.slice(-7);
  const storagePeriodStart = getStoragePeriodStart(30, now);

  const [userCount, departmentCount, projectCount, storageTotal, storageRecent, activities, inactive30, inactive90, logs] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.department.count(),
    prisma.project.count(),
    prisma.fileAsset.aggregate({ _count: { _all: true }, _sum: { fileSize: true } }),
    prisma.fileAsset.aggregate({
      where: { createdAt: { gte: storagePeriodStart } },
      _count: { _all: true },
      _sum: { fileSize: true },
    }),
    prisma.userDailyActivity.findMany({
      where: { activityDate: { gte: dateKeys30[0] }, user: { role: "USER" } },
      select: { activityDate: true, userId: true, departmentIdSnapshot: true },
    }),
    getInactivityCounts(30, now),
    getInactivityCounts(90, now),
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

  const departments = await prisma.department.findMany({
    where: {
      id: {
        in: logs.filter((log) => log.entityType === "DEPARTMENT").map((log) => log.entityId),
      },
    },
    select: { id: true, name: true, key: true },
  });
  const departmentsById = new Map(departments.map((department) => [department.id, department]));

  return {
    totals: { users: userCount, departments: departmentCount, projects: projectCount },
    storage: {
      totalFiles: storageTotal._count._all,
      totalBytes: Number(storageTotal._sum.fileSize ?? 0),
      recentFiles: storageRecent._count._all,
      recentBytes: Number(storageRecent._sum.fileSize ?? 0),
    },
    periods: {
      7: buildUsagePeriod(dateKeys7, activities),
      30: buildUsagePeriod(dateKeys30, activities),
    },
    inactive: { 30: inactive30, 90: inactive90 },
    recentLogs: logs.map((log) => {
      const metadata = parseMetadata(log.metadata);
      const department = log.entityType === "DEPARTMENT" ? departmentsById.get(log.entityId) : undefined;
      const departmentName = metadata.name || department?.name;
      const departmentKey = metadata.key || department?.key;
      const targetName = log.entityType === "DEPARTMENT" && (departmentName || departmentKey)
        ? [departmentName, departmentKey ? `(${departmentKey})` : null].filter(Boolean).join(" ")
        : metadata.name || metadata.email || metadata.key || metadata.projectName || metadata.departmentName || metadata.userId || log.entityId;
      return {
        id: log.id,
        entityType: log.entityType,
        action: log.action,
        field: log.field,
        actorName: log.actor?.name || log.actor?.email || metadata.actorName || "System",
        targetName,
        createdAt: log.createdAt.toISOString(),
      };
    }),
  };
}
