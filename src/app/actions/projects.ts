"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { checkProjectAdmin } from "@/lib/permissions";
import {
  buildUniqueWorkflowStatusKey,
  type WorkflowStatusInput,
  type WorkflowTransitionInput,
  validateWorkflowDraft,
} from "@/lib/workflows";

type ActionResult<T> =
  | { success: true; project: T }
  | { success: false; error: string };

export async function updateProject(projectId: string, data: {
  name?: string;
  key?: string;
  description?: string;
  ownerId?: string;
  workflow?: {
    statuses: WorkflowStatusInput[];
    transitions: WorkflowTransitionInput[];
  };
}): Promise<ActionResult<{ id: string; name: string; key: string; description: string | null; ownerId: string; createdAt: Date; updatedAt: Date }>> {
  try {
    await checkProjectAdmin(projectId);

    const updated = await prisma.$transaction(async (tx) => {
      const existingProject = await tx.project.findUnique({
        where: { id: projectId },
        select: {
          ownerId: true,
          workflowStatuses: {
            select: { id: true, key: true, position: true },
            orderBy: { position: "asc" },
          },
        },
      });

      if (!existingProject) {
        throw new Error("Project not found");
      }

      if (data.ownerId && data.ownerId !== existingProject.ownerId) {
        throw new Error("Project owner cannot be changed");
      }

      if (data.key) {
        const existing = await tx.project.findFirst({
          where: {
            key: data.key,
            id: { not: projectId },
          },
        });
        if (existing) throw new Error("Project key already exists");
      }

      if (data.workflow) {
        validateWorkflowDraft(data.workflow.statuses, data.workflow.transitions);

        const existingStatusMap = new Map(existingProject.workflowStatuses.map((status) => [status.id, status]));
        const incomingExistingIds = new Set(
          data.workflow.statuses.map((status) => status.id).filter((value): value is string => Boolean(value))
        );

        const removedStatuses = existingProject.workflowStatuses.filter((status) => !incomingExistingIds.has(status.id));
        if (removedStatuses.length > 0) {
          const issuesUsingRemovedStatuses = await tx.issue.count({
            where: {
              projectId,
              status: { in: removedStatuses.map((status) => status.key) },
            },
          });

          if (issuesUsingRemovedStatuses > 0) {
            throw new Error(
              `Cannot remove statuses that are still used by issues: ${removedStatuses
                .map((status) => status.key)
                .join(", ")}`
            );
          }
        }

        await tx.projectWorkflowTransition.deleteMany({ where: { projectId } });

        if (removedStatuses.length > 0) {
          await tx.projectWorkflowStatus.deleteMany({
            where: { id: { in: removedStatuses.map((status) => status.id) } },
          });
        }

        const sortableStatuses = [...data.workflow.statuses].sort((a, b) => a.position - b.position);
        for (const status of sortableStatuses) {
          if (status.id && existingStatusMap.has(status.id)) {
            await tx.projectWorkflowStatus.update({
              where: { id: status.id },
              data: { position: status.position + 1000 },
            });
          }
        }

        const existingKeys = new Set(existingProject.workflowStatuses.map((status) => status.key));
        const persistedStatusIds = new Map<string, string>();

        for (const [index, status] of sortableStatuses.entries()) {
          const trimmedName = status.name.trim();

          if (status.id && existingStatusMap.has(status.id)) {
            const updatedStatus = await tx.projectWorkflowStatus.update({
              where: { id: status.id },
              data: {
                name: trimmedName,
                category: status.category,
                isInitial: status.isInitial,
                position: index,
              },
            });
            persistedStatusIds.set(status.clientId, updatedStatus.id);
            continue;
          }

          const createdStatus = await tx.projectWorkflowStatus.create({
            data: {
              projectId,
              key: buildUniqueWorkflowStatusKey(trimmedName, existingKeys),
              name: trimmedName,
              category: status.category,
              isInitial: status.isInitial,
              position: index,
            },
          });
          persistedStatusIds.set(status.clientId, createdStatus.id);
        }

        if (data.workflow.transitions.length > 0) {
          await tx.projectWorkflowTransition.createMany({
            data: data.workflow.transitions.map((transition) => {
              const fromStatusId = persistedStatusIds.get(transition.fromClientId);
              const toStatusId = persistedStatusIds.get(transition.toClientId);
              if (!fromStatusId || !toStatusId) {
                throw new Error("Workflow transition references an unknown status");
              }

              return {
                projectId,
                fromStatusId,
                toStatusId,
              };
            }),
          });
        }
      }

      return tx.project.update({
        where: { id: projectId },
        data: {
          name: data.name,
          key: data.key,
          description: data.description,
        },
      });
    });

    revalidatePath(`/projects/${projectId}/settings`);
    revalidatePath("/projects");
    revalidatePath("/");
    revalidatePath("/issues");
    revalidatePath("/iterations");
    
    return { success: true, project: updated };
  } catch (error: unknown) {
    console.error("Failed to update project:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update project" };
  }
}

export async function getProjectForSettings(projectId: string) {
  try {
    // Basic check - will throw if not logged in
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: true,
        members: {
          include: { user: true }
        },
        workflowStatuses: {
          orderBy: { position: "asc" },
        },
        workflowTransitions: true,
      }
    });
    
    if (!project) throw new Error("Project not found");
    
    return { success: true, project };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch project" };
  }
}
