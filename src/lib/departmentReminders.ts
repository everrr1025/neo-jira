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
  description: string | null;
  status: string;
  priority: string;
  type: string;
  dueDate: string | null;
  planName: string | null;
  iterationName: string | null;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  workflowStatuses: Array<{
    id: string;
    key: string;
    name: string;
    category: string;
    position: number;
    isInitial: boolean;
  }>;
  assigneeName: string | null;
  assigneeEmail: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    authorName: string | null;
    authorEmail: string;
  }>;
  attachments: Array<{
    id: string;
    fileName: string;
    createdAt: string;
    uploaderName: string | null;
    uploaderEmail: string;
  }>;
  issueFieldDefinitions: Array<{
    id: string;
    name: string;
    type: string;
    position: number;
  }>;
  issueFieldValues: Array<{
    id: string;
    fieldDefinitionId: string;
    valueBoolean: boolean | null;
    valueNumber: number | null;
    valueText: string | null;
    valueOption: string | null;
  }>;
};

export type DepartmentReminderAssigneeOption = {
  id: string;
  name: string;
  email: string;
  projectIds: string[];
};

export type DepartmentUpcomingItem = {
  id: string;
  kind: "REMINDER" | "ISSUE_DUE";
  itemType: "NOTE" | "TODO" | "EVENT" | "REMINDER" | "ISSUE_DUE";
  title: string;
  content: string | null;
  date: string;
  endDate: string | null;
  dueDate: string | null;
  priority: string;
  taskStatus: string;
  scopeType: string;
  scopeLabel: string;
  projectName: string | null;
  projectKey: string | null;
  issueKey: string | null;
  issueTitle: string | null;
  creatorId: string | null;
  assigneeId: string | null;
  creatorName: string | null;
  creatorEmail: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  link: string | null;
  canComplete: boolean;
  canEdit: boolean;
  canComment: boolean;
  isOverdue: boolean;
  isImportant: boolean;
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    authorName: string | null;
    authorEmail: string;
  }>;
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
      description: true,
      status: true,
      priority: true,
      type: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true,
      projectId: true,
      plan: { select: { name: true } },
      iteration: { select: { name: true } },
      project: {
        select: {
          key: true,
          name: true,
          issueFieldDefinitions: {
            select: {
              id: true,
              name: true,
              type: true,
              position: true,
            },
            orderBy: { position: "asc" },
          },
          workflowStatuses: {
            select: {
              id: true,
              key: true,
              name: true,
              category: true,
              position: true,
              isInitial: true,
            },
            orderBy: { position: "asc" },
          },
        },
      },
      assignee: { select: { name: true, email: true } },
      reporter: { select: { name: true, email: true } },
      comments: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      attachments: {
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          uploader: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      issueFieldValues: {
        select: {
          id: true,
          fieldDefinitionId: true,
          valueBoolean: true,
          valueNumber: true,
          valueText: true,
          valueOption: true,
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
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    type: issue.type,
    dueDate: issue.dueDate?.toISOString() || null,
    planName: issue.plan?.name || null,
    iterationName: issue.iteration?.name || null,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    projectId: issue.projectId,
    projectKey: issue.project.key,
    projectName: issue.project.name,
    workflowStatuses: issue.project.workflowStatuses,
    assigneeName: issue.assignee?.name || null,
    assigneeEmail: issue.assignee?.email || null,
    reporterName: issue.reporter?.name || null,
    reporterEmail: issue.reporter?.email || null,
    comments: issue.comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      authorName: comment.author.name,
      authorEmail: comment.author.email,
    })),
    attachments: issue.attachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      createdAt: attachment.createdAt.toISOString(),
      uploaderName: attachment.uploader.name,
      uploaderEmail: attachment.uploader.email,
    })),
    issueFieldDefinitions: issue.project.issueFieldDefinitions,
    issueFieldValues: issue.issueFieldValues,
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
        OR: [
          { itemType: { not: "TODO" }, startAt: { lt: windowEnd } },
          { isImportant: true },
          { itemType: "TODO", remindAt: { not: null, lt: windowEnd } },
        ],
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
        assignee: {
          select: { name: true, email: true },
        },
        creator: {
          select: { name: true, email: true },
        },
      },
      orderBy: [{ remindAt: "asc" }, { startAt: "asc" }, { priority: "desc" }],
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

    const displayDate = reminder.itemType === "TODO" ? reminder.remindAt || reminder.startAt : reminder.startAt;

    return {
      id: reminder.id,
      kind: "REMINDER" as const,
      itemType: reminder.itemType as DepartmentUpcomingItem["itemType"],
      title: reminder.title,
      content: reminder.content,
      date: displayDate.toISOString(),
      endDate: reminder.endAt?.toISOString() || null,
      dueDate: reminder.itemType === "TODO" ? reminder.remindAt?.toISOString() || null : null,
      priority: reminder.priority,
      taskStatus: reminder.completedAt ? "DONE" : reminder.taskStatus,
      scopeType: reminder.scopeType,
      scopeLabel: getScopeLabel(reminder.scopeType, locale),
      projectName: reminder.project?.name || null,
      projectKey: reminder.project?.key || null,
      issueKey: reminder.issue?.key || null,
      issueTitle: reminder.issue?.title || null,
      creatorId: reminder.creatorId,
      assigneeId: reminder.assigneeId,
      creatorName: reminder.creator?.name || null,
      creatorEmail: reminder.creator?.email || null,
      assigneeName: reminder.assignee?.name || null,
      assigneeEmail: reminder.assignee?.email || null,
      link: reminder.issue ? `/issues/${reminder.issue.id}` : reminder.project ? "/" : null,
      canComplete,
      canEdit: canComplete,
      canComment: canComplete,
      isOverdue: reminder.itemType === "TODO" ? Boolean(reminder.remindAt && reminder.remindAt < today) : reminder.startAt < today,
      isImportant: reminder.isImportant,
      comments: [],
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
      endDate: null,
      dueDate: issue.dueDate!.toISOString(),
      priority: issue.priority,
      taskStatus: "IN_PROGRESS",
      scopeType: "PROJECT",
      scopeLabel: locale === "zh" ? "任务" : "Task",
      projectName: issue.project.name,
      projectKey: issue.project.key,
      issueKey: issue.key,
      issueTitle: issue.title,
      creatorId: null,
      assigneeId: null,
      creatorName: null,
      creatorEmail: null,
      assigneeName: null,
      assigneeEmail: null,
      link: `/issues/${issue.id}`,
      canComplete: false,
      canEdit: false,
      canComment: false,
      isOverdue: issue.dueDate! < today,
      isImportant: issue.priority === "HIGH" || issue.priority === "URGENT",
      comments: [],
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
  const [reminders, dueIssues] = await Promise.all([
    prisma.reminder.findMany({
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
        assignee: {
          select: { name: true, email: true },
        },
        creator: {
          select: { name: true, email: true },
        },
        comments: {
          include: {
            author: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 50,
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    }),
    visibleProjectIds.length > 0
      ? prisma.issue.findMany({
          where: {
            projectId: { in: visibleProjectIds },
            dueDate: { not: null },
            NOT: { status: { in: ["DONE"] } },
          },
          select: {
            id: true,
            key: true,
            title: true,
            dueDate: true,
            priority: true,
            status: true,
            assigneeId: true,
            assignee: { select: { name: true, email: true } },
            project: { select: { name: true, key: true } },
          },
          orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  const reminderItems = reminders.filter((reminder) => {
    if (reminder.itemType !== "TODO") return true;
    if (userRole === "ADMIN" || canManageDepartment) return true;
    if (reminder.creatorId === userId || reminder.assigneeId === userId) return true;
    return reminder.projectId ? manageableProjectIds.includes(reminder.projectId) : false;
  }).map((reminder) => {
    const canComplete =
      userRole === "ADMIN" ||
      reminder.creatorId === userId ||
      reminder.assigneeId === userId ||
      (reminder.scopeType === "DEPARTMENT" && canManageDepartment) ||
      (reminder.projectId ? manageableProjectIds.includes(reminder.projectId) : false);
    const canEdit = reminder.creatorId === userId;

    const displayDate = reminder.itemType === "TODO" ? reminder.remindAt || reminder.startAt : reminder.startAt;

    return {
      id: reminder.id,
      kind: "REMINDER" as const,
      itemType: reminder.itemType as DepartmentUpcomingItem["itemType"],
      title: reminder.title,
      content: reminder.content,
      date: displayDate.toISOString(),
      endDate: reminder.endAt?.toISOString() || null,
      dueDate: reminder.itemType === "TODO" ? reminder.remindAt?.toISOString() || null : null,
      priority: reminder.priority,
      taskStatus: reminder.completedAt ? "DONE" : reminder.taskStatus,
      scopeType: reminder.scopeType,
      scopeLabel: getScopeLabel(reminder.scopeType, locale),
      projectName: reminder.project?.name || null,
      projectKey: reminder.project?.key || null,
      issueKey: reminder.issue?.key || null,
      issueTitle: reminder.issue?.title || null,
      creatorId: reminder.creatorId,
      assigneeId: reminder.assigneeId,
      creatorName: reminder.creator?.name || null,
      creatorEmail: reminder.creator?.email || null,
      assigneeName: reminder.assignee?.name || null,
      assigneeEmail: reminder.assignee?.email || null,
      link: reminder.issue ? `/issues/${reminder.issue.id}` : null,
      canComplete,
      canEdit,
      canComment: canEdit || reminder.assigneeId === userId,
      isOverdue: reminder.completedAt
        ? false
        : reminder.itemType === "TODO"
          ? Boolean(reminder.remindAt && reminder.remindAt < today)
          : reminder.itemType !== "NOTE" && reminder.startAt < today,
      isImportant: reminder.isImportant,
      comments: reminder.comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        authorName: comment.author.name,
        authorEmail: comment.author.email,
      })),
      completedAt: reminder.completedAt?.toISOString() || null,
      createdAt: reminder.createdAt.toISOString(),
    } satisfies DepartmentItemCenterItem;
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
      endDate: null,
      dueDate: issue.dueDate!.toISOString(),
      priority: issue.priority,
      taskStatus: issue.status,
      scopeType: "PROJECT",
      scopeLabel: locale === "zh" ? "任务" : "Task",
      projectName: issue.project.name,
      projectKey: issue.project.key,
      issueKey: issue.key,
      issueTitle: issue.title,
      creatorId: null,
      assigneeId: issue.assigneeId,
      creatorName: null,
      creatorEmail: null,
      assigneeName: issue.assignee?.name || null,
      assigneeEmail: issue.assignee?.email || null,
      link: `/issues/${issue.id}`,
      canComplete: false,
      canEdit: false,
      canComment: false,
      isOverdue: issue.dueDate! < today,
      isImportant: issue.priority === "HIGH" || issue.priority === "URGENT",
      comments: [],
      completedAt: null,
      createdAt: issue.dueDate!.toISOString(),
    } satisfies DepartmentItemCenterItem));

  return [...reminderItems, ...issueItems];
}
