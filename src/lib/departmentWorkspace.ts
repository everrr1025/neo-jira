import prisma from "@/lib/prisma";
import type { Locale } from "@/lib/i18n";

export type DepartmentWorkspaceMember = {
  userId: string;
  role: string;
  isDepartmentAdmin: boolean;
  positionId: string | null;
  positionName: string | null;
  projectScopeType: string;
  managedProjectIds: string[];
  taskAssigneeIds: string[];
  taskPositionIds: string[];
  taskProjectScopeType: string;
  taskProjectIds: string[];
  canCreateDepartmentAnnouncements: boolean;
  announcementProjectScopeType: string;
  announcementProjectIds: string[];
  userName: string | null;
  userEmail: string;
  disabledAt: string | null;
  projects: Array<{
    id: string;
    name: string;
    key: string;
    role: string;
  }>;
};

export type DepartmentWorkspaceProject = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string;
  issuesCount: number;
  completedIssuesCount: number;
  incompleteIssuesCount: number;
  activeIterationIssuesCount: number;
  activeIterationCompletedIssuesCount: number;
  createdAt: string;
  activeIteration: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  } | null;
  priorityIssues: Array<{
    id: string;
    key: string;
    title: string;
    priority: string;
    dueDate: string | null;
    assigneeName: string;
  }>;
  members: Array<{
    userId: string;
    role: string;
    userName: string | null;
    userEmail: string;
    disabledAt: string | null;
  }>;
};

export type DepartmentWorkspaceAnnouncement = {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  authorName: string;
  createdAt: string;
};

export type DepartmentWorkspaceData = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  headName: string | null;
  positions: Array<{
    id: string;
    name: string;
    sortOrder: number;
  }>;
  members: DepartmentWorkspaceMember[];
  projects: DepartmentWorkspaceProject[];
  announcements: DepartmentWorkspaceAnnouncement[];
};

export function filterDepartmentWorkspaceProjectsForUser(
  department: DepartmentWorkspaceData,
  userId: string,
  canViewAllProjects: boolean,
): DepartmentWorkspaceData {
  if (canViewAllProjects) return department;

  const currentMember = department.members.find((member) => member.userId === userId);
  const managedProjectIds = new Set(currentMember?.managedProjectIds || []);

  return {
    ...department,
    projects: department.projects.filter((project) =>
      project.ownerId === userId ||
      managedProjectIds.has(project.id) ||
      project.members.some((member) => member.userId === userId),
    ),
  };
}

export async function getDepartmentWorkspaceData(departmentId: string, locale: Locale) {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    include: {
      members: {
        include: {
          position: { select: { id: true, name: true } },
          managedProjects: { select: { projectId: true } },
          taskAssigneeScopes: { select: { assigneeUserId: true } },
          taskPositionScopes: { select: { positionId: true } },
          taskProjectScopes: { select: { projectId: true } },
          announcementProjectScopes: { select: { projectId: true } },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              disabledAt: true,
              projectMemberships: {
                include: {
                  project: {
                    select: { id: true, name: true, key: true, departmentId: true },
                  },
                },
              },
            },
          },
        },
      },
      positions: {
        select: { id: true, name: true, sortOrder: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      projects: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, disabledAt: true } },
            },
          },
          _count: { select: { issues: true } },
          issues: {
            select: {
              id: true,
              key: true,
              title: true,
              priority: true,
              status: true,
              iterationId: true,
              dueDate: true,
              assignee: { select: { name: true, email: true } },
            },
          },
          workflowStatuses: {
            where: { category: "DONE" },
            select: { key: true },
          },
          iterations: {
            where: { status: "ACTIVE" },
            select: { id: true, name: true, startDate: true, endDate: true },
            orderBy: { startDate: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      },
      announcements: {
        include: {
          author: {
            select: { name: true, email: true },
          },
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 6,
      },
    },
  });

  if (!department) {
    return null;
  }

  const head = department.members.find((member) => member.isDepartmentAdmin);

  return {
    id: department.id,
    name: department.name,
    key: department.key,
    description: department.description,
    headName: head ? head.user.name || head.user.email : null,
    positions: department.positions,
    members: department.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      isDepartmentAdmin: member.isDepartmentAdmin,
      positionId: member.positionId,
      positionName: member.position?.name || null,
      projectScopeType: member.projectScopeType,
      managedProjectIds: member.managedProjects.map((project) => project.projectId),
      taskAssigneeIds: member.taskAssigneeScopes.map((scope) => scope.assigneeUserId),
      taskPositionIds: member.taskPositionScopes.map((scope) => scope.positionId),
      taskProjectScopeType: member.taskProjectScopeType,
      taskProjectIds: member.taskProjectScopes.map((scope) => scope.projectId),
      canCreateDepartmentAnnouncements: member.canCreateDepartmentAnnouncements,
      announcementProjectScopeType: member.announcementProjectScopeType,
      announcementProjectIds: member.announcementProjectScopes.map((scope) => scope.projectId),
      userName: member.user.name,
      userEmail: member.user.email,
      disabledAt: member.user.disabledAt?.toISOString() ?? null,
      projects: member.user.projectMemberships
        .filter((membership) => membership.project.departmentId === department.id)
        .map((membership) => ({
          id: membership.project.id,
          name: membership.project.name,
          key: membership.project.key,
          role: membership.role,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })),
    projects: department.projects.map((project) => {
      const doneStatusKeys = new Set(project.workflowStatuses.map((status) => status.key));
      if (doneStatusKeys.size === 0) doneStatusKeys.add("DONE");
      const completedIssuesCount = project.issues.filter((issue) => doneStatusKeys.has(issue.status)).length;
      const activeIteration = project.iterations[0] || null;
      const activeIterationIssues = activeIteration
        ? project.issues.filter((issue) => issue.iterationId === activeIteration.id)
        : [];
      const activeIterationCompletedIssuesCount = activeIterationIssues.filter((issue) =>
        doneStatusKeys.has(issue.status),
      ).length;
      const priorityIssues = project.issues
        .filter((issue) => Boolean(activeIteration) && issue.iterationId === activeIteration?.id)
        .filter((issue) => !doneStatusKeys.has(issue.status))
        .filter((issue) => issue.priority === "URGENT" || issue.priority === "HIGH")
        .sort((left, right) => {
          const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1 };
          return (priorityOrder[left.priority] ?? 2) - (priorityOrder[right.priority] ?? 2);
        })
        .map((issue) => ({
          id: issue.id,
          key: issue.key,
          title: issue.title,
          priority: issue.priority,
          dueDate: issue.dueDate?.toISOString() || null,
          assigneeName: issue.assignee?.name || issue.assignee?.email || (locale === "zh" ? "未指派" : "Unassigned"),
        }));

      return {
        id: project.id,
        name: project.name,
        key: project.key,
        description: project.description,
        ownerId: project.owner?.id || null,
        ownerName: project.owner?.name || project.owner?.email || (locale === "zh" ? "未指派" : "Unassigned"),
        issuesCount: project._count.issues,
        completedIssuesCount,
        incompleteIssuesCount: project._count.issues - completedIssuesCount,
        activeIterationIssuesCount: activeIterationIssues.length,
        activeIterationCompletedIssuesCount,
        createdAt: project.createdAt.toISOString(),
        activeIteration: activeIteration
          ? {
              id: activeIteration.id,
              name: activeIteration.name,
              startDate: activeIteration.startDate.toISOString(),
              endDate: activeIteration.endDate.toISOString(),
            }
          : null,
        priorityIssues,
        members: project.members.map((member) => ({
          userId: member.userId,
          role: member.role,
          userName: member.user.name,
          userEmail: member.user.email,
          disabledAt: member.user.disabledAt?.toISOString() ?? null,
        })),
      };
    }),
    announcements: department.announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      isPinned: announcement.isPinned,
      authorName:
        announcement.author?.name || announcement.author?.email || (locale === "zh" ? "系统" : "System"),
      createdAt: announcement.createdAt.toISOString(),
    })),
  } satisfies DepartmentWorkspaceData;
}
