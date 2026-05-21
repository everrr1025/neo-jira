import prisma from "@/lib/prisma";
import type { Locale } from "@/lib/i18n";

export type DepartmentWorkspaceMember = {
  userId: string;
  role: string;
  userName: string | null;
  userEmail: string;
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

  return {
    ...department,
    projects: department.projects.filter((project) =>
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
          user: {
            select: {
              id: true,
              name: true,
              email: true,
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
      projects: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
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

  const head = department.members.find((member) => member.role === "HEAD");

  return {
    id: department.id,
    name: department.name,
    key: department.key,
    description: department.description,
    headName: head ? head.user.name || head.user.email : null,
    members: department.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      userName: member.user.name,
      userEmail: member.user.email,
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
