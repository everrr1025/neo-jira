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
  createdAt: string;
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
    projects: department.projects.map((project) => ({
      id: project.id,
      name: project.name,
      key: project.key,
      description: project.description,
      ownerId: project.owner?.id || null,
      ownerName: project.owner?.name || project.owner?.email || (locale === "zh" ? "未指派" : "Unassigned"),
      issuesCount: project._count.issues,
      createdAt: project.createdAt.toISOString(),
      members: project.members.map((member) => ({
        userId: member.userId,
        role: member.role,
        userName: member.user.name,
        userEmail: member.user.email,
      })),
    })),
    announcements: department.announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      isPinned: announcement.isPinned,
      authorName:
        announcement.author.name || announcement.author.email || (locale === "zh" ? "系统" : "System"),
      createdAt: announcement.createdAt.toISOString(),
    })),
  } satisfies DepartmentWorkspaceData;
}
