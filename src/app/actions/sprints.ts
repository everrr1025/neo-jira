"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { checkProjectAdmin } from "@/lib/permissions";

export async function createSprint(data: {
  name: string;
  startDate: string;
  endDate: string;
  projectId: string;
}) {
  try {
    await checkProjectAdmin(data.projectId);

    const sprint = await prisma.iteration.create({
      data: {
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        projectId: data.projectId,
        status: "PLANNED",
      },
    });

    revalidatePath("/iterations");
    return { success: true, sprint };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create sprint" };
  }
}

export async function startSprint(sprintId: string) {
  try {
    const sprint = await prisma.iteration.findUnique({
      where: { id: sprintId },
    });
    if (!sprint) return { success: false, error: "Sprint not found" };

    await checkProjectAdmin(sprint.projectId);

    if (sprint.status !== "PLANNED") {
      return { success: false, error: "Only PLANNED sprints can be started" };
    }

    // Check if there's already an active sprint in the same project
    const activeSprint = await prisma.iteration.findFirst({
      where: { projectId: sprint.projectId, status: "ACTIVE" },
    });
    if (activeSprint) {
      return {
        success: false,
        error: `Sprint "${activeSprint.name}" is already active. Complete it first.`,
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const activeSprint = await tx.iteration.findFirst({
        where: { projectId: sprint.projectId, status: "ACTIVE" },
      });
      if (activeSprint) {
        throw new Error(`Sprint "${activeSprint.name}" is already active. Complete it first.`);
      }

      return tx.iteration.update({
        where: { id: sprintId },
        data: { status: "ACTIVE" },
      });
    });

    revalidatePath("/iterations");
    revalidatePath(`/iterations/${sprintId}`);
    return { success: true, sprint: updated };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to start sprint" };
  }
}

type CompleteSprintOptions = {
  moveUnfinishedTo: "BACKLOG" | "SPRINT";
  targetSprintId?: string;
};

export async function completeSprint(sprintId: string, options: CompleteSprintOptions = { moveUnfinishedTo: "BACKLOG" }) {
  try {
    const sprint = await prisma.iteration.findUnique({
      where: { id: sprintId },
    });
    if (!sprint) return { success: false, error: "Sprint not found" };

    await checkProjectAdmin(sprint.projectId);

    if (sprint.status !== "ACTIVE") {
      return { success: false, error: "Only ACTIVE sprints can be completed" };
    }

    const updated = await prisma.$transaction(async (tx) => {
      let nextIterationId: string | null = null;

      if (options.moveUnfinishedTo === "SPRINT") {
        if (!options.targetSprintId || options.targetSprintId === sprintId) {
          throw new Error("Please select a target sprint");
        }

        const targetSprint = await tx.iteration.findUnique({
          where: { id: options.targetSprintId },
          select: { id: true, projectId: true, status: true },
        });

        if (!targetSprint || targetSprint.projectId !== sprint.projectId) {
          throw new Error("Target sprint not found in this project");
        }

        if (targetSprint.status !== "PLANNED") {
          throw new Error("Unfinished issues can only move to a planned sprint");
        }

        nextIterationId = targetSprint.id;
      }

      const completedSprint = await tx.iteration.update({
        where: { id: sprintId },
        data: { status: "COMPLETED" },
      });

      await tx.issue.updateMany({
        where: {
          iterationId: sprintId,
          status: { not: "DONE" },
        },
        data: { iterationId: nextIterationId },
      });

      return completedSprint;
    });

    revalidatePath("/issues");
    revalidatePath("/iterations");
    revalidatePath(`/iterations/${sprintId}`);
    if (options.targetSprintId) revalidatePath(`/iterations/${options.targetSprintId}`);
    return { success: true, sprint: updated };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to complete sprint" };
  }
}

export async function reopenSprint(sprintId: string) {
  try {
    const sprint = await prisma.iteration.findUnique({
      where: { id: sprintId },
    });
    if (!sprint) return { success: false, error: "Sprint not found" };

    await checkProjectAdmin(sprint.projectId);

    if (sprint.status !== "ACTIVE") {
      return { success: false, error: "Only ACTIVE sprints can be moved back to planned" };
    }

    const updated = await prisma.iteration.update({
      where: { id: sprintId },
      data: { status: "PLANNED" },
    });

    revalidatePath("/iterations");
    revalidatePath(`/iterations/${sprintId}`);
    return { success: true, sprint: updated };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to move sprint back to planned" };
  }
}

export async function deleteSprint(sprintId: string) {
  try {
    const sprint = await prisma.iteration.findUnique({
      where: { id: sprintId },
      select: { id: true, projectId: true, status: true },
    });
    if (!sprint) return { success: false, error: "Sprint not found" };

    await checkProjectAdmin(sprint.projectId);

    if (sprint.status !== "PLANNED") {
      return { success: false, error: "Only planned sprints can be deleted" };
    }

    await prisma.$transaction([
      prisma.issue.updateMany({
        where: { iterationId: sprintId },
        data: { iterationId: null },
      }),
      prisma.iteration.delete({
        where: { id: sprintId },
      }),
    ]);

    revalidatePath("/issues");
    revalidatePath("/iterations");

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete sprint" };
  }
}
