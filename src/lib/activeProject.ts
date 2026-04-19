import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { buildActiveProjectWhere, findProjectById, type BasicProject } from "@/lib/activeProjectUtils";

export const ACTIVE_PROJECT_COOKIE = "activeProjectId";
const basicProjectSelect = { id: true, name: true, key: true } as const;

export async function getVisibleProjectsForUser(
  userId?: string,
  userRole?: string
): Promise<BasicProject[]> {
  if (!userId) return [];

  if (userRole === "ADMIN") {
    return prisma.project.findMany({
      select: basicProjectSelect,
      orderBy: { name: "asc" },
    });
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: {
      project: {
        select: basicProjectSelect,
      },
    },
  });

  return memberships
    .map((m) => m.project)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getRequestedActiveProjectId() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value || null;
}

export async function getActiveProjectForUser(
  userId?: string,
  userRole?: string
): Promise<BasicProject | null> {
  if (!userId) return null;

  const activeProjectId = await getRequestedActiveProjectId();
  if (!activeProjectId) return null;

  return prisma.project.findFirst({
    where: buildActiveProjectWhere(userId, userRole, activeProjectId),
    select: basicProjectSelect,
  });
}

export async function getActiveProjectContextForUser(
  userId?: string,
  userRole?: string
): Promise<{ projects: BasicProject[]; activeProject: BasicProject | null }> {
  const projects = await getVisibleProjectsForUser(userId, userRole);
  const activeProjectId = await getRequestedActiveProjectId();

  return {
    projects,
    activeProject: findProjectById(projects, activeProjectId),
  };
}

export async function getActiveProjectIdForUser(
  userId?: string,
  userRole?: string
): Promise<string | null> {
  const activeProject = await getActiveProjectForUser(userId, userRole);
  return activeProject?.id || null;
}
