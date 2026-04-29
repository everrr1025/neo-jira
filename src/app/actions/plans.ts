"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { getActiveProjectForUser } from "@/lib/activeProject";
import { authOptions } from "@/lib/authOptions";
import { isProjectInActiveContext } from "@/lib/activeProjectUtils";
import { checkProjectAdmin, checkProjectFieldConfig, checkProjectMember, checkProjectPlanning } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";
import {
  getEndBeforeStartMessage,
  getInvalidDateRangeMessage,
  normalizeNameOrThrow,
  PLAN_NAME_MAX_LENGTH,
} from "@/lib/validation";

const PLAN_FIELD_TYPES = ["BOOLEAN", "NUMBER", "TEXT", "LONG_TEXT", "SELECT"] as const;
type PlanFieldType = (typeof PLAN_FIELD_TYPES)[number];

function normalizeFieldKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 40);
}

function parseSelectOptions(optionsText?: string) {
  const options = (optionsText || "")
    .split(/[,\s，]+/)
    .map((option) => option.trim())
    .filter(Boolean);

  return [...new Set(options)];
}

function assertPlanFieldType(type: string): asserts type is PlanFieldType {
  if (!PLAN_FIELD_TYPES.includes(type as PlanFieldType)) {
    throw new Error("Unsupported field type");
  }
}

async function getAuthorizedPlan(planId: string, requiredAccess: "admin" | "fieldConfig" | "member") {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const sessionUser = session.user as { id?: string; role?: string };
  const userId = sessionUser.id;
  if (!userId) throw new Error("Unauthorized");

  const userRole = sessionUser.role ?? "USER";
  const activeProject = await getActiveProjectForUser(userId, userRole);
  const activeProjectId = activeProject?.id || null;

  const plan = await prisma.plan.findFirst({
    where: {
      id: planId,
      projectId: activeProjectId || undefined,
    },
    select: { id: true, projectId: true },
  });

  if (!plan) throw new Error("Plan not found");

  if (requiredAccess === "admin") {
    await checkProjectAdmin(plan.projectId);
  } else if (requiredAccess === "fieldConfig") {
    await checkProjectFieldConfig(plan.projectId);
  } else {
    await checkProjectMember(plan.projectId);
  }

  return plan;
}

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

    await checkProjectPlanning(data.projectId);

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
        ownerId: project.ownerId || userId,
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

export async function createPlanFieldDefinition(data: {
  planId: string;
  name: string;
  key?: string;
  type: string;
  required?: boolean;
  optionsText?: string;
}) {
  try {
    assertPlanFieldType(data.type);
    const plan = await getAuthorizedPlan(data.planId, "fieldConfig");
    const name = data.name.trim();
    if (!name) throw new Error("Field name is required");

    const key = normalizeFieldKey(data.key || "");
    if (!key) throw new Error("Field key is required");

    const options = parseSelectOptions(data.optionsText);
    if (data.type === "SELECT" && options.length === 0) {
      throw new Error("Select fields require at least one option");
    }

    const lastField = await prisma.planFieldDefinition.findFirst({
      where: { planId: plan.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const field = await prisma.planFieldDefinition.create({
      data: {
        planId: plan.id,
        key,
        name,
        type: data.type,
        required: Boolean(data.required),
        position: (lastField?.position ?? -1) + 1,
        optionsJson: data.type === "SELECT" ? JSON.stringify(options) : null,
      },
    });

    revalidatePath(`/plans/${plan.id}`);
    return { success: true, field };
  } catch (error: unknown) {
    console.error("Failed to create plan field:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create plan field" };
  }
}

export async function updatePlanFieldDefinition(data: {
  id: string;
  planId: string;
  name: string;
  required?: boolean;
  optionsText?: string;
}) {
  try {
    const plan = await getAuthorizedPlan(data.planId, "fieldConfig");
    const existing = await prisma.planFieldDefinition.findFirst({
      where: { id: data.id, planId: plan.id },
      select: { id: true, type: true },
    });

    if (!existing) throw new Error("Field not found");

    const name = data.name.trim();
    if (!name) throw new Error("Field name is required");

    const options = parseSelectOptions(data.optionsText);
    if (existing.type === "SELECT" && options.length === 0) {
      throw new Error("Select fields require at least one option");
    }

    const field = await prisma.planFieldDefinition.update({
      where: { id: existing.id },
      data: {
        name,
        required: Boolean(data.required),
        optionsJson: existing.type === "SELECT" ? JSON.stringify(options) : null,
      },
    });

    revalidatePath(`/plans/${plan.id}`);
    return { success: true, field };
  } catch (error: unknown) {
    console.error("Failed to update plan field:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update plan field" };
  }
}

export async function deletePlanFieldDefinition(data: { id: string; planId: string }) {
  try {
    const plan = await getAuthorizedPlan(data.planId, "fieldConfig");
    const existing = await prisma.planFieldDefinition.findFirst({
      where: { id: data.id, planId: plan.id },
      select: { id: true },
    });

    if (!existing) throw new Error("Field not found");

    await prisma.planFieldDefinition.delete({ where: { id: existing.id } });

    revalidatePath(`/plans/${plan.id}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to delete plan field:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete plan field" };
  }
}

export async function updatePlanIssueFieldValue(data: {
  planId: string;
  issueId: string;
  fieldDefinitionId: string;
  value: string | number | boolean | null;
}) {
  try {
    const plan = await getAuthorizedPlan(data.planId, "member");

    const [issue, field] = await Promise.all([
      prisma.issue.findFirst({
        where: { id: data.issueId, planId: plan.id, projectId: plan.projectId },
        select: { id: true },
      }),
      prisma.planFieldDefinition.findFirst({
        where: { id: data.fieldDefinitionId, planId: plan.id },
        select: { id: true, type: true, optionsJson: true },
      }),
    ]);

    if (!issue) throw new Error("Issue not found in this plan");
    if (!field) throw new Error("Field not found");

    const valueData: {
      valueBoolean: boolean | null;
      valueNumber: number | null;
      valueText: string | null;
      valueOption: string | null;
    } = {
      valueBoolean: null,
      valueNumber: null,
      valueText: null,
      valueOption: null,
    };

    if (field.type === "BOOLEAN") {
      valueData.valueBoolean = Boolean(data.value);
    } else if (field.type === "NUMBER") {
      const numericValue = data.value === null || data.value === "" ? null : Number(data.value);
      if (numericValue !== null && Number.isNaN(numericValue)) throw new Error("Invalid number");
      valueData.valueNumber = numericValue;
    } else if (field.type === "TEXT" || field.type === "LONG_TEXT") {
      valueData.valueText = typeof data.value === "string" ? data.value : data.value === null ? null : String(data.value);
    } else if (field.type === "SELECT") {
      const option = typeof data.value === "string" && data.value ? data.value : null;
      const options = field.optionsJson ? (JSON.parse(field.optionsJson) as string[]) : [];
      if (option && !options.includes(option)) throw new Error("Invalid option");
      valueData.valueOption = option;
    }

    const savedValue = await prisma.planIssueFieldValue.upsert({
      where: {
        planId_issueId_fieldDefinitionId: {
          planId: plan.id,
          issueId: issue.id,
          fieldDefinitionId: field.id,
        },
      },
      create: {
        planId: plan.id,
        issueId: issue.id,
        fieldDefinitionId: field.id,
        ...valueData,
      },
      update: valueData,
    });

    revalidatePath(`/plans/${plan.id}`);
    return { success: true, value: savedValue };
  } catch (error: unknown) {
    console.error("Failed to update plan issue field value:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update field value" };
  }
}
