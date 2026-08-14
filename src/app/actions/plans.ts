"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { getActiveProjectForUser } from "@/lib/activeProject";
import { authOptions } from "@/lib/authOptions";
import { isProjectInActiveContext } from "@/lib/activeProjectUtils";
import { checkProjectAdmin, checkProjectFieldConfig, checkProjectMember, checkProjectPlanning } from "@/lib/permissions";
import { canTransitionPlanStatus, getTerminalPlanIssueMessage, isTerminalPlanStatus, partitionPlanIssues, type PlanStatus } from "@/lib/planLifecycle";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";
import {
  getEndBeforeStartMessage,
  getInvalidDateRangeMessage,
  normalizeNameOrThrow,
  PLAN_NAME_MAX_LENGTH,
} from "@/lib/validation";
import { isDoneWorkflowStatus, type WorkflowStatusRecord } from "@/lib/workflows";

const PLAN_FIELD_TYPES = ["BOOLEAN", "NUMBER", "TEXT", "LONG_TEXT", "SELECT", "DATE"] as const;
type PlanFieldType = (typeof PLAN_FIELD_TYPES)[number];

function normalizeFieldKey(input: string) {
  return input.trim().slice(0, 40);
}

function isValidFieldKey(input: string) {
  return /^[A-Za-z_][A-Za-z0-9_]{0,39}$/.test(input);
}

function parseSelectOptions(optionsText?: string) {
  const options = (optionsText || "")
    .split(/[,\s，]+/)
    .map((option) => option.trim())
    .filter(Boolean);

  return [...new Set(options)];
}

function parseStoredSelectOptions(optionsJson?: string | null) {
  if (!optionsJson) return [];

  try {
    const parsed = JSON.parse(optionsJson);
    return Array.isArray(parsed) ? parsed.filter((option): option is string => typeof option === "string") : [];
  } catch {
    return [];
  }
}

function assertPlanFieldType(type: string): asserts type is PlanFieldType {
  if (!PLAN_FIELD_TYPES.includes(type as PlanFieldType)) {
    throw new Error("Unsupported field type");
  }
}

function normalizeDateFieldValue(value: string | number | boolean | null) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid date");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("Invalid date");
  }
  return value;
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
    select: { id: true, projectId: true, status: true },
  });

  if (!plan) throw new Error("Plan not found");

  if (isTerminalPlanStatus(plan.status)) {
    const locale = await getCurrentLocale();
    throw new Error(getTerminalPlanIssueMessage(plan.status, locale));
  }

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
        status: "PLANNED",
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
      select: { id: true, status: true },
    });

    if (!existingPlan) {
      throw new Error("Plan not found");
    }
    if (isTerminalPlanStatus(existingPlan.status)) {
      throw new Error(getTerminalPlanIssueMessage(existingPlan.status, locale));
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

async function changePlanStatus(planId: string, nextStatus: PlanStatus) {
  const locale = await getCurrentLocale();
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;
  if (!sessionUser?.id) throw new Error("Unauthorized");
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { id: true, projectId: true, status: true },
  });
  if (!plan) throw new Error("Plan not found");
  const activeProject = await getActiveProjectForUser(sessionUser.id, sessionUser.role ?? "USER");
  if (!isProjectInActiveContext({ activeProjectId: activeProject?.id || null, projectId: plan.projectId })) {
    throw new Error("Unauthorized");
  }
  await checkProjectAdmin(plan.projectId);
  if (!canTransitionPlanStatus(plan.status, nextStatus)) {
    throw new Error(locale === "zh" ? "当前计划状态不允许此操作" : "This plan status does not allow that action");
  }
  return plan;
}

function revalidatePlanLifecycle(planId: string) {
  revalidatePath("/");
  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
  revalidatePath("/issues");
}

export async function startPlan(planId: string) {
  try {
    const current = await changePlanStatus(planId, "ACTIVE");
    const updated = await prisma.plan.updateMany({ where: { id: planId, status: current.status }, data: { status: "ACTIVE" } });
    if (updated.count !== 1) throw new Error("Plan status changed. Please try again.");
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
    revalidatePlanLifecycle(planId);
    return { success: true, plan };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to start plan" };
  }
}

export async function completePlan(planId: string) {
  try {
    const locale = await getCurrentLocale();
    await changePlanStatus(planId, "COMPLETED");
    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.plan.findUnique({
        where: { id: planId },
        select: {
          status: true,
          project: { select: { workflowStatuses: { orderBy: { position: "asc" } } } },
          issues: { select: { id: true, key: true, status: true }, orderBy: { key: "asc" } },
        },
      });
      if (!plan || !canTransitionPlanStatus(plan.status, "COMPLETED")) {
        throw new Error(locale === "zh" ? "只有进行中的计划可以完成" : "Only active plans can be completed");
      }
      if (plan.issues.length === 0) {
        throw new Error(locale === "zh" ? "空计划不能完成，请先关联至少一个问题" : "An empty plan cannot be completed");
      }
      const workflowStatuses = plan.project.workflowStatuses as WorkflowStatusRecord[];
      const doneStatusKeys = workflowStatuses.filter((status) => isDoneWorkflowStatus(status.key, workflowStatuses)).map((status) => status.key);
      const { unfinished } = partitionPlanIssues(plan.issues, doneStatusKeys);
      if (unfinished.length > 0) {
        const keys = unfinished.slice(0, 5).map((issue) => issue.key).join("、");
        throw new Error(
          locale === "zh"
            ? `还有 ${unfinished.length} 个问题未完成：${keys}`
            : `${unfinished.length} issues are unfinished: ${keys}`,
        );
      }
      return tx.plan.update({ where: { id: planId }, data: { status: "COMPLETED" } });
    });
    revalidatePlanLifecycle(planId);
    return { success: true, plan: result };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to complete plan" };
  }
}

export async function cancelPlan(planId: string) {
  try {
    const locale = await getCurrentLocale();
    await changePlanStatus(planId, "CANCELLED");
    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.plan.findUnique({
        where: { id: planId },
        select: {
          status: true,
          project: { select: { workflowStatuses: { orderBy: { position: "asc" } } } },
          issues: { select: { id: true, status: true } },
        },
      });
      if (!plan || !canTransitionPlanStatus(plan.status, "CANCELLED")) {
        throw new Error(locale === "zh" ? "当前计划不能取消" : "This plan cannot be cancelled");
      }
      const workflowStatuses = plan.project.workflowStatuses as WorkflowStatusRecord[];
      const doneStatusKeys = workflowStatuses.filter((status) => isDoneWorkflowStatus(status.key, workflowStatuses)).map((status) => status.key);
      const { unfinished } = partitionPlanIssues(plan.issues, doneStatusKeys);
      const unfinishedIds = unfinished.map((issue) => issue.id);
      if (unfinishedIds.length > 0) {
        await tx.planIssueFieldValue.deleteMany({ where: { planId, issueId: { in: unfinishedIds } } });
        await tx.issue.updateMany({ where: { id: { in: unfinishedIds }, planId }, data: { planId: null } });
      }
      const updated = await tx.plan.update({ where: { id: planId }, data: { status: "CANCELLED" } });
      return { plan: updated, releasedCount: unfinishedIds.length, retainedCount: plan.issues.length - unfinishedIds.length };
    });
    revalidatePlanLifecycle(planId);
    return { success: true, ...result };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to cancel plan" };
  }
}

export async function reopenPlan(planId: string) {
  try {
    const current = await changePlanStatus(planId, "ACTIVE");
    const updated = await prisma.plan.updateMany({ where: { id: planId, status: current.status }, data: { status: "ACTIVE" } });
    if (updated.count !== 1) throw new Error("Plan status changed. Please try again.");
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
    revalidatePlanLifecycle(planId);
    return { success: true, plan };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to reopen plan" };
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
    if (!isValidFieldKey(key)) {
      const locale = await getCurrentLocale();
      throw new Error(locale === "zh" ? "标识只能包含字母、数字和下划线，且不能以数字开头" : "Field key can only contain letters, numbers, and underscores, and cannot start with a number");
    }

    const existingField = await prisma.planFieldDefinition.findFirst({
      where: { planId: plan.id, key },
      select: { id: true },
    });
    if (existingField) {
      const locale = await getCurrentLocale();
      throw new Error(locale === "zh" ? "标识已存在" : "Field key already exists");
    }

    const options = parseSelectOptions(data.optionsText);
    if (data.type === "SELECT" && options.length === 0) {
      const locale = await getCurrentLocale();
      throw new Error(locale === "zh" ? "下拉选择至少需要一个选项" : "Select fields require at least one option");
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
      select: { id: true, type: true, optionsJson: true },
    });

    if (!existing) throw new Error("Field not found");

    const name = data.name.trim();
    if (!name) throw new Error("Field name is required");

    const options = parseSelectOptions(data.optionsText);
    if (existing.type === "SELECT" && options.length === 0) {
      const locale = await getCurrentLocale();
      throw new Error(locale === "zh" ? "下拉选择至少需要一个选项" : "Select fields require at least one option");
    }
    if (existing.type === "SELECT") {
      const existingOptions = parseStoredSelectOptions(existing.optionsJson);
      if (existingOptions.some((option, index) => options[index] !== option)) {
        const locale = await getCurrentLocale();
        throw new Error(locale === "zh" ? "已有选项不可删除或重命名，只能追加新选项" : "Existing options cannot be deleted or renamed. You can only add new options.");
      }
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
    } else if (field.type === "DATE") {
      valueData.valueText = normalizeDateFieldValue(data.value);
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
