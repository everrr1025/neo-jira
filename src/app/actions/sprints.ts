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
  } catch (error: any) {
    return { success: false, error: error.message };
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

    const updated = await prisma.iteration.update({
      where: { id: sprintId },
      data: { status: "ACTIVE" },
    });

    revalidatePath("/iterations");
    revalidatePath(`/iterations/${sprintId}`);
    return { success: true, sprint: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function completeSprint(sprintId: string) {
  try {
    const sprint = await prisma.iteration.findUnique({
      where: { id: sprintId },
    });
    if (!sprint) return { success: false, error: "Sprint not found" };

    await checkProjectAdmin(sprint.projectId);

    if (sprint.status !== "ACTIVE") {
      return { success: false, error: "Only ACTIVE sprints can be completed" };
    }

    const updated = await prisma.iteration.update({
      where: { id: sprintId },
      data: { status: "COMPLETED" },
    });

    revalidatePath("/iterations");
    revalidatePath(`/iterations/${sprintId}`);
    return { success: true, sprint: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
