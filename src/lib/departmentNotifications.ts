import prisma from "@/lib/prisma";
import type { Locale } from "@/lib/i18n";
import type { Prisma } from "@prisma/client";

export type DepartmentNotificationLevel = "DEPARTMENT" | "PROJECT" | "SYSTEM";
export type DepartmentNotificationStatus = "SENT" | "REVOKED";
export type DepartmentNotificationSource = "ANNOUNCEMENT" | "NOTIFICATION";
export type DepartmentNotificationCategory = "ANNOUNCEMENT" | "REMINDER" | "UPDATE";

export type DepartmentNotificationListItem = {
  receiptId: string;
  id: string;
  source: DepartmentNotificationSource;
  category: DepartmentNotificationCategory;
  level: DepartmentNotificationLevel;
  typeLabel: string;
  title: string;
  content: string;
  status: DepartmentNotificationStatus;
  read: boolean;
  createdAt: string;
  revokedAt: string | null;
  authorName: string;
  authorId: string | null;
  projectId: string | null;
  projectName: string | null;
  canManage: boolean;
  canDelete: boolean;
  targetUrl: string | null;
};

export type DepartmentNotificationProjectOption = {
  id: string;
  name: string;
  key: string;
};

export type DepartmentNotificationPermission = {
  canCreate: boolean;
  canCreateDepartment: boolean;
  canManageDepartment: boolean;
  manageableProjects: DepartmentNotificationProjectOption[];
};

type SessionLike = {
  userId: string;
  userRole?: string | null;
};

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getNotificationLevelLabel(level: DepartmentNotificationLevel, locale: Locale) {
  if (locale === "zh") {
    if (level === "DEPARTMENT") return "部门";
    if (level === "PROJECT") return "项目";
    return "系统";
  }
  if (level === "DEPARTMENT") return "Department";
  if (level === "PROJECT") return "Project";
  return "System";
}

export async function getDepartmentNotificationPermission(
  departmentId: string,
  { userId, userRole }: SessionLike,
): Promise<DepartmentNotificationPermission> {
  const isGlobalAdmin = userRole === "ADMIN";
  const membership = await prisma.departmentMember.findUnique({
    where: { departmentId_userId: { departmentId, userId } },
    select: { role: true },
  });
  const canManageDepartment = Boolean(isGlobalAdmin || membership?.role === "HEAD" || membership?.role === "ASSISTANT");

  const projects = await prisma.project.findMany({
    where: canManageDepartment
      ? { departmentId }
      : {
          departmentId,
          ownerId: userId,
        },
    select: { id: true, name: true, key: true },
    orderBy: { name: "asc" },
  });

  return {
    canCreate: canManageDepartment || projects.length > 0,
    canCreateDepartment: canManageDepartment,
    canManageDepartment,
    manageableProjects: projects,
  };
}

export async function ensureDueIssueSystemNotifications(departmentId: string, locale: Locale) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const dateKey = formatDateKey(startOfToday);

  const dueIssues = await prisma.issue.findMany({
    where: {
      dueDate: { gte: startOfToday, lt: startOfTomorrow },
      project: { departmentId },
    },
    select: {
      id: true,
      key: true,
      title: true,
      status: true,
      assigneeId: true,
      projectId: true,
      project: {
        select: {
          key: true,
          name: true,
          workflowStatuses: {
            where: { category: "DONE" },
            select: { key: true },
          },
        },
      },
    },
  });

  for (const issue of dueIssues) {
    const doneKeys = new Set(issue.project.workflowStatuses.map((status) => status.key));
    if (doneKeys.has(issue.status)) continue;

    const assigneeId = issue.assigneeId;
    if (!assigneeId) continue;

    const dedupeKey = `issue-due:${issue.id}:${dateKey}`;
    const existing = await prisma.announcement.findUnique({
      where: { dedupeKey },
      select: { id: true },
    });
    if (existing) continue;

    const title = locale === "zh" ? `任务今日到期：${issue.key} ${issue.title}` : `Task due today: ${issue.key} ${issue.title}`;
    const content =
      locale === "zh"
        ? `任务 ${issue.key}（${issue.title}）今日到期且尚未完成。\n项目：${issue.project.name}`
        : `Issue ${issue.key} (${issue.title}) is due today and is not complete.\nProject: ${issue.project.name}`;

    await prisma.$transaction(async (tx) => {
      const notification = await tx.announcement.create({
        data: {
          level: "SYSTEM",
          title,
          content,
          status: "SENT",
          departmentId,
          projectId: issue.projectId,
          authorId: null,
          dedupeKey,
        },
        select: { id: true },
      });

      await tx.announcementReceipt.createMany({
        data: [
          {
          announcementId: notification.id,
          userId: assigneeId,
          projectId: issue.projectId,
          },
        ],
      });
    });
  }
}

function mapReceiptToListItem(
  receipt: {
    id: string;
    read: boolean;
    createdAt: Date;
    announcement: {
      id: string;
      level: string;
      title: string;
      content: string;
      status: string;
      createdAt: Date;
      revokedAt: Date | null;
      dedupeKey: string | null;
      authorId: string | null;
      author: { name: string | null; email: string } | null;
      projectId: string | null;
      project: { name: string; key: string } | null;
    };
  },
  locale: Locale,
  canManageDepartment: boolean,
  currentUserId: string,
) {
  const announcement = receipt.announcement;
  const authorName = announcement.author
    ? announcement.author.name || announcement.author.email
    : locale === "zh"
      ? "系统"
      : "System";
  const canManage = announcement.level !== "SYSTEM" && announcement.authorId !== null && announcement.authorId === currentUserId;
  const canDelete = canManage;
  const category = announcement.level === "SYSTEM" ? "REMINDER" : "ANNOUNCEMENT";
  const dueIssueId = announcement.dedupeKey?.startsWith("issue-due:")
    ? announcement.dedupeKey.split(":")[1]
    : null;

  return {
    receiptId: receipt.id,
    id: announcement.id,
    source: "ANNOUNCEMENT",
    category,
    level: announcement.level as DepartmentNotificationLevel,
    typeLabel: getNotificationTypeLabel(category, announcement.level, locale),
    title: announcement.title,
    content: announcement.content,
    status: announcement.status as DepartmentNotificationStatus,
    read: receipt.read,
    createdAt: announcement.createdAt.toISOString(),
    revokedAt: announcement.revokedAt?.toISOString() ?? null,
    authorName,
    authorId: announcement.authorId,
    projectId: announcement.projectId,
    projectName: announcement.project?.name ?? null,
    canManage,
    canDelete,
    targetUrl: dueIssueId ? `/issues/${dueIssueId}` : null,
  } satisfies DepartmentNotificationListItem;
}

function getNotificationTypeLabel(
  category: DepartmentNotificationCategory,
  level: DepartmentNotificationLevel | string,
  locale: Locale,
) {
  if (category === "REMINDER") return locale === "zh" ? "提醒" : "Reminder";
  if (category === "UPDATE") return locale === "zh" ? "动态" : "Update";
  if (level === "PROJECT") return locale === "zh" ? "项目公告" : "Project announcement";
  if (level === "SYSTEM") return locale === "zh" ? "系统通知" : "System notification";
  return locale === "zh" ? "部门公告" : "Department announcement";
}

function getSystemNotificationType(type: string, locale: Locale) {
  if (type === "MEETING") return locale === "zh" ? "会议提醒" : "Meeting";
  if (type === "MENTION") return locale === "zh" ? "提及" : "Mention";
  if (type === "ASSIGNMENT") return locale === "zh" ? "Issue 指派" : "Issue assignment";
  if (type === "WATCHER") return locale === "zh" ? "Issue 动态" : "Issue update";
  return locale === "zh" ? "工作动态" : "Work update";
}

function getSystemNotificationCategory(type: string): DepartmentNotificationCategory {
  return type === "MEETING" ? "REMINDER" : "UPDATE";
}

function mapSystemNotificationToListItem(
  notification: {
    id: string;
    type: string;
    message: string;
    link: string | null;
    read: boolean;
    createdAt: Date;
    actorId: string | null;
    actor: { name: string | null; email: string } | null;
  },
  locale: Locale,
  issueProjects: Map<string, { id: string; name: string }>,
): DepartmentNotificationListItem {
  const category = getSystemNotificationCategory(notification.type);
  const actorName = notification.actor
    ? notification.actor.name || notification.actor.email
    : locale === "zh"
      ? "系统"
      : "System";

  const issueProject = notification.link ? issueProjects.get(notification.link) : undefined;

  return {
    receiptId: `notification-${notification.id}`,
    id: notification.id,
    source: "NOTIFICATION",
    category,
    level: "SYSTEM",
    typeLabel: getSystemNotificationType(notification.type, locale),
    title: notification.message,
    content: notification.message,
    status: "SENT",
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
    revokedAt: null,
    authorName: actorName,
    authorId: notification.actorId,
    projectId: issueProject?.id ?? null,
    projectName: issueProject?.name ?? null,
    canManage: false,
    canDelete: false,
    targetUrl: notification.link,
  };
}

async function getDepartmentNotificationIssueProjects(departmentId: string, projectIds: string[]) {
  const issues = await prisma.issue.findMany({
    where: {
      project: {
        departmentId,
        ...(projectIds.length > 0 ? { id: { in: projectIds } } : {}),
      },
    },
    select: {
      id: true,
      project: { select: { id: true, name: true } },
    },
  });
  return new Map(issues.map((issue) => [`/issues/${issue.id}`, issue.project]));
}

export async function getLatestDepartmentNotifications({
  departmentId,
  userId,
  userRole,
  locale,
  take = 5,
}: {
  departmentId: string;
  userId: string;
  userRole?: string | null;
  locale: Locale;
  take?: number;
}) {
  await ensureDueIssueSystemNotifications(departmentId, locale);
  const permission = await getDepartmentNotificationPermission(departmentId, { userId, userRole });
  const receipts = await prisma.announcementReceipt.findMany({
    where: {
      userId,
      announcement: {
        departmentId,
        status: "SENT",
        level: { in: ["DEPARTMENT", "PROJECT"] },
      },
    },
    include: {
      announcement: {
        include: {
          author: { select: { name: true, email: true } },
          project: { select: { name: true, key: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take,
  });

  return {
    permission,
    notifications: receipts.map((receipt) =>
      mapReceiptToListItem(receipt, locale, permission.canManageDepartment, userId),
    ),
  };
}

export async function getDepartmentNotificationsPage({
  departmentId,
  userId,
  userRole,
  locale,
  filters,
}: {
  departmentId: string;
  userId: string;
  userRole?: string | null;
  locale: Locale;
  filters: {
    category?: string;
    projectId?: string;
    read?: string;
    publishStatus?: string;
    view?: string;
    search?: string;
    sort?: string;
    direction?: string;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  };
}) {
  await ensureDueIssueSystemNotifications(departmentId, locale);
  const permission = await getDepartmentNotificationPermission(departmentId, { userId, userRole });
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (filters.from) createdAt.gte = filters.from;
  if (filters.to) createdAt.lte = filters.to;
  const hasDateFilter = Boolean(createdAt.gte || createdAt.lte);
  const readValues = filters.read ? filters.read.split(",") : [];
  const readFilter =
    readValues.length === 2
      ? undefined
      : readValues.includes("read")
        ? true
        : readValues.includes("unread")
          ? false
          : undefined;
  const search = filters.search?.trim();
  const view = filters.view === "sent" && permission.canCreate ? "sent" : "received";
  const categoryValues = filters.category ? filters.category.split(",") : [];
  const projectIds = filters.projectId ? filters.projectId.split(",") : [];
  const publishStatusValues = filters.publishStatus ? filters.publishStatus.split(",") : [];

  const baseWhere = {
    departmentId,
    ...(projectIds.length > 0 ? { projectId: { in: projectIds } } : {}),
    ...(hasDateFilter ? { createdAt } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search } },
            { content: { contains: search } },
          ],
        }
      : {}),
  };

  const announcementCategoryWhere =
    categoryValues.length === 0
      ? {}
      : categoryValues.includes("ANNOUNCEMENT") && categoryValues.includes("REMINDER")
        ? {}
        : categoryValues.includes("ANNOUNCEMENT")
          ? { level: { in: ["DEPARTMENT", "PROJECT"] as DepartmentNotificationLevel[] } }
          : categoryValues.includes("REMINDER")
            ? { level: "SYSTEM" }
            : { id: "__none__" };

  if (view === "sent") {
    const sentCategoryWhere =
      categoryValues.length === 0 || categoryValues.includes("ANNOUNCEMENT") ? {} : { id: "__none__" };
    const sentWhere = {
      ...baseWhere,
      ...sentCategoryWhere,
      level: { not: "SYSTEM" },
      authorId: userId,
      ...(publishStatusValues.length === 1 ? { status: publishStatusValues[0] } : {}),
    };
    const announcements = await prisma.announcement.findMany({
      where: sentWhere,
      include: {
        author: { select: { name: true, email: true } },
        project: { select: { name: true, key: true } },
        receipts: {
          where: { userId },
          select: { id: true, read: true, createdAt: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const items = announcements.map((announcement) => {
      const receipt = announcement.receipts[0] || {
        id: `sent-${announcement.id}`,
        read: true,
        createdAt: announcement.createdAt,
      };
      return mapReceiptToListItem(
        {
          id: receipt.id,
          read: receipt.read,
          createdAt: receipt.createdAt,
          announcement,
        },
        locale,
        permission.canManageDepartment,
        userId,
      );
    });
    return {
      notifications: paginateAndSortNotifications(items, filters),
      permission,
      total: items.length,
    };
  }

  const visibleWhere = {
    ...baseWhere,
    ...announcementCategoryWhere,
    status: "SENT",
    receipts: {
      some: {
        userId,
        ...(readFilter === undefined ? {} : { read: readFilter }),
      },
    },
  };

  const notificationIssueProjects = await getDepartmentNotificationIssueProjects(departmentId, projectIds);
  const notificationLinks = Array.from(notificationIssueProjects.keys());
  const includeMeetings = projectIds.length === 0;
  const includeUpdates = categoryValues.length === 0 || categoryValues.includes("UPDATE");
  const includeReminders = categoryValues.length === 0 || categoryValues.includes("REMINDER");
  const notificationWhere: Prisma.NotificationWhereInput = {
    userId,
    ...(readFilter === undefined ? {} : { read: readFilter }),
    ...(hasDateFilter ? { createdAt } : {}),
    ...(search ? { message: { contains: search } } : {}),
    OR: [
      ...(includeUpdates && notificationLinks.length > 0
        ? [{ link: { in: notificationLinks }, type: { not: "MEETING" } }]
        : []),
      ...(includeReminders && includeMeetings
        ? [{ link: { startsWith: `/departments/${departmentId}/items` }, type: "MEETING" }]
        : []),
    ],
  };

  const [announcements, systemNotifications] = await Promise.all([
    prisma.announcement.findMany({
      where: visibleWhere,
      include: {
        author: { select: { name: true, email: true } },
        project: { select: { name: true, key: true } },
        receipts: {
          where: { userId },
          select: { id: true, read: true, createdAt: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    notificationWhere.OR && notificationWhere.OR.length > 0
      ? prisma.notification.findMany({
          where: notificationWhere,
          include: { actor: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const items = [
    ...announcements.map((announcement) => {
      const receipt = announcement.receipts[0] || {
        id: `received-${announcement.id}`,
        read: true,
        createdAt: announcement.createdAt,
      };
      return mapReceiptToListItem(
        {
          id: receipt.id,
          read: receipt.read,
          createdAt: receipt.createdAt,
          announcement,
        },
        locale,
        permission.canManageDepartment,
        userId,
      );
    }),
    ...systemNotifications.map((notification) =>
      mapSystemNotificationToListItem(notification, locale, notificationIssueProjects),
    ),
  ];

  return {
    notifications: paginateAndSortNotifications(items, filters),
    permission,
    total: items.length,
  };
}

function paginateAndSortNotifications(
  items: DepartmentNotificationListItem[],
  filters: {
    sort?: string;
    direction?: string;
    page: number;
    pageSize: number;
  },
) {
  const direction = filters.direction === "asc" ? 1 : -1;
  const sorted = [...items].sort((a, b) => {
    const sort = filters.sort || "createdAt";
    let result = 0;
    if (sort === "title") {
      result = a.title.localeCompare(b.title);
    } else if (sort === "level") {
      result = a.typeLabel.localeCompare(b.typeLabel);
    } else if (sort === "project") {
      result = (a.projectName || "").localeCompare(b.projectName || "");
    } else if (sort === "author") {
      result = a.authorName.localeCompare(b.authorName);
    } else {
      result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (result === 0) {
      result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return result * direction;
  });

  return sorted.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize);
}
