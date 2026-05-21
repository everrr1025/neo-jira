"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/prisma";
import { notifyMeetingAttendees } from "@/lib/notifications";
import { getRequiredSession, getProjectRole } from "@/lib/permissions";

type SessionUser = {
  id?: string;
  role?: string | null;
};

type ReminderScopeType = "PERSONAL" | "DEPARTMENT" | "PROJECT";
type ReminderItemType = "NOTE" | "TODO" | "EVENT" | "REMINDER";
type ReminderAttendanceStatus = "PENDING" | "CONFIRMED" | "DECLINED" | "TENTATIVE";

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

function isValidAttendanceStatus(value: string): value is ReminderAttendanceStatus {
  return ["PENDING", "CONFIRMED", "DECLINED", "TENTATIVE"].includes(value);
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
      OR: [
        { ownerId: userId },
        {
          department: {
            members: {
              some: {
                userId,
                role: { in: ["HEAD", "ASSISTANT"] },
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  return Boolean(project);
}

async function getReminderForPermission(reminderId: string) {
  return prisma.reminder.findUnique({
    where: { id: reminderId },
    select: {
      id: true,
      itemType: true,
      creatorId: true,
      assigneeId: true,
      departmentId: true,
      projectId: true,
      completedAt: true,
    },
  });
}

async function canManageReminder(
  reminder: Awaited<ReturnType<typeof getReminderForPermission>>,
  userId: string,
  userRole: string,
) {
  if (!reminder) return false;
  if (userRole === "ADMIN" || reminder.creatorId === userId) return true;
  if (reminder.departmentId && (await canManageDepartmentReminder(userId, userRole, reminder.departmentId))) return true;
  if (reminder.projectId && (await canManageProjectReminder(userId, userRole, reminder.projectId))) return true;
  return false;
}

async function canReplyToReminder(
  reminder: Awaited<ReturnType<typeof getReminderForPermission>>,
  userId: string,
  userRole: string,
) {
  if (!reminder) return false;
  if (reminder.creatorId === userId || reminder.assigneeId === userId) return true;
  if (reminder.itemType === "EVENT") {
    const attendee = await prisma.reminderAttendee.findUnique({
      where: { reminderId_userId: { reminderId: reminder.id, userId } },
      select: { id: true },
    });
    if (attendee) return true;
  }
  return canManageReminder(reminder, userId, userRole);
}

async function assertReminderAssignee({
  assigneeId,
  scopeType,
  departmentId,
  projectId,
  currentUserId,
}: {
  assigneeId: string;
  scopeType: ReminderScopeType;
  departmentId: string;
  projectId: string | null;
  currentUserId: string;
}) {
  if (scopeType === "PERSONAL" && assigneeId !== currentUserId) {
    throw new Error("Personal items can only be assigned to yourself");
  }

  if (scopeType === "DEPARTMENT") {
    const assigneeMembership = await getDepartmentMembership(assigneeId, departmentId);
    if (!assigneeMembership) throw new Error("Assignee must belong to this department");
  }

  if (scopeType === "PROJECT") {
    if (!projectId) throw new Error("Project is required");
    const projectMember = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: assigneeId, projectId } },
      select: { id: true },
    });
    if (!projectMember) throw new Error("Assignee must belong to this project");
  }
}

async function assertDepartmentAttendees(attendeeIds: string[], departmentId: string) {
  if (attendeeIds.length === 0) return;
  const members = await prisma.departmentMember.findMany({
    where: { departmentId, userId: { in: attendeeIds } },
    select: { userId: true },
  });
  const memberIds = new Set(members.map((member) => member.userId));
  const missingAttendee = attendeeIds.find((id) => !memberIds.has(id));
  if (missingAttendee) throw new Error("Attendees must belong to this department");
}

async function syncReminderAttendees(reminderId: string, attendeeIds: string[], creatorId: string) {
  const nextAttendeeIds = Array.from(new Set(attendeeIds.filter(Boolean)));
  await prisma.reminderAttendee.deleteMany({
    where: {
      reminderId,
      userId: { notIn: nextAttendeeIds.length > 0 ? nextAttendeeIds : ["__none__"] },
    },
  });

  await Promise.all(
    nextAttendeeIds.map((userId) =>
      prisma.reminderAttendee.upsert({
        where: { reminderId_userId: { reminderId, userId } },
        update: {},
        create: {
          reminderId,
          userId,
          status: userId === creatorId ? "CONFIRMED" : "PENDING",
          respondedAt: userId === creatorId ? new Date() : null,
        },
      }),
    ),
  );
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
  assigneeId?: string;
  dueAt?: string;
  attendeeIds?: string[];
}) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const departmentId = data.departmentId.trim();
    const title = data.title.trim();
    const content = data.content?.trim() || null;
    const itemType = isValidItemType(data.itemType || "") ? data.itemType! : "REMINDER";
    const startAt = data.startAt ? parseLocalDateTime(data.startAt) : itemType === "NOTE" || itemType === "TODO" ? new Date() : null;
    const endAt = data.endAt ? parseLocalDateTime(data.endAt) : null;
    const dueAt = data.dueAt ? parseLocalDateTime(data.dueAt) : null;
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
    let assigneeId: string | null = null;

    if (scopeType === "DEPARTMENT" && itemType !== "EVENT") {
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

    const requestedTaskAssigneeId = itemType === "TODO" ? data.assigneeId?.trim() || currentUser.id : data.assigneeId?.trim() || "";

    if (requestedTaskAssigneeId) {
      const requestedAssigneeId = requestedTaskAssigneeId;
      await assertReminderAssignee({
        assigneeId: requestedAssigneeId,
        scopeType,
        departmentId,
        projectId,
        currentUserId: currentUser.id,
      });
      assigneeId = requestedAssigneeId;
    }

    const attendeeIds = Array.from(new Set((data.attendeeIds || []).map((id) => id.trim()).filter(Boolean)));
    if (itemType === "EVENT" && attendeeIds.length > 0) {
      await assertDepartmentAttendees(attendeeIds, departmentId);
    }

    const reminder = await prisma.reminder.create({
      data: {
        title,
        content,
        startAt,
        endAt,
        remindAt: itemType === "TODO" ? dueAt : null,
        itemType,
        taskStatus: itemType === "TODO" ? "NOT_STARTED" : "IN_PROGRESS",
        isImportant: Boolean(data.isImportant),
        priority,
        scopeType,
        departmentId: scopeType === "PERSONAL" ? null : departmentId,
        projectId,
        issueId,
        creatorId: currentUser.id,
        assigneeId: assigneeId || (itemType === "TODO" || scopeType === "PERSONAL" ? currentUser.id : null),
      },
    });

    if (itemType === "EVENT" && attendeeIds.length > 0) {
      await syncReminderAttendees(reminder.id, attendeeIds, currentUser.id);
      await notifyMeetingAttendees({
        actorId: currentUser.id,
        attendeeIds,
        title,
        departmentId,
      });
    }

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

    const reminder = await getReminderForPermission(reminderId);

    if (!reminder) return { success: false, error: "Reminder not found" };

    const canComplete =
      reminder.creatorId === currentUser.id ||
      reminder.assigneeId === currentUser.id ||
      (await canManageReminder(reminder, currentUser.id, currentUser.role));
    if (!canComplete) return { success: false, error: "Reminder permission required" };

    const updated = await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        completedAt: completed ? new Date() : null,
        taskStatus: completed ? "DONE" : "IN_PROGRESS",
      },
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

export async function updateReminderTask(
  reminderId: string,
  data: {
    title: string;
    content?: string;
    dueAt?: string;
    assigneeId?: string;
    scopeType?: ReminderScopeType;
    projectId?: string;
  },
) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      select: {
        id: true,
        itemType: true,
        title: true,
        content: true,
        remindAt: true,
        creatorId: true,
        assigneeId: true,
        departmentId: true,
        projectId: true,
        completedAt: true,
      },
    });

    if (!reminder || reminder.itemType !== "TODO") return { success: false, error: "Task not found" };
    if (reminder.creatorId !== currentUser.id) {
      return { success: false, error: "Task edit permission required" };
    }

    const title = data.title.trim();
    if (!title) return { success: false, error: "Task title is required" };

    const nextScopeType = data.scopeType || (reminder.projectId ? "PROJECT" : reminder.departmentId ? "DEPARTMENT" : "PERSONAL");
    const nextProjectId = nextScopeType === "PROJECT" ? data.projectId?.trim() || reminder.projectId : null;
    const nextDepartmentId = nextScopeType === "PERSONAL" ? null : reminder.departmentId;
    const nextAssigneeId = data.assigneeId?.trim() || currentUser.id;
    const dueAt = data.dueAt ? parseLocalDateTime(data.dueAt) : null;

    if (nextScopeType !== "PERSONAL" && !nextDepartmentId) {
      return { success: false, error: "Department access required" };
    }
    await assertReminderAssignee({
      assigneeId: nextAssigneeId,
      scopeType: nextScopeType,
      departmentId: nextDepartmentId || "",
      projectId: nextProjectId,
      currentUserId: currentUser.id,
    });

    const content = data.content?.trim() || null;
    const coreChanged =
      title !== reminder.title ||
      content !== (reminder.content || null) ||
      dueAt?.getTime() !== reminder.remindAt?.getTime() ||
      (!dueAt && reminder.remindAt) ||
      nextAssigneeId !== reminder.assigneeId ||
      nextProjectId !== reminder.projectId;

    const updated = await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        title,
        content,
        remindAt: dueAt,
        scopeType: nextScopeType,
        departmentId: nextDepartmentId,
        projectId: nextProjectId,
        assigneeId: nextAssigneeId,
        ...(coreChanged && reminder.completedAt ? { completedAt: null, taskStatus: "IN_PROGRESS" } : {}),
      },
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
    console.error("Failed to update task:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update task" };
  }
}

export async function deleteReminderTask(reminderId: string) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      select: {
        id: true,
        itemType: true,
        creatorId: true,
        departmentId: true,
      },
    });

    if (!reminder || reminder.itemType !== "TODO") return { success: false, error: "Task not found" };
    if (reminder.creatorId !== currentUser.id) {
      return { success: false, error: "Task delete permission required" };
    }

    await prisma.$transaction([
      prisma.reminderComment.deleteMany({ where: { reminderId: reminder.id } }),
      prisma.reminder.delete({ where: { id: reminder.id } }),
    ]);

    if (reminder.departmentId) {
      revalidatePath(`/departments/${reminder.departmentId}`);
      revalidatePath(`/departments/${reminder.departmentId}/items`);
    } else {
      revalidatePath("/");
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to delete task:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete task" };
  }
}

export async function deleteReminderItem(reminderId: string) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      select: {
        id: true,
        itemType: true,
        creatorId: true,
        departmentId: true,
      },
    });

    if (!reminder || !["EVENT", "REMINDER", "NOTE"].includes(reminder.itemType)) {
      return { success: false, error: "Item not found" };
    }
    if (reminder.creatorId !== currentUser.id && currentUser.role !== "ADMIN") {
      return { success: false, error: "Item delete permission required" };
    }

    await prisma.$transaction([
      prisma.reminderAttendee.deleteMany({ where: { reminderId: reminder.id } }),
      prisma.reminderComment.deleteMany({ where: { reminderId: reminder.id } }),
      prisma.reminder.delete({ where: { id: reminder.id } }),
    ]);

    if (reminder.departmentId) {
      revalidatePath(`/departments/${reminder.departmentId}`);
      revalidatePath(`/departments/${reminder.departmentId}/items`);
    } else {
      revalidatePath("/");
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to delete item:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete item" };
  }
}

export async function updateReminderItem(
  reminderId: string,
  data: {
    title: string;
    content?: string;
    startAt?: string;
    endAt?: string;
    itemType?: ReminderItemType;
    scopeType?: ReminderScopeType;
    departmentId?: string;
    attendeeIds?: string[];
  },
) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      select: {
        id: true,
        itemType: true,
        title: true,
        content: true,
        startAt: true,
        endAt: true,
        creatorId: true,
        departmentId: true,
        scopeType: true,
      },
    });

    if (!reminder || !["EVENT", "REMINDER", "NOTE"].includes(reminder.itemType)) {
      return { success: false, error: "Item not found" };
    }
    if (reminder.creatorId !== currentUser.id && currentUser.role !== "ADMIN") {
      return { success: false, error: "Item edit permission required" };
    }

    const title = data.title.trim();
    if (!title) return { success: false, error: "Item title is required" };

    const itemType = isValidItemType(data.itemType || "") ? data.itemType! : reminder.itemType;
    const startAt = data.startAt ? parseLocalDateTime(data.startAt) : null;
    const endAt = data.endAt ? parseLocalDateTime(data.endAt) : null;
    const content = data.content?.trim() || null;
    if (!startAt) return { success: false, error: "Item time is required" };
    if (endAt && endAt < startAt) return { success: false, error: "End time must be after start time" };

    const scopeType = data.scopeType || (reminder.scopeType as ReminderScopeType);
    if (!["PERSONAL", "DEPARTMENT", "PROJECT"].includes(scopeType)) {
      return { success: false, error: "Invalid reminder scope" };
    }

    const requestedDepartmentId = data.departmentId?.trim() || "";
    const departmentId = scopeType === "PERSONAL" ? null : reminder.departmentId || requestedDepartmentId || null;
    if (scopeType !== "PERSONAL" && !departmentId) {
      return { success: false, error: "Department access required" };
    }
    if (departmentId && !reminder.departmentId) {
      const membership = await getDepartmentMembership(currentUser.id, departmentId);
      if (currentUser.role !== "ADMIN" && !membership) {
        return { success: false, error: "Department access required" };
      }
    }
    if (scopeType === "DEPARTMENT" && itemType !== "EVENT" && departmentId) {
      const canManage = await canManageDepartmentReminder(currentUser.id, currentUser.role, departmentId);
      if (!canManage) return { success: false, error: "Department reminder permission required" };
    }

    const attendeeIds = Array.from(new Set((data.attendeeIds || []).map((id) => id.trim()).filter(Boolean)));
    if (itemType === "EVENT" && attendeeIds.length > 0) {
      if (!departmentId) return { success: false, error: "Department access required" };
      await assertDepartmentAttendees(attendeeIds, departmentId);
    }

    const updated = await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        title,
        content,
        startAt,
        endAt,
        itemType,
        scopeType,
        departmentId,
      },
      select: { departmentId: true },
    });

    if (itemType === "EVENT" && attendeeIds.length > 0) {
      await syncReminderAttendees(reminder.id, attendeeIds, reminder.creatorId);
      const coreChanged =
        title !== reminder.title ||
        content !== (reminder.content || null) ||
        startAt.getTime() !== reminder.startAt.getTime() ||
        (endAt?.getTime() || null) !== (reminder.endAt?.getTime() || null);
      if (coreChanged) {
        await prisma.reminderAttendee.updateMany({
          where: { reminderId: reminder.id, userId: { not: reminder.creatorId } },
          data: { status: "PENDING", note: null, respondedAt: null },
        });
      }
    } else if (itemType !== "EVENT" || data.attendeeIds !== undefined) {
      await prisma.reminderAttendee.deleteMany({ where: { reminderId: reminder.id } });
    }

    const revalidateDepartmentId = updated.departmentId || reminder.departmentId;
    if (revalidateDepartmentId) {
      revalidatePath(`/departments/${revalidateDepartmentId}`);
      revalidatePath(`/departments/${revalidateDepartmentId}/items`);
    } else {
      revalidatePath("/");
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to update item:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update item" };
  }
}

export async function updateMeetingAttendance(
  reminderId: string,
  status: ReminderAttendanceStatus,
  note?: string,
) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };
    if (!isValidAttendanceStatus(status)) return { success: false, error: "Invalid attendance status" };

    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      select: {
        id: true,
        itemType: true,
        title: true,
        departmentId: true,
        attendees: {
          where: { userId: currentUser.id },
          select: { id: true },
        },
      },
    });

    if (!reminder || reminder.itemType !== "EVENT") return { success: false, error: "Meeting not found" };
    const attendee = reminder.attendees[0];
    if (!attendee) return { success: false, error: "Only invited attendees can confirm this meeting" };

    const trimmedNote = note?.trim() || "";
    await prisma.$transaction([
      prisma.reminderAttendee.update({
        where: { id: attendee.id },
        data: {
          status,
          note: trimmedNote || null,
          respondedAt: status === "PENDING" ? null : new Date(),
        },
      }),
      ...(trimmedNote
        ? [
            prisma.reminderComment.create({
              data: {
                reminderId: reminder.id,
                authorId: currentUser.id,
                content: trimmedNote,
              },
            }),
          ]
        : []),
    ]);

    if (reminder.departmentId) {
      revalidatePath(`/departments/${reminder.departmentId}`);
      revalidatePath(`/departments/${reminder.departmentId}/items`);
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to update meeting attendance:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update meeting attendance" };
  }
}

export async function addReminderComment(reminderId: string, content: string) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const reminder = await getReminderForPermission(reminderId);
    if (!reminder) return { success: false, error: "Task not found" };
    if (!(await canReplyToReminder(reminder, currentUser.id, currentUser.role))) {
      return { success: false, error: "Task reply permission required" };
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) return { success: false, error: "Reply content is required" };

    const comment = await prisma.reminderComment.create({
      data: {
        reminderId: reminder.id,
        authorId: currentUser.id,
        content: trimmedContent,
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    if (reminder.departmentId) {
      revalidatePath(`/departments/${reminder.departmentId}`);
      revalidatePath(`/departments/${reminder.departmentId}/items`);
    } else {
      revalidatePath("/");
    }

    return { success: true, comment };
  } catch (error) {
    console.error("Failed to add task reply:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to add task reply" };
  }
}
