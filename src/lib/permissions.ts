import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import {
  buildVisibleDepartmentProjectsWhere,
  canManageDepartment,
} from "@/lib/departmentPermissions";
import prisma from "@/lib/prisma";

type SessionUser = {
  id?: string;
  role?: string | null;
};

/**
 * Get the current authenticated session. Throws if not logged in.
 */
export async function getRequiredSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized. Please log in.");
  }
  return session;
}

/**
 * Check if the current user is a global ADMIN.
 */
export async function checkGlobalAdmin() {
  const session = await getRequiredSession();
  const sessionUser = session.user as SessionUser;
  if (!sessionUser.id) {
    throw new Error("Unauthorized. Admin access required.");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true },
  });
  if (currentUser?.role !== "ADMIN") {
    throw new Error("Unauthorized. Admin access required.");
  }
  return session;
}

/**
 * Get a user's role in a specific project.
 * Returns "ADMIN" | "MEMBER" | null (null = not a member)
 */
export async function getProjectRole(userId: string, projectId: string): Promise<string | null> {
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (membership?.role) {
    return membership.role;
  }

  return null;
}

export async function canAccessProjectData(userId: string, projectId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...buildVisibleDepartmentProjectsWhere(userId),
    },
    select: { id: true },
  });

  return Boolean(project);
}

/**
 * Check if the current user is a project admin (either global ADMIN or project-level ADMIN).
 * Throws if not authorized.
 */
export async function checkProjectAdmin(projectId: string) {
  const session = await getRequiredSession();
  const userId = (session.user as SessionUser).id;
  if (!userId) {
    throw new Error("Unauthorized. Please log in.");
  }
  const role = await getProjectRole(userId, projectId);

  if (role !== "ADMIN") {
    throw new Error("Unauthorized. Project admin access required.");
  }
  return session;
}

export async function canConfigureProjectFields(userId: string, projectId: string): Promise<boolean> {
  const role = await getProjectRole(userId, projectId);
  return role === "ADMIN";
}

export async function checkDepartmentAdmin(departmentId: string) {
  const session = await getRequiredSession();
  const sessionUser = session.user as SessionUser;
  const userId = sessionUser.id;
  if (!userId) {
    throw new Error("Unauthorized. Please log in.");
  }
  if (!(await canManageDepartment(userId, departmentId, sessionUser.role))) {
    throw new Error("Unauthorized. Department admin access required.");
  }
  return session;
}

export async function canManageProjectPlanning(userId: string, projectId: string): Promise<boolean> {
  return canConfigureProjectFields(userId, projectId);
}

export async function checkProjectFieldConfig(projectId: string) {
  const session = await getRequiredSession();
  const userId = (session.user as SessionUser).id;
  if (!userId) {
    throw new Error("Unauthorized. Please log in.");
  }

  const canConfigure = await canConfigureProjectFields(userId, projectId);
  if (!canConfigure) {
    throw new Error("Unauthorized. Project field configuration access required.");
  }

  return session;
}

export async function checkProjectPlanning(projectId: string) {
  const session = await getRequiredSession();
  const userId = (session.user as SessionUser).id;
  if (!userId) {
    throw new Error("Unauthorized. Please log in.");
  }

  const canManage = await canManageProjectPlanning(userId, projectId);
  if (!canManage) {
    throw new Error("Unauthorized. Project planning access required.");
  }

  return session;
}

/**
 * Check if the current user is a member of the project.
 * Throws if not a member.
 */
export async function checkProjectMember(projectId: string) {
  const session = await getRequiredSession();
  const userId = (session.user as SessionUser).id;
  if (!userId) {
    throw new Error("Unauthorized. Please log in.");
  }
  const role = await getProjectRole(userId, projectId);

  if (!role) {
    throw new Error("Unauthorized. You are not a member of this project.");
  }
  return session;
}
