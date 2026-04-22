"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { getActiveProjectForUser } from "@/lib/activeProject";
import {
  canMoveIssueToIteration,
  canUseIterationForActiveProject,
  isProjectInActiveContext,
  resolveIssueCreateProjectId,
} from "@/lib/activeProjectUtils";
import { buildIssueUpdateAuditLogs, createAuditLogs, type IssueAuditSnapshot } from "@/lib/audit";
import { authOptions } from "@/lib/authOptions";
import { notifyAssignedUser, notifyIssueMentions, notifyIssueWatchers } from "@/lib/notifications";
import { checkProjectAdmin, checkProjectMember } from "@/lib/permissions";
import prisma from "@/lib/prisma";
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
  planId: true,
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

type IssueWatcherSnapshot = IssueAuditSnapshot & { key: string };

function getIssueWatcherMessage(before: IssueWatcherSnapshot, after: IssueWatcherSnapshot) {
  if (before.status !== after.status) {
    return `updated the status of ${after.key}`;
  }

  if (before.assigneeId !== after.assigneeId) {
    return `reassigned ${after.key}`;
  }

  if (before.planId !== after.planId) {
    return `updated the plan of ${after.key}`;
  }

  if (before.iterationId !== after.iterationId) {
    return `moved ${after.key} to a different sprint`;
  }

  if (before.priority !== after.priority) {
    return `updated the priority of ${after.key}`;
  }

  if (before.type !== after.type) {
    return `updated the issue type of ${after.key}`;
  }

  if (before.dueDate?.toString() !== after.dueDate?.toString()) {
    return `updated the due date of ${after.key}`;
  }

  if (before.description !== after.description) {
    return `updated the description of ${after.key}`;
  }

  if (before.title !== after.title) {
    return `updated the summary of ${after.key}`;
  }

  return `updated ${after.key}`;
}

function hasWatcherRelevantChange(before: IssueAuditSnapshot, after: IssueAuditSnapshot) {
  return (
    before.title !== after.title ||
    before.description !== after.description ||
    before.status !== after.status ||
    before.priority !== after.priority ||
    before.type !== after.type ||
    before.assigneeId !== after.assigneeId ||
    before.planId !== after.planId ||
    before.iterationId !== after.iterationId ||
    before.dueDate?.toString() !== after.dueDate?.toString()
  );
}

export async function updateIssueStatus(issueId: string, status: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const sessionUser = session.user as { id?: string; role?: string };
    const userId = sessionUser.id;
    if (!userId) throw new Error("Unauthorized");

    const userRole = sessionUser.role ?? "USER";
    const activeProject = await getActiveProjectForUser(userId, userRole);
    const activeProjectId = activeProject?.id || null;

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
      if (!isProjectInActiveContext({ activeProjectId, projectId: existingIssue.projectId })) {
        throw new Error("Unauthorized");
      }

      await checkProjectMember(existingIssue.projectId);

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

    revalidatePath("/issues");
    revalidatePath("/iterations");
    revalidatePath(`/issues/${issueId}`);

    await notifyIssueWatchers({
      actorId: userId,
      issueId,
      message: `updated the status of ${issue.key}`,
    });

    return { success: true, issue };
  } catch (error) {
    console.error("Failed to update issue status:", error);
    return { success: false, error: "Failed to update issue status" };
  }
}

export async function createIssue(data: {
  title: string;
  description?: string;
  priority: string;
  type: string;
  planId?: string | null;
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
    const activeProject = await getActiveProjectForUser(userId, userRole);
    const activeProjectId = activeProject?.id || null;

    const selectedPlan = data.planId
      ? await prisma.plan.findUnique({
          where: { id: data.planId },
          select: { id: true, projectId: true },
        })
      : null;

    const selectedIteration = data.iterationId
      ? await prisma.iteration.findUnique({
          where: { id: data.iterationId },
          select: { id: true, projectId: true, status: true },
        })
      : null;

    if (data.planId && !selectedPlan) {
      throw new Error("Plan not found");
    }

    if (data.iterationId && !selectedIteration) {
      throw new Error("Sprint not found");
    }

    if (selectedPlan?.projectId && activeProjectId !== selectedPlan.projectId) {
      throw new Error("Unauthorized");
    }

    if (
      !canUseIterationForActiveProject({
        activeProjectId,
        selectedIterationProjectId: selectedIteration?.projectId,
      })
    ) {
      throw new Error("Unauthorized");
    }

    if (
      selectedPlan?.projectId &&
      selectedIteration?.projectId &&
      selectedPlan.projectId !== selectedIteration.projectId
    ) {
      throw new Error("Plan and sprint must belong to the same project");
    }

    if (selectedIteration?.status === "COMPLETED") {
      throw new Error("Cannot add issues to a completed sprint");
    }

    let targetProjectId = selectedIteration?.projectId || selectedPlan?.projectId || activeProjectId || null;

    if (!targetProjectId && isGlobalAdmin) {
      targetProjectId = resolveIssueCreateProjectId({
        activeProjectId,
        selectedIterationProjectId: selectedIteration?.projectId,
        fallbackProjectId: (await prisma.project.findFirst({ select: { id: true } }))?.id || null,
      });
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
    const watcherIds = Array.from(new Set([userId, data.assigneeId].filter((value): value is string => Boolean(value))));

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
          planId: data.planId ?? null,
          iterationId: data.iterationId ?? null,
          assigneeId: data.assigneeId,
          reporterId: userId,
          dueDate: dueDateValue,
          watchers:
            watcherIds.length > 0
              ? {
                  connect: watcherIds.map((watcherId) => ({ id: watcherId })),
                }
              : undefined,
          attachments:
            data.attachments && data.attachments.length > 0
              ? {
                  create: data.attachments.map((attachment) => ({
                    fileName: attachment.fileName,
                    fileUrl: attachment.fileUrl,
                    uploaderId: userId,
                  })),
                }
              : undefined,
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

    await notifyAssignedUser({
      actorId: userId,
      assigneeId: data.assigneeId,
      issueId: newIssue.id,
      issueKey: newIssue.key,
    });

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

    const sessionUser = session.user as { id?: string; role?: string };
    const userId = sessionUser.id;
    if (!userId) throw new Error("Unauthorized");

    const userRole = sessionUser.role ?? "USER";
    const activeProject = await getActiveProjectForUser(userId, userRole);
    const activeProjectId = activeProject?.id || null;

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
      if (!isProjectInActiveContext({ activeProjectId, projectId: previousIssue.projectId })) {
        throw new Error("Unauthorized");
      }

      await checkProjectMember(previousIssue.projectId);

      if (typeof data.planId === "string" && data.planId) {
        const targetPlan = await tx.plan.findUnique({
          where: { id: data.planId },
          select: { id: true, projectId: true },
        });

        if (!targetPlan) {
          throw new Error("Plan not found");
        }

        if (targetPlan.projectId !== previousIssue.projectId) {
          throw new Error("Unauthorized");
        }
      }

      if (typeof data.iterationId === "string" && data.iterationId) {
        const targetIteration = await tx.iteration.findUnique({
          where: { id: data.iterationId },
          select: { id: true, projectId: true, status: true },
        });

        if (!targetIteration) {
          throw new Error("Sprint not found");
        }

        if (
          !canMoveIssueToIteration({
            issueProjectId: previousIssue.projectId,
            targetIterationProjectId: targetIteration.projectId,
          })
        ) {
          throw new Error("Unauthorized");
        }

        if (targetIteration.status === "COMPLETED") {
          throw new Error("Cannot move an issue to a completed sprint");
        }
      }

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

    let mentionedUserIds = new Set<string>();
    if (nextDescription !== null && nextDescription !== (existingIssue.description || "")) {
      mentionedUserIds = await notifyIssueMentions({
        actorId: userId,
        issueId: existingIssue.id,
        issueKey: existingIssue.key,
        projectId: existingIssue.projectId,
        content: nextDescription,
        previousContent: existingIssue.description,
      });
    }

    if (updatedIssue.assigneeId !== existingIssue.assigneeId) {
      await notifyAssignedUser({
        actorId: userId,
        assigneeId: updatedIssue.assigneeId,
        issueId: existingIssue.id,
        issueKey: existingIssue.key,
      });
    }

    if (hasWatcherRelevantChange(existingIssue as IssueAuditSnapshot, updatedIssue as IssueAuditSnapshot)) {
      await notifyIssueWatchers({
        actorId: userId,
        issueId: existingIssue.id,
        message: getIssueWatcherMessage(existingIssue as IssueWatcherSnapshot, updatedIssue as IssueWatcherSnapshot),
        excludeUserIds: [...mentionedUserIds],
      });
    }

    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath("/iterations");

    return { success: true, issue: updatedIssue };
  } catch (error: unknown) {
    console.error("Failed to update issue:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update issue" };
  }
}

type BulkIssueAction =
  | { type: "assignPlan"; targetId: string }
  | { type: "removePlan" }
  | { type: "assignIteration"; targetId: string }
  | { type: "assignAssignee"; targetId: string | null };

export async function bulkUpdateIssues(issueIds: string[], action: BulkIssueAction) {
  try {
    const uniqueIssueIds = [...new Set(issueIds)].filter(Boolean);
    if (uniqueIssueIds.length === 0) {
      throw new Error("Please select at least one issue");
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const sessionUser = session.user as { id?: string; role?: string };
    const userId = sessionUser.id;
    if (!userId) throw new Error("Unauthorized");

    const userRole = sessionUser.role ?? "USER";
    const activeProject = await getActiveProjectForUser(userId, userRole);
    const activeProjectId = activeProject?.id || null;
    if (!activeProjectId) throw new Error("Unauthorized");

    const existingIssues = await prisma.issue.findMany({
      where: {
        id: { in: uniqueIssueIds },
        projectId: activeProjectId,
      },
      select: issueAuditSelect,
    });

    if (existingIssues.length !== uniqueIssueIds.length) {
      throw new Error("Some selected issues are unavailable in the active project");
    }

    await checkProjectMember(activeProjectId);

    const affectedPlanIds = new Set<string>();
    for (const issue of existingIssues) {
      if (issue.planId) affectedPlanIds.add(issue.planId);
    }

    if (action.type === "assignPlan") {
      const plan = await prisma.plan.findUnique({
        where: { id: action.targetId },
        select: { id: true, projectId: true },
      });

      if (!plan || plan.projectId !== activeProjectId) {
        throw new Error("Plan not found in the active project");
      }
      affectedPlanIds.add(plan.id);
    }

    if (action.type === "assignIteration") {
      const iteration = await prisma.iteration.findUnique({
        where: { id: action.targetId },
        select: { id: true, projectId: true, status: true },
      });

      if (!iteration || iteration.projectId !== activeProjectId) {
        throw new Error("Sprint not found in the active project");
      }

      if (iteration.status === "COMPLETED") {
        throw new Error("Cannot move issues to a completed sprint");
      }
    }

    if (action.type === "assignAssignee" && action.targetId) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: action.targetId,
          OR: [
            { role: "ADMIN" },
            {
              projectMemberships: {
                some: {
                  projectId: activeProjectId,
                },
              },
            },
          ],
        },
        select: { id: true },
      });

      if (!assignee) {
        throw new Error("Assignee is not available in the active project");
      }
    }

    const updateData =
      action.type === "assignPlan"
        ? { planId: action.targetId }
        : action.type === "removePlan"
          ? { planId: null }
          : action.type === "assignIteration"
            ? { iterationId: action.targetId }
            : { assigneeId: action.targetId };

    const { updatedIssues } = await prisma.$transaction(async (tx) => {
      await tx.issue.updateMany({
        where: {
          id: { in: uniqueIssueIds },
          projectId: activeProjectId,
        },
        data: updateData,
      });

      const nextIssues = await tx.issue.findMany({
        where: {
          id: { in: uniqueIssueIds },
          projectId: activeProjectId,
        },
        select: issueAuditSelect,
      });

      const beforeById = new Map(existingIssues.map((issue) => [issue.id, issue]));
      const auditLogs = nextIssues.flatMap((issue) =>
        buildIssueUpdateAuditLogs({
          before: beforeById.get(issue.id)! as IssueAuditSnapshot,
          after: issue as IssueAuditSnapshot,
          actorId: userId,
        })
      );

      await createAuditLogs(tx, auditLogs);

      return { updatedIssues: nextIssues };
    });

    if (action.type === "assignAssignee" && action.targetId) {
      const previousIssueById = new Map(existingIssues.map((issue) => [issue.id, issue]));
      await Promise.all(
        updatedIssues
          .filter((issue) => issue.assigneeId === action.targetId && previousIssueById.get(issue.id)?.assigneeId !== action.targetId)
          .map((issue) =>
            notifyAssignedUser({
              actorId: userId,
              assigneeId: action.targetId,
              issueId: issue.id,
              issueKey: issue.key,
            })
          )
      );
    }

    revalidatePath("/issues");
    revalidatePath("/iterations");
    revalidatePath("/plans");
    for (const planId of affectedPlanIds) {
      revalidatePath(`/plans/${planId}`);
    }

    return { success: true, count: updatedIssues.length };
  } catch (error: unknown) {
    console.error("Failed to bulk update issues:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update selected issues",
    };
  }
}

export async function deleteIssue(issueId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const sessionUser = session.user as { id?: string; role?: string };
    const userId = sessionUser.id;
    if (!userId) throw new Error("Unauthorized");

    const userRole = sessionUser.role ?? "USER";
    const activeProject = await getActiveProjectForUser(userId, userRole);
    const activeProjectId = activeProject?.id || null;

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, projectId: true },
    });

    if (!issue) {
      return { success: false, error: "Issue not found" };
    }

    if (!isProjectInActiveContext({ activeProjectId, projectId: issue.projectId })) {
      return { success: false, error: "Unauthorized" };
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

export async function toggleIssueWatcher(issueId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userId = (session.user as { id?: string }).id;
    if (!userId) throw new Error("Unauthorized");

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        projectId: true,
        watchers: {
          where: { id: userId },
          select: { id: true },
        },
      },
    });

    if (!issue) {
      throw new Error("Issue not found");
    }

    await checkProjectMember(issue.projectId);

    const isWatching = issue.watchers.length > 0;
    const updatedIssue = await prisma.issue.update({
      where: { id: issueId },
      data: {
        watchers: isWatching ? { disconnect: { id: userId } } : { connect: { id: userId } },
      },
      select: {
        watchers: {
          select: {
            id: true,
            name: true,
            avatar: true,
            email: true,
          },
          orderBy: {
            name: "asc",
          },
        },
      },
    });

    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/");

    return { success: true, watching: !isWatching, watchers: updatedIssue.watchers };
  } catch (error: unknown) {
    console.error("Failed to toggle issue watcher:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update watcher",
    };
  }
}
