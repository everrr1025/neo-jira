import "server-only";

import prisma from "@/lib/prisma";
import { buildUsageHealth } from "@/lib/adminOverviewHealth";
import type { AdminOverviewData } from "@/lib/adminOverviewTypes";
import { getStoragePeriodStart } from "@/lib/fileStorage";
import { buildUsagePeriod, getDateKeys } from "@/lib/systemUsage";

export async function getAdminOverviewData(now = new Date()): Promise<AdminOverviewData> {
  const dateKeys30 = getDateKeys(30, now);
  const dateKeys7 = dateKeys30.slice(-7);
  const storagePeriodStart = getStoragePeriodStart(30, now);

  const [usageHealthUsers, departmentCount, projectCount, storageTotal, storageRecent, activities, departments, filesByDepartment, unassignedProjects] = await Promise.all([
    prisma.user.findMany({
      where: { role: "USER", disabledAt: null },
      select: {
        lastActiveAt: true,
        activityTrackingStartedAt: true,
        departmentMembers: {
          select: { department: { select: { id: true, name: true, key: true } } },
        },
      },
    }),
    prisma.department.count(),
    prisma.project.count(),
    prisma.fileAsset.aggregate({ _count: { _all: true }, _sum: { fileSize: true } }),
    prisma.fileAsset.aggregate({
      where: { createdAt: { gte: storagePeriodStart } },
      _count: { _all: true },
      _sum: { fileSize: true },
    }),
    prisma.userDailyActivity.findMany({
      where: { activityDate: { gte: dateKeys30[0] }, user: { role: "USER", disabledAt: null } },
      select: { activityDate: true, userId: true, departmentIdSnapshot: true },
    }),
    prisma.department.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        key: true,
        members: { where: { user: { role: "USER", disabledAt: null } }, select: { id: true } },
        projects: { select: { id: true } },
      },
    }),
    prisma.fileAsset.groupBy({
      by: ["departmentId"],
      _count: { _all: true },
      _sum: { fileSize: true },
    }),
    prisma.project.count({ where: { departmentId: null } }),
  ]);

  const filesByDepartmentId = new Map(filesByDepartment.map((group) => [group.departmentId, group]));
  const unassignedFiles = filesByDepartmentId.get(null);
  const unassignedUsers = usageHealthUsers.filter((user) => user.departmentMembers.length === 0).length;

  return {
    totals: { users: usageHealthUsers.length, departments: departmentCount, projects: projectCount },
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
    inactive: {
      30: buildUsageHealth(usageHealthUsers, departments, 30, now),
      90: buildUsageHealth(usageHealthUsers, departments, 90, now),
    },
    departmentResources: [
      ...departments.map((department) => {
        const files = filesByDepartmentId.get(department.id);
        return {
          id: department.id,
          name: department.name,
          key: department.key,
          users: department.members.length,
          projects: department.projects.length,
          files: files?._count._all ?? 0,
          bytes: Number(files?._sum.fileSize ?? 0),
        };
      }),
      ...((unassignedUsers > 0 || unassignedProjects > 0 || unassignedFiles)
        ? [{
            id: null,
            name: "Unassigned",
            key: null,
            users: unassignedUsers,
            projects: unassignedProjects,
            files: unassignedFiles?._count._all ?? 0,
            bytes: Number(unassignedFiles?._sum.fileSize ?? 0),
          }]
        : []),
    ],
  };
}
