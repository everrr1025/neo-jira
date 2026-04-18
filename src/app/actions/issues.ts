"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getActiveProjectIdForUser } from "@/lib/activeProject";
import { checkProjectAdmin } from "@/lib/permissions";
import { notifyIssueMentions } from "@/lib/notifications";
import { buildIssueUpdateAuditLogs, createAuditLogs, type IssueAuditSnapshot } from "@/lib/audit";
import {
  canTransitionWorkflowStatus,
  createDefaultWorkflowForProject,
  getInitialWorkflowStatusKey,
  isDoneWorkflowStatus,
  type WorkflowStatusRecord,
  type WorkflowTransitionRecord,
} from "@/lib/workflows";

const issueAuditSelect = {
  id: true,
  key: true,
  projectId: true,
  title: true,
  status: true,
  priority: true,
  type: true,
  assigneeId: true,
  iterationId: true,
  dueDate: true,
  description: true,
} as const;

const workflowSelect = {
  workflowStatuses: {
    select: {
      id: true,
      key: true,
      name: true,
      category: true,
      position: true,
      isInitial: true,
    },
    orderBy: { position: "asc" as const },
  },
  workflowTransitions: {
    select: {
      fromStatusId: true,
      toStatusId: true,
    },
  },
} as const;

export async function updateIssueStatus(issueId: string, status: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");
    const userId = (session.user as { id?: string }).id;
    if (!userId) throw new Error("Unauthorized");

    const issue = await prisma.$transaction(async (tx) => {
      const existingIssue = await tx.issue.findUnique({
        where: { id: issueId },
        select: {
          ...issueAuditSelect,
          project: {
            select: workflowSelect,
          },
        },
      });
      if (!existingIssue) throw new Error("Issue not found");

      const workflowStatuses = existingIssue.project.workflowStatuses as WorkflowStatusRecord[];
      const workflowTransitions = existingIssue.project.workflowTransitions as WorkflowTransitionRecord[];
      if (!workflowStatuses.some((workflowStatus) => workflowStatus.key === status)) {
        throw new Error("Invalid workflow status");
      }

      if (
        !canTransitionWorkflowStatus({
          currentStatus: existingIssue.status,
          nextStatus: status,
          workflowStatuses,
          workflowTransitions,
        })
      ) {
        throw new Error("This status transition is not allowed");
      }

      const updatedIssue = await tx.issue.update({
        where: { id: issueId },
        data: { status },
        select: issueAuditSelect,
      });

      const auditLogs = buildIssueUpdateAuditLogs({
        before: existingIssue as IssueAuditSnapshot,
        after: updatedIssue as IssueAuditSnapshot,
        actorId: userId,
      });
      await createAuditLogs(tx, auditLogs);

      return updatedIssue;
    });
    
    revalidatePath('/issues');
    revalidatePath('/iterations');
    revalidatePath(`/issues/${issueId}`);
    
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
          select: { id: true, projectId: true, status: true },
        })
      : null;

    if (data.iterationId && !selectedIteration) {
      throw new Error("Sprint not found");
    }

    if (!isGlobalAdmin && selectedIteration && selectedIteration.projectId !== activeProjectId) {
      throw new Error("Unauthorized");
    }

    if (selectedIteration?.status === "COMPLETED") {
      throw new Error("Cannot add issues to a completed sprint");
    }

    let targetProjectId = selectedIteration?.projectId || activeProjectId;
    if (!targetProjectId && isGlobalAdmin) {
      targetProjectId = (await prisma.project.findFirst({ select: { id: true } }))?.id || null;
    }
    if (!targetProjectId) throw new Error("Project not found or no access");

    const project = await prisma.$transaction(async (tx) => {
      const existingProject = await tx.project.findUnique({
        where: { id: targetProjectId! },
        select: { id: true },
      });

      if (!existingProject) {
        return null;
      }

      const workflowStatusCount = await tx.projectWorkflowStatus.count({
        where: { projectId: targetProjectId! },
      });

      if (workflowStatusCount === 0) {
        await createDefaultWorkflowForProject(tx, targetProjectId!);
      }

      return tx.project.findUnique({
        where: { id: targetProjectId! },
        select: {
          id: true,
          key: true,
          workflowStatuses: {
            select: {
              id: true,
              key: true,
              name: true,
              category: true,
              position: true,
              isInitial: true,
            },
            orderBy: { position: "asc" },
          },
        },
      });
    });
    if (!project) throw new Error("Project not found or no access");

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

    const initialStatus = getInitialWorkflowStatusKey(project.workflowStatuses as WorkflowStatusRecord[]);

    const newIssue = await prisma.$transaction(async (tx) => {
      const createdIssue = await tx.issue.create({
        data: {
          key: issueKey,
          title: data.title,
          description: data.description,
          status: initialStatus,
          priority: data.priority,
          type: data.type,
          projectId: project.id,
          iterationId: data.iterationId ?? null,
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
        },
        include: {
          attachments: {
            select: { id: true, fileName: true },
          },
        },
      });

      const auditLogs = [
        {
          issueId: createdIssue.id,
          projectId: createdIssue.projectId,
          entityType: "ISSUE" as const,
          entityId: createdIssue.id,
          action: "CREATE" as const,
          actorId: userId,
        },
        ...createdIssue.attachments.map((attachment) => ({
          issueId: createdIssue.id,
          projectId: createdIssue.projectId,
          entityType: "ATTACHMENT" as const,
          entityId: attachment.id,
          action: "CREATE" as const,
          actorId: userId,
          metadata: { fileName: attachment.fileName },
        })),
      ];

      await createAuditLogs(tx, auditLogs);

      return createdIssue;
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

export async function addBacklogIssuesToSprint(sprintId: string, issueIds: string[]) {
  try {
    const uniqueIssueIds = [...new Set(issueIds)].filter(Boolean);
    if (uniqueIssueIds.length === 0) {
      throw new Error("Please select at least one issue");
    }

    const sprint = await prisma.iteration.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        projectId: true,
        status: true,
        project: {
          select: workflowSelect,
        },
      },
    });
    if (!sprint) throw new Error("Sprint not found");

    await checkProjectAdmin(sprint.projectId);

    if (sprint.status === "COMPLETED") {
      throw new Error("Cannot add issues to a completed sprint");
    }

    const doneStatuses = sprint.project.workflowStatuses
      .filter((status) => isDoneWorkflowStatus(status.key, sprint.project.workflowStatuses as WorkflowStatusRecord[]))
      .map((status) => status.key);

    const eligibleIssueFilter = {
      id: { in: uniqueIssueIds },
      projectId: sprint.projectId,
      iterationId: null,
      ...(doneStatuses.length > 0 ? { status: { notIn: doneStatuses } } : {}),
    };

    const updated = await prisma.$transaction(async (tx) => {
      const eligibleIssues = await tx.issue.findMany({
        where: eligibleIssueFilter,
        select: { id: true },
      });

      if (eligibleIssues.length !== uniqueIssueIds.length) {
        throw new Error("Only unfinished backlog issues can be added to this sprint");
      }

      return tx.issue.updateMany({
        where: eligibleIssueFilter,
        data: { iterationId: sprint.id },
      });
    });

    revalidatePath(`/iterations/${sprint.id}`);
    revalidatePath("/iterations");
    revalidatePath("/issues");

    return { success: true, count: updated.count };
  } catch (error: unknown) {
    console.error("Failed to add backlog issues to sprint:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add issues to sprint",
    };
  }
}

export async function updateIssue(issueId: string, data: Record<string, unknown>) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userId = (session.user as { id?: string }).id;
    if (!userId) throw new Error("Unauthorized");

    const { existingIssue, updatedIssue } = await prisma.$transaction(async (tx) => {
      const previousIssue = await tx.issue.findUnique({
        where: { id: issueId },
        select: {
          ...issueAuditSelect,
          project: {
            select: workflowSelect,
          },
        },
      });
      if (!previousIssue) throw new Error("Issue not found");

      if (typeof data.status === "string" && data.status !== previousIssue.status) {
        const workflowStatuses = previousIssue.project.workflowStatuses as WorkflowStatusRecord[];
        const workflowTransitions = previousIssue.project.workflowTransitions as WorkflowTransitionRecord[];

        if (!workflowStatuses.some((status) => status.key === data.status)) {
          throw new Error("Invalid workflow status");
        }

        if (
          !canTransitionWorkflowStatus({
            currentStatus: previousIssue.status,
            nextStatus: data.status,
            workflowStatuses,
            workflowTransitions,
          })
        ) {
          throw new Error("This status transition is not allowed");
        }
      }

      const nextIssue = await tx.issue.update({
        where: { id: issueId },
        data,
        select: issueAuditSelect,
      });

      const auditLogs = buildIssueUpdateAuditLogs({
        before: previousIssue as IssueAuditSnapshot,
        after: nextIssue as IssueAuditSnapshot,
        actorId: userId,
      });
      await createAuditLogs(tx, auditLogs);

      return {
        existingIssue: previousIssue,
        updatedIssue: nextIssue,
      };
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

    const userId = (session.user as { id?: string }).id;
    if (!userId) throw new Error("Unauthorized");

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, projectId: true },
    });

    if (!issue) {
      return { success: false, error: "Issue not found" };
    }

    await checkProjectAdmin(issue.projectId);

    const issuePath = `/issues/${issueId}`;

    await prisma.$transaction(async (tx) => {
      await createAuditLogs(tx, [
        {
          issueId: issue.id,
          projectId: issue.projectId,
          entityType: "ISSUE",
          entityId: issue.id,
          action: "DELETE",
          actorId: userId,
        },
      ]);

      await tx.notification.deleteMany({
        where: {
          OR: [{ link: issuePath }, { link: { startsWith: `${issuePath}?` } }],
        },
      });

      await tx.issue.delete({ where: { id: issueId } });
    });

    revalidatePath("/issues");
    revalidatePath("/iterations");

    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to delete issue:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete issue" };
  }
}
