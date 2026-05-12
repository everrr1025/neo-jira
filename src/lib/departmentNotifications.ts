import prisma from "@/lib/prisma";
import type { Locale } from "@/lib/i18n";
import type { Prisma } from "@prisma/client";

export type DepartmentNotificationLevel = "DEPARTMENT" | "PROJECT" | "SYSTEM";
export type DepartmentNotificationStatus = "SENT" | "REVOKED";

export type DepartmentNotificationListItem = {
  receiptId: string;
  id: string;
  level: DepartmentNotificationLevel;
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
          OR: [{ ownerId: userId }, { members: { some: { userId, role: "ADMIN" } } }],
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
      reporterId: true,
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

    const recipientIds = Array.from(new Set([issue.assigneeId, issue.reporterId].filter(Boolean))) as string[];
    if (recipientIds.length === 0) continue;

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
        data: recipientIds.map((userId) => ({
          announcementId: notification.id,
          userId,
          projectId: issue.projectId,
        })),
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
  const canManage =
    announcement.level !== "SYSTEM" &&
    (canManageDepartment || (announcement.authorId !== null && announcement.authorId === currentUserId));
  const canDelete = announcement.authorId !== null && announcement.authorId === currentUserId;

  return {
    receiptId: receipt.id,
    id: announcement.id,
    level: announcement.level as DepartmentNotificationLevel,
    title: announcement.title,
    content: announcement.content,
    status: announcement.status as DepartmentNotificationStatus,
    read: receipt.read,
    createdAt: announcement.createdAt.toISOString(),
    revokedAt: announcement.revokedAt?.toISOString() ?? null,
    authorName,
    authorId: announcement.authorId,
    projectId: announcement.projectId,
    projectName: announcement.project ? `${announcement.project.name} (${announcement.project.key})` : null,
    canManage,
    canDelete,
  } satisfies DepartmentNotificationListItem;
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
    orderBy: [{ read: "asc" }, { createdAt: "desc" }],
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
    level?: string;
    projectId?: string;
    read?: string;
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
  const readFilter =
    filters.read === "read" ? true : filters.read === "unread" ? false : undefined;
  const search = filters.search?.trim();
  const sortDirection: Prisma.SortOrder = filters.direction === "asc" ? "asc" : "desc";
  const orderBy: Prisma.AnnouncementOrderByWithRelationInput[] =
    filters.sort === "title"
      ? [{ title: sortDirection }, { createdAt: "desc" }]
      : filters.sort === "level"
        ? [{ level: sortDirection }, { createdAt: "desc" }]
        : filters.sort === "project"
          ? [{ project: { name: sortDirection } }, { createdAt: "desc" }]
          : filters.sort === "author"
            ? [{ author: { name: sortDirection } }, { createdAt: "desc" }]
            : [{ createdAt: sortDirection }];

  const baseWhere = {
    departmentId,
    ...(filters.level ? { level: filters.level } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
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

  const visibleWhere = {
    ...baseWhere,
    OR: [
      {
        status: "SENT",
        receipts: {
          some: {
            userId,
            ...(readFilter === undefined ? {} : { read: readFilter }),
          },
        },
      },
      {
        status: "REVOKED",
        level: { not: "SYSTEM" },
        ...(permission.canManageDepartment ? {} : { authorId: userId }),
      },
    ],
  };

  const [total, announcements] = await Promise.all([
    prisma.announcement.count({ where: visibleWhere }),
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
      orderBy,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  const notifications = announcements.map((announcement) => {
    const receipt = announcement.receipts[0] || {
      id: `management-${announcement.id}`,
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
    notifications,
    permission,
    total,
  };
}
