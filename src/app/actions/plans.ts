"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { getActiveProjectForUser } from "@/lib/activeProject";
import { authOptions } from "@/lib/authOptions";
import { isProjectInActiveContext } from "@/lib/activeProjectUtils";
import { checkProjectAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";
import {
  getEndBeforeStartMessage,
  getInvalidDateRangeMessage,
  normalizeNameOrThrow,
  PLAN_NAME_MAX_LENGTH,
} from "@/lib/validation";

export async function createPlan(data: {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  projectId: string;
  targetCount?: number | null;
}) {
  try {
    const locale = await getCurrentLocale();
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const sessionUser = session.user as { id?: string; role?: string };
    const userId = sessionUser.id;
    if (!userId) throw new Error("Unauthorized");

    const userRole = sessionUser.role ?? "USER";
    const activeProject = await getActiveProjectForUser(userId, userRole);
    const activeProjectId = activeProject?.id || null;

    if (!isProjectInActiveContext({ activeProjectId, projectId: data.projectId })) {
      throw new Error("Unauthorized");
    }

    await checkProjectAdmin(data.projectId);

    const name = normalizeNameOrThrow(data.name, "planName", PLAN_NAME_MAX_LENGTH, locale);

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error(getInvalidDateRangeMessage(locale));
    }

    if (endDate < startDate) {
      throw new Error(getEndBeforeStartMessage("plan", locale));
    }

    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
      },
      select: { ownerId: true },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        description: data.description?.trim() || null,
        startDate,
        endDate,
        projectId: data.projectId,
        ownerId: project.ownerId,
        targetCount: typeof data.targetCount === "number" && data.targetCount > 0 ? data.targetCount : null,
        status: "ACTIVE",
      },
    });

    revalidatePath("/plans");
    revalidatePath("/issues");

    return { success: true, plan };
  } catch (error: unknown) {
    console.error("Failed to create plan:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create plan" };
  }
}

export async function updatePlan(data: {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
}) {
  try {
    const locale = await getCurrentLocale();
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const sessionUser = session.user as { id?: string; role?: string };
    const userId = sessionUser.id;
    if (!userId) throw new Error("Unauthorized");

    const userRole = sessionUser.role ?? "USER";
    const activeProject = await getActiveProjectForUser(userId, userRole);
    const activeProjectId = activeProject?.id || null;

    if (!isProjectInActiveContext({ activeProjectId, projectId: data.projectId })) {
      throw new Error("Unauthorized");
    }

    await checkProjectAdmin(data.projectId);

    const name = normalizeNameOrThrow(data.name, "planName", PLAN_NAME_MAX_LENGTH, locale);

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error(getInvalidDateRangeMessage(locale));
    }

    if (endDate < startDate) {
      throw new Error(getEndBeforeStartMessage("plan", locale));
    }

    const existingPlan = await prisma.plan.findFirst({
      where: {
        id: data.id,
        projectId: data.projectId,
      },
      select: { id: true },
    });

    if (!existingPlan) {
      throw new Error("Plan not found");
    }

    const plan = await prisma.plan.update({
      where: { id: data.id },
      data: {
        name,
        description: data.description?.trim() || null,
        startDate,
        endDate,
      },
    });

    revalidatePath("/plans");
    revalidatePath(`/plans/${data.id}`);
    revalidatePath("/issues");

    return { success: true, plan };
  } catch (error: unknown) {
    console.error("Failed to update plan:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update plan" };
  }
}

export async function deletePlan(data: { id: string; projectId: string }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const sessionUser = session.user as { id?: string; role?: string };
    const userId = sessionUser.id;
    if (!userId) throw new Error("Unauthorized");

    const userRole = sessionUser.role ?? "USER";
    const activeProject = await getActiveProjectForUser(userId, userRole);
    const activeProjectId = activeProject?.id || null;

    if (!isProjectInActiveContext({ activeProjectId, projectId: data.projectId })) {
      throw new Error("Unauthorized");
    }

    await checkProjectAdmin(data.projectId);

    const existingPlan = await prisma.plan.findFirst({
      where: {
        id: data.id,
        projectId: data.projectId,
      },
      select: { id: true },
    });

    if (!existingPlan) {
      throw new Error("Plan not found");
    }

    await prisma.plan.delete({
      where: { id: data.id },
    });

    revalidatePath("/plans");
    revalidatePath(`/plans/${data.id}`);
    revalidatePath("/issues");

    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to delete plan:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete plan" };
  }
}
