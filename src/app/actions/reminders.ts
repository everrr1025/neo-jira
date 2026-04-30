"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/prisma";
import { getRequiredSession, getProjectRole } from "@/lib/permissions";

type SessionUser = {
  id?: string;
  role?: string | null;
};

type ReminderScopeType = "PERSONAL" | "DEPARTMENT" | "PROJECT";
type ReminderItemType = "NOTE" | "TODO" | "EVENT" | "REMINDER";

function getSessionUser(session: unknown) {
  const user = (session as { user?: SessionUser }).user;
  return {
    id: user?.id || "",
    role: user?.role || "USER",
  };
}

function parseLocalDateTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isValidPriority(value: string) {
  return ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(value);
}

function isValidItemType(value: string): value is ReminderItemType {
  return ["NOTE", "TODO", "EVENT", "REMINDER"].includes(value);
}

async function getDepartmentMembership(userId: string, departmentId: string) {
  return prisma.departmentMember.findUnique({
    where: { departmentId_userId: { departmentId, userId } },
    select: { role: true },
  });
}

async function canManageDepartmentReminder(userId: string, userRole: string, departmentId: string) {
  if (userRole === "ADMIN") return true;
  const membership = await getDepartmentMembership(userId, departmentId);
  return membership?.role === "HEAD" || membership?.role === "ASSISTANT";
}

async function canManageProjectReminder(userId: string, userRole: string, projectId: string) {
  if (userRole === "ADMIN") return true;

  const role = await getProjectRole(userId, projectId);
  if (role === "ADMIN") return true;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      department: {
        members: {
          some: {
            userId,
            role: { in: ["HEAD", "ASSISTANT"] },
          },
        },
      },
    },
    select: { id: true },
  });

  return Boolean(project);
}

export async function createReminder(data: {
  departmentId: string;
  title: string;
  content?: string;
  startAt?: string;
  endAt?: string;
  priority?: string;
  itemType?: ReminderItemType;
  isImportant?: boolean;
  scopeType: ReminderScopeType;
  projectId?: string;
  issueId?: string;
}) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const departmentId = data.departmentId.trim();
    const title = data.title.trim();
    const content = data.content?.trim() || null;
    const itemType = isValidItemType(data.itemType || "") ? data.itemType! : "REMINDER";
    const startAt = data.startAt ? parseLocalDateTime(data.startAt) : itemType === "NOTE" ? new Date() : null;
    const endAt = data.endAt ? parseLocalDateTime(data.endAt) : null;
    const priority = isValidPriority(data.priority || "") ? data.priority! : "MEDIUM";
    const scopeType = data.scopeType;

    if (!departmentId || !title || !startAt) {
      return { success: false, error: "Item title and time are required" };
    }
    if (!["PERSONAL", "DEPARTMENT", "PROJECT"].includes(scopeType)) {
      return { success: false, error: "Invalid reminder scope" };
    }
    if (endAt && endAt < startAt) {
      return { success: false, error: "End time must be after start time" };
    }

    const membership = await getDepartmentMembership(currentUser.id, departmentId);
    if (currentUser.role !== "ADMIN" && !membership) {
      return { success: false, error: "Department access required" };
    }

    let projectId: string | null = null;
    let issueId: string | null = null;

    if (scopeType === "DEPARTMENT") {
      const canManage = await canManageDepartmentReminder(currentUser.id, currentUser.role, departmentId);
      if (!canManage) return { success: false, error: "Department reminder permission required" };
    }

    if (scopeType === "PROJECT") {
      projectId = data.projectId?.trim() || null;
      if (!projectId) return { success: false, error: "Project is required" };

      const project = await prisma.project.findFirst({
        where: { id: projectId, departmentId },
        select: { id: true },
      });
      if (!project) return { success: false, error: "Project not found in this department" };

      const canManage = await canManageProjectReminder(currentUser.id, currentUser.role, projectId);
      if (!canManage) return { success: false, error: "Project reminder permission required" };
    }

    if (data.issueId) {
      const issue = await prisma.issue.findFirst({
        where: {
          id: data.issueId,
          ...(projectId ? { projectId } : { project: { departmentId } }),
        },
        select: { id: true, projectId: true },
      });
      if (!issue) return { success: false, error: "Issue not found" };
      if (currentUser.role !== "ADMIN") {
        const canManageIssueProject = await canManageProjectReminder(currentUser.id, currentUser.role, issue.projectId);
        const issueProjectRole = await getProjectRole(currentUser.id, issue.projectId);
        if (!canManageIssueProject && !issueProjectRole) {
          return { success: false, error: "Issue access required" };
        }
      }
      issueId = issue.id;
      if (scopeType === "PROJECT") projectId = issue.projectId;
    }

    const reminder = await prisma.reminder.create({
      data: {
        title,
        content,
        startAt,
        endAt,
        itemType,
        isImportant: Boolean(data.isImportant),
        priority,
        scopeType,
        departmentId: scopeType === "PERSONAL" ? null : departmentId,
        projectId,
        issueId,
        creatorId: currentUser.id,
        assigneeId: scopeType === "PERSONAL" ? currentUser.id : null,
      },
    });

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath(`/departments/${departmentId}/items`);
    return { success: true, reminder };
  } catch (error) {
    console.error("Failed to create reminder:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create reminder" };
  }
}

export async function setReminderCompleted(reminderId: string, completed: boolean) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      select: {
        id: true,
        scopeType: true,
        creatorId: true,
        assigneeId: true,
        departmentId: true,
        projectId: true,
      },
    });

    if (!reminder) return { success: false, error: "Reminder not found" };

    let canComplete = reminder.creatorId === currentUser.id || reminder.assigneeId === currentUser.id;
    if (!canComplete && reminder.departmentId) {
      canComplete = await canManageDepartmentReminder(currentUser.id, currentUser.role, reminder.departmentId);
    }
    if (!canComplete && reminder.projectId) {
      canComplete = await canManageProjectReminder(currentUser.id, currentUser.role, reminder.projectId);
    }
    if (!canComplete) return { success: false, error: "Reminder permission required" };

    const updated = await prisma.reminder.update({
      where: { id: reminder.id },
      data: { completedAt: completed ? new Date() : null },
      select: { departmentId: true },
    });

    if (updated.departmentId) {
      revalidatePath(`/departments/${updated.departmentId}`);
      revalidatePath(`/departments/${updated.departmentId}/items`);
    } else {
      revalidatePath("/");
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to update reminder:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update reminder" };
  }
}
