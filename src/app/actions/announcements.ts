"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/permissions";
import { getDepartmentNotificationPermission } from "@/lib/departmentNotifications";

type SessionUser = {
  id?: string;
  role?: string | null;
};

function getSessionUser(session: unknown) {
  const user = (session as { user?: SessionUser }).user;
  return {
    id: user?.id || "",
    role: user?.role || "USER",
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function getCurrentUser() {
  const session = await getRequiredSession();
  const user = getSessionUser(session);
  if (!user.id) throw new Error("Unauthorized. Please log in.");
  return user;
}

function revalidateNotificationPaths(departmentId: string) {
  revalidatePath("/");
  revalidatePath(`/departments/${departmentId}`);
  revalidatePath(`/departments/${departmentId}/notifications`);
}

async function getRecipients(departmentId: string, level: "DEPARTMENT" | "PROJECT", projectId?: string | null) {
  if (level === "DEPARTMENT") {
    const members = await prisma.departmentMember.findMany({
      where: { departmentId },
      select: { userId: true },
    });
    return {
      projectId: null,
      userIds: members.map((member) => member.userId),
    };
  }

  if (!projectId) {
    throw new Error("Project is required for project notifications.");
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, departmentId },
    select: {
      id: true,
      ownerId: true,
      members: { select: { userId: true } },
    },
  });
  if (!project) throw new Error("Project not found.");

  const userIds = Array.from(new Set([project.ownerId, ...project.members.map((member) => member.userId)].filter(Boolean))) as string[];
  return {
    projectId: project.id,
    userIds,
  };
}

async function assertCanManageAnnouncement(announcementId: string, userId: string) {
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: {
      id: true,
      level: true,
      status: true,
      departmentId: true,
      projectId: true,
      authorId: true,
    },
  });
  if (!announcement?.departmentId) throw new Error("Notification not found.");

  const canManage = announcement.level !== "SYSTEM" && announcement.authorId === userId;
  if (!canManage) throw new Error("Unauthorized. Notification management access required.");

  return announcement;
}

export async function createAnnouncementNotification(data: {
  departmentId: string;
  level: "DEPARTMENT" | "PROJECT";
  projectId?: string | null;
  title: string;
  content: string;
}) {
  try {
    const user = await getCurrentUser();
    const departmentId = data.departmentId;
    const level = data.level;
    const title = data.title.trim();
    const content = data.content.trim();
    if (!title || !content) return { success: false, error: "Notification title and content are required." };

    const permission = await getDepartmentNotificationPermission(departmentId, {
      userId: user.id,
      userRole: user.role,
    });
    if (level === "DEPARTMENT" && !permission.canCreateDepartment) {
      return { success: false, error: "Unauthorized. Department notification access required." };
    }
    if (level === "PROJECT" && !permission.manageableProjects.some((project) => project.id === data.projectId)) {
      return { success: false, error: "Unauthorized. Project notification access required." };
    }

    const recipients = await getRecipients(departmentId, level, data.projectId);
    if (recipients.userIds.length === 0) return { success: false, error: "No recipients found." };

    await prisma.$transaction(async (tx) => {
      const notification = await tx.announcement.create({
        data: {
          level,
          title,
          content,
          status: "SENT",
          departmentId,
          projectId: recipients.projectId,
          authorId: user.id,
        },
        select: { id: true },
      });

      await tx.announcementReceipt.createMany({
        data: recipients.userIds.map((userId) => ({
          announcementId: notification.id,
          userId,
          projectId: recipients.projectId,
        })),
      });
    });

    revalidateNotificationPaths(departmentId);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "Failed to create notification.") };
  }
}

export async function markAnnouncementRead(announcementId: string) {
  try {
    const user = await getCurrentUser();
    await prisma.announcementReceipt.updateMany({
      where: {
        announcementId,
        userId: user.id,
        read: false,
        announcement: { status: "SENT" },
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "Failed to mark notification as read.") };
  }
}

export async function markSystemNotificationRead(notificationId: string) {
  try {
    const user = await getCurrentUser();
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: user.id,
        read: false,
      },
      data: {
        read: true,
      },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "Failed to mark notification as read.") };
  }
}

export async function revokeAnnouncementNotification(announcementId: string) {
  try {
    const user = await getCurrentUser();
    const announcement = await assertCanManageAnnouncement(announcementId, user.id);
    await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });
    if (announcement.departmentId) revalidateNotificationPaths(announcement.departmentId);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "Failed to revoke notification.") };
  }
}

export async function deleteAnnouncementNotification(announcementId: string) {
  try {
    const user = await getCurrentUser();
    const announcement = await assertCanManageAnnouncement(announcementId, user.id);
    await prisma.announcement.delete({ where: { id: announcementId } });
    if (announcement.departmentId) revalidateNotificationPaths(announcement.departmentId);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "Failed to delete notification.") };
  }
}

export async function resendAnnouncementNotification(
  announcementId: string,
  data: {
    title: string;
    content: string;
  },
) {
  try {
    const user = await getCurrentUser();
    const announcement = await assertCanManageAnnouncement(announcementId, user.id);
    const title = data.title.trim();
    const content = data.content.trim();
    if (!title || !content) return { success: false, error: "Notification title and content are required." };

    await prisma.$transaction(async (tx) => {
      await tx.announcement.update({
        where: { id: announcementId },
        data: {
          title,
          content,
          status: "SENT",
          revokedAt: null,
          sentAt: new Date(),
        },
      });
      await tx.announcementReceipt.updateMany({
        where: { announcementId },
        data: {
          read: false,
          readAt: null,
          createdAt: new Date(),
        },
      });
    });

    if (announcement.departmentId) revalidateNotificationPaths(announcement.departmentId);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "Failed to resend notification.") };
  }
}
