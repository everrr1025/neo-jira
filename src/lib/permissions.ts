import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

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
  if ((session.user as any).role !== "ADMIN") {
    throw new Error("Unauthorized. Admin access required.");
  }
  return session;
}

/**
 * Get a user's role in a specific project.
 * Returns "ADMIN" | "MEMBER" | null (null = not a member)
 */
export async function getProjectRole(userId: string, projectId: string): Promise<string | null> {
  // Global admins are treated as project admins
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.role === "ADMIN") return "ADMIN";

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return membership?.role ?? null;
}

/**
 * Check if the current user is a project admin (either global ADMIN or project-level ADMIN).
 * Throws if not authorized.
 */
export async function checkProjectAdmin(projectId: string) {
  const session = await getRequiredSession();
  const userId = (session.user as any).id;
  const role = await getProjectRole(userId, projectId);

  if (role !== "ADMIN") {
    throw new Error("Unauthorized. Project admin access required.");
  }
  return session;
}

/**
 * Check if the current user is a member of the project.
 * Throws if not a member.
 */
export async function checkProjectMember(projectId: string) {
  const session = await getRequiredSession();
  const userId = (session.user as any).id;
  const role = await getProjectRole(userId, projectId);

  if (!role) {
    throw new Error("Unauthorized. You are not a member of this project.");
  }
  return session;
}
