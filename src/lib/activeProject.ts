import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const ACTIVE_PROJECT_COOKIE = "activeProjectId";

type BasicProject = {
  id: string;
  name: string;
  key: string;
};

export async function getVisibleProjectsForUser(
  userId?: string,
  userRole?: string
): Promise<BasicProject[]> {
  if (!userId) return [];

  if (userRole === "ADMIN") {
    return prisma.project.findMany({
      select: { id: true, name: true, key: true },
      orderBy: { name: "asc" },
    });
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: {
      project: {
        select: { id: true, name: true, key: true },
      },
    },
  });

  return memberships
    .map((m) => m.project)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getActiveProjectIdForUser(
  userId?: string,
  userRole?: string
): Promise<string | null> {
  if (!userId) return null;

  const cookieStore = await cookies();
  const activeProjectId = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value;
  if (!activeProjectId) return null;

  if (userRole === "ADMIN") {
    const exists = await prisma.project.findUnique({
      where: { id: activeProjectId },
      select: { id: true },
    });
    return exists ? activeProjectId : null;
  }

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId: activeProjectId } },
    select: { id: true },
  });

  return membership ? activeProjectId : null;
}
