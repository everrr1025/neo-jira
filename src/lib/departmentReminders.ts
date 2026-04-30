import prisma from "@/lib/prisma";
import type { DepartmentWorkspaceProject } from "@/lib/departmentWorkspace";

export type DepartmentReminderScopeOption = {
  id: string;
  name: string;
  key: string;
};

export type DepartmentReminderIssueOption = {
  id: string;
  key: string;
  title: string;
  projectId: string;
  projectKey: string;
};

export type DepartmentUpcomingItem = {
  id: string;
  kind: "REMINDER" | "ISSUE_DUE";
  itemType: "NOTE" | "TODO" | "EVENT" | "REMINDER" | "ISSUE_DUE";
  title: string;
  content: string | null;
  date: string;
  priority: string;
  scopeLabel: string;
  projectName: string | null;
  projectKey: string | null;
  issueKey: string | null;
  issueTitle: string | null;
  link: string | null;
  canComplete: boolean;
  isOverdue: boolean;
  isImportant: boolean;
};

export type DepartmentItemCenterItem = DepartmentUpcomingItem & {
  completedAt: string | null;
  createdAt: string;
};

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getScopeLabel(scopeType: string, locale: "en" | "zh") {
  if (scopeType === "DEPARTMENT") return locale === "zh" ? "部门事项" : "Department";
  if (scopeType === "PROJECT") return locale === "zh" ? "项目事项" : "Project";
  return locale === "zh" ? "个人事项" : "Personal";
}

export function getManageableReminderProjects({
  projects,
  userId,
  canManageDepartment,
}: {
  projects: DepartmentWorkspaceProject[];
  userId: string;
  canManageDepartment: boolean;
}) {
  return projects
    .filter((project) => {
      if (canManageDepartment) return true;
      if (project.ownerId === userId) return true;
      return project.members.some((member) => member.userId === userId && member.role === "ADMIN");
    })
    .map((project) => ({ id: project.id, name: project.name, key: project.key }));
}

export async function getDepartmentReminderIssueOptions(projectIds: string[]) {
  if (projectIds.length === 0) return [];

  const issues = await prisma.issue.findMany({
    where: {
      projectId: { in: projectIds },
    },
    select: {
      id: true,
      key: true,
      title: true,
      projectId: true,
      project: {
        select: {
          key: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
  });

  return issues.map((issue) => ({
    id: issue.id,
    key: issue.key,
    title: issue.title,
    projectId: issue.projectId,
    projectKey: issue.project.key,
  }));
}

export async function getDepartmentUpcomingItems({
  departmentId,
  userId,
  userRole,
  visibleProjectIds,
  manageableProjectIds,
  doneStatusKeys,
  canManageDepartment,
  locale,
}: {
  departmentId: string;
  userId: string;
  userRole: string | null | undefined;
  visibleProjectIds: string[];
  manageableProjectIds: string[];
  doneStatusKeys: string[];
  canManageDepartment: boolean;
  locale: "en" | "zh";
}) {
  const today = startOfToday();
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + 4);

  const [reminders, dueIssues] = await Promise.all([
    prisma.reminder.findMany({
      where: {
        completedAt: null,
        OR: [{ startAt: { lt: windowEnd } }, { isImportant: true }, { itemType: "TODO" }],
        AND: [
          {
            OR: [
              { scopeType: "PERSONAL", OR: [{ creatorId: userId }, { assigneeId: userId }] },
              { scopeType: "DEPARTMENT", departmentId },
              visibleProjectIds.length > 0
                ? { scopeType: "PROJECT", projectId: { in: visibleProjectIds } }
                : { id: "__none__" },
            ],
          },
        ],
      },
      include: {
        project: {
          select: { id: true, name: true, key: true },
        },
        issue: {
          select: { id: true, key: true, title: true },
        },
      },
      orderBy: [{ startAt: "asc" }, { priority: "desc" }],
      take: 40,
    }),
    visibleProjectIds.length > 0
      ? prisma.issue.findMany({
          where: {
            projectId: { in: visibleProjectIds },
            dueDate: { not: null, lt: windowEnd },
            NOT: { status: { in: doneStatusKeys.length > 0 ? doneStatusKeys : ["DONE"] } },
          },
          select: {
            id: true,
            key: true,
            title: true,
            dueDate: true,
            priority: true,
            project: {
              select: { name: true, key: true },
            },
          },
          orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
          take: 40,
        })
      : Promise.resolve([]),
  ]);

  const reminderItems = reminders.map((reminder) => {
    const canComplete =
      userRole === "ADMIN" ||
      reminder.creatorId === userId ||
      reminder.assigneeId === userId ||
      (reminder.scopeType === "DEPARTMENT" && canManageDepartment) ||
      (reminder.projectId ? manageableProjectIds.includes(reminder.projectId) : false);

    return {
      id: reminder.id,
      kind: "REMINDER" as const,
      itemType: reminder.itemType as DepartmentUpcomingItem["itemType"],
      title: reminder.title,
      content: reminder.content,
      date: reminder.startAt.toISOString(),
      priority: reminder.priority,
      scopeLabel: getScopeLabel(reminder.scopeType, locale),
      projectName: reminder.project?.name || null,
      projectKey: reminder.project?.key || null,
      issueKey: reminder.issue?.key || null,
      issueTitle: reminder.issue?.title || null,
      link: reminder.issue ? `/issues/${reminder.issue.id}` : reminder.project ? "/" : null,
      canComplete,
      isOverdue: reminder.startAt < today,
      isImportant: reminder.isImportant,
    };
  });

  const issueItems = dueIssues
    .filter((issue) => issue.dueDate)
    .map((issue) => ({
      id: issue.id,
      kind: "ISSUE_DUE" as const,
      itemType: "ISSUE_DUE" as const,
      title: issue.title,
      content: null,
      date: issue.dueDate!.toISOString(),
      priority: issue.priority,
      scopeLabel: locale === "zh" ? "问题到期" : "Issue due",
      projectName: issue.project.name,
      projectKey: issue.project.key,
      issueKey: issue.key,
      issueTitle: issue.title,
      link: `/issues/${issue.id}`,
      canComplete: false,
      isOverdue: issue.dueDate! < today,
      isImportant: issue.priority === "HIGH" || issue.priority === "URGENT",
    }));

  const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  return [...reminderItems, ...issueItems]
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
    })
    .slice(0, 12);
}

export async function getDepartmentItemCenterItems({
  departmentId,
  userId,
  userRole,
  visibleProjectIds,
  manageableProjectIds,
  canManageDepartment,
  locale,
}: {
  departmentId: string;
  userId: string;
  userRole: string | null | undefined;
  visibleProjectIds: string[];
  manageableProjectIds: string[];
  canManageDepartment: boolean;
  locale: "en" | "zh";
}) {
  const today = startOfToday();
  const reminders = await prisma.reminder.findMany({
    where: {
      OR: [
        { scopeType: "PERSONAL", OR: [{ creatorId: userId }, { assigneeId: userId }] },
        { scopeType: "DEPARTMENT", departmentId },
        visibleProjectIds.length > 0
          ? { scopeType: "PROJECT", projectId: { in: visibleProjectIds } }
          : { id: "__none__" },
      ],
    },
    include: {
      project: {
        select: { id: true, name: true, key: true },
      },
      issue: {
        select: { id: true, key: true, title: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });

  return reminders.map((reminder) => {
    const canComplete =
      userRole === "ADMIN" ||
      reminder.creatorId === userId ||
      reminder.assigneeId === userId ||
      (reminder.scopeType === "DEPARTMENT" && canManageDepartment) ||
      (reminder.projectId ? manageableProjectIds.includes(reminder.projectId) : false);

    return {
      id: reminder.id,
      kind: "REMINDER" as const,
      itemType: reminder.itemType as DepartmentUpcomingItem["itemType"],
      title: reminder.title,
      content: reminder.content,
      date: reminder.startAt.toISOString(),
      priority: reminder.priority,
      scopeLabel: getScopeLabel(reminder.scopeType, locale),
      projectName: reminder.project?.name || null,
      projectKey: reminder.project?.key || null,
      issueKey: reminder.issue?.key || null,
      issueTitle: reminder.issue?.title || null,
      link: reminder.issue ? `/issues/${reminder.issue.id}` : null,
      canComplete,
      isOverdue: reminder.completedAt ? false : reminder.itemType !== "NOTE" && reminder.startAt < today,
      isImportant: reminder.isImportant,
      completedAt: reminder.completedAt?.toISOString() || null,
      createdAt: reminder.createdAt.toISOString(),
    } satisfies DepartmentItemCenterItem;
  });
}
