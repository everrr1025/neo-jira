import { cookies } from "next/headers";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import {
  buildActiveProjectWhere,
  buildVisibleProjectsWhere,
  findProjectById,
  type BasicProject,
} from "@/lib/activeProjectUtils";
import {
  ACTIVE_PROJECT_COOKIE,
  PROJECT_ROUTE_DEPARTMENT_HEADER,
  PROJECT_ROUTE_PROJECT_HEADER,
} from "@/lib/projectRoutes";

export { ACTIVE_PROJECT_COOKIE } from "@/lib/projectRoutes";
const basicProjectSelect = { id: true, name: true, key: true, departmentId: true } as const;

export async function getVisibleProjectsForUser(
  userId?: string,
  userRole?: string
): Promise<BasicProject[]> {
  if (!userId) return [];

  const projects = await prisma.project.findMany({
    where: buildVisibleProjectsWhere(userId, userRole),
    select: basicProjectSelect,
    orderBy: { name: "asc" },
  });
  return projects.filter((project): project is BasicProject => Boolean(project.departmentId));
}

export async function getRequestedProjectRouteContext() {
  const headerStore = await headers();
  const projectId = headerStore.get(PROJECT_ROUTE_PROJECT_HEADER);
  const departmentId = headerStore.get(PROJECT_ROUTE_DEPARTMENT_HEADER);

  return projectId && departmentId ? { projectId, departmentId } : null;
}

async function getRequestedActiveProject() {
  const routeContext = await getRequestedProjectRouteContext();
  if (routeContext) return routeContext;

  const cookieStore = await cookies();
  const projectId = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value || null;
  return projectId ? { projectId, departmentId: null } : null;
}

export async function getActiveProjectForUser(
  userId?: string,
  userRole?: string
): Promise<BasicProject | null> {
  if (!userId) return null;

  const requestedProject = await getRequestedActiveProject();
  if (!requestedProject) return null;

  const project = await prisma.project.findFirst({
    where: buildActiveProjectWhere(
      userId,
      userRole,
      requestedProject.projectId,
      requestedProject.departmentId,
    ),
    select: basicProjectSelect,
  });
  return project?.departmentId
    ? { ...project, departmentId: project.departmentId }
    : null;
}

export async function getActiveProjectContextForUser(
  userId?: string,
  userRole?: string
): Promise<{ projects: BasicProject[]; activeProject: BasicProject | null }> {
  const projects = await getVisibleProjectsForUser(userId, userRole);
  const activeProject = await getActiveProjectForUser(userId, userRole);

  return {
    projects,
    activeProject: findProjectById(projects, activeProject?.id),
  };
}

export async function getActiveProjectIdForUser(
  userId?: string,
  userRole?: string
): Promise<string | null> {
  const activeProject = await getActiveProjectForUser(userId, userRole);
  return activeProject?.id || null;
}
