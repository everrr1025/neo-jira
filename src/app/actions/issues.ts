"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getActiveProjectIdForUser } from "@/lib/activeProject";
import { checkProjectAdmin } from "@/lib/permissions";
import { notifyIssueMentions } from "@/lib/notifications";

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
  dueDate?: string | null;
  attachments?: { fileName: string; fileUrl: string }[];
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const sessionUser = session.user as { id?: string; role?: string };
    const userId = sessionUser.id;
    if (!userId) throw new Error("Unauthorized");
    const userRole = sessionUser.role ?? "USER";
    const isGlobalAdmin = userRole === "ADMIN";
    const activeProjectId = await getActiveProjectIdForUser(userId, userRole);

    const selectedIteration = data.iterationId
      ? await prisma.iteration.findUnique({
          where: { id: data.iterationId },
          select: { id: true, projectId: true },
        })
      : null;

    if (data.iterationId && !selectedIteration) {
      throw new Error("Sprint not found");
    }

    if (!isGlobalAdmin && selectedIteration && selectedIteration.projectId !== activeProjectId) {
      throw new Error("Unauthorized");
    }

    let targetProjectId = selectedIteration?.projectId || activeProjectId;
    if (!targetProjectId && isGlobalAdmin) {
      targetProjectId = (await prisma.project.findFirst({ select: { id: true } }))?.id || null;
    }
    if (!targetProjectId) throw new Error("Project not found or no access");

    const project = await prisma.project.findUnique({ where: { id: targetProjectId } });
    if (!project) throw new Error("Project not found or no access");

    const activeIteration = data.iterationId
      ? null
      : await prisma.iteration.findFirst({
          where: {
            status: "ACTIVE",
            projectId: project.id,
          },
          select: { id: true },
        });

    const count = await prisma.issue.count({ where: { projectId: project.id } });
    const issueKey = `${project.key}-${count + 1}`;
    const dueDateValue = data.dueDate
      ? (() => {
          const normalized = /^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)
            ? new Date(`${data.dueDate}T00:00:00.000Z`)
            : new Date(data.dueDate);
          if (Number.isNaN(normalized.getTime())) {
            throw new Error("Invalid due date");
          }
          return normalized;
        })()
      : null;

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
        iterationId: data.iterationId ?? activeIteration?.id ?? null,
        assigneeId: data.assigneeId,
        reporterId: userId,
        dueDate: dueDateValue,
        attachments: data.attachments && data.attachments.length > 0 ? {
          create: data.attachments.map(att => ({
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            uploaderId: userId,
          }))
        } : undefined,
      }
    });

    if (typeof data.description === "string" && data.description.trim()) {
      await notifyIssueMentions({
        actorId: userId,
        issueId: newIssue.id,
        issueKey: newIssue.key,
        projectId: newIssue.projectId,
        content: data.description,
      });
    }

    revalidatePath("/issues");
    revalidatePath("/iterations");

    return { success: true, issue: newIssue };
  } catch (error: unknown) {
    console.error("Failed to create issue:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create issue" };
  }
}

export async function updateIssue(issueId: string, data: Record<string, unknown>) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userId = (session.user as { id?: string }).id;
    if (!userId) throw new Error("Unauthorized");

    const existingIssue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        key: true,
        projectId: true,
        description: true,
      },
    });
    if (!existingIssue) throw new Error("Issue not found");

    const updatedIssue = await prisma.issue.update({
      where: { id: issueId },
      data
    });

    const nextDescription =
      typeof data.description === "string" ? data.description : data.description === null ? "" : null;

    if (nextDescription !== null && nextDescription !== (existingIssue.description || "")) {
      await notifyIssueMentions({
        actorId: userId,
        issueId: existingIssue.id,
        issueKey: existingIssue.key,
        projectId: existingIssue.projectId,
        content: nextDescription,
        previousContent: existingIssue.description,
      });
    }
    
    revalidatePath(`/issues/${issueId}`);
    revalidatePath('/issues');
    revalidatePath('/iterations');
    
    return { success: true, issue: updatedIssue };
  } catch (error: unknown) {
    console.error('Failed to update issue:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update issue' };
  }
}

export async function deleteIssue(issueId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, projectId: true },
    });

    if (!issue) {
      return { success: false, error: "Issue not found" };
    }

    await checkProjectAdmin(issue.projectId);

    const issuePath = `/issues/${issueId}`;

    await prisma.$transaction([
      prisma.notification.deleteMany({
        where: {
          OR: [{ link: issuePath }, { link: { startsWith: `${issuePath}?` } }],
        },
      }),
      prisma.issue.delete({ where: { id: issueId } }),
    ]);

    revalidatePath("/issues");
    revalidatePath("/iterations");

    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to delete issue:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete issue" };
  }
}
