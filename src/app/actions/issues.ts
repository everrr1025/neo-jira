"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getActiveProjectIdForUser } from "@/lib/activeProject";

export async function updateIssueStatus(issueId: string, status: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const issue = await prisma.issue.update({
      where: { id: issueId },
      data: { status }
    });
    
    revalidatePath('/issues');
    revalidatePath('/iterations');
    
    return { success: true, issue };
  } catch (error) {
    console.error('Failed to update issue status:', error);
    return { success: false, error: 'Failed to update issue status' };
  }
}

export async function createIssue(data: {
  title: string;
  description?: string;
  priority: string;
  type: string;
  iterationId?: string | null;
  assigneeId?: string | null;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userId = (session.user as any).id as string;
    const userRole = (session.user as any).role as string;
    const isGlobalAdmin = userRole === "ADMIN";
    const activeProjectId = await getActiveProjectIdForUser(userId, userRole);

    const project = activeProjectId
      ? await prisma.project.findUnique({ where: { id: activeProjectId } })
      : isGlobalAdmin
        ? await prisma.project.findFirst()
        : null;

    const iteration = await prisma.iteration.findFirst({
      where: {
        status: "ACTIVE",
        ...(project ? { projectId: project.id } : {}),
      },
    });

    if (!project) throw new Error("Project not found or no access");

    const count = await prisma.issue.count({ where: { projectId: project.id } });
    const issueKey = `${project.key}-${count + 1}`;

    console.log("Creating issue with data:", data, "and reporterId:", userId);
    const newIssue = await prisma.issue.create({
      data: {
        key: issueKey,
        title: data.title,
        description: data.description,
        status: "TODO",
        priority: data.priority,
        type: data.type,
        projectId: project.id,
        iterationId: data.iterationId !== undefined ? data.iterationId : iteration?.id,
        assigneeId: data.assigneeId,
        reporterId: userId,
      }
    });

    revalidatePath("/issues");
    revalidatePath("/iterations");

    return { success: true, issue: newIssue };
  } catch (error: any) {
    console.error("Failed to create issue:", error);
    return { success: false, error: error?.message || "Failed to create issue" };
  }
}

export async function updateIssue(issueId: string, data: any) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const updatedIssue = await prisma.issue.update({
      where: { id: issueId },
      data
    });
    
    revalidatePath(`/issues/${issueId}`);
    revalidatePath('/issues');
    revalidatePath('/iterations');
    
    return { success: true, issue: updatedIssue };
  } catch (error) {
    console.error('Failed to update issue:', error);
    return { success: false, error: 'Failed to update issue' };
  }
}
