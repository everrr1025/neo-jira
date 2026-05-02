"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/prisma";
import { getProjectRole, getRequiredSession } from "@/lib/permissions";

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

function normalizeOptionalId(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

async function assertFolderOwner(folderId: string | null, ownerId: string) {
  if (!folderId) return;
  const folder = await prisma.noteFolder.findFirst({
    where: { id: folderId, ownerId },
    select: { id: true },
  });
  if (!folder) throw new Error("Folder not found");
}

async function assertDepartmentAccess(departmentId: string | null, userId: string, userRole: string) {
  if (!departmentId || userRole === "ADMIN") return;
  const membership = await prisma.departmentMember.findUnique({
    where: { departmentId_userId: { departmentId, userId } },
    select: { id: true },
  });
  if (!membership) throw new Error("Department access required");
}

async function assertProjectAccess(projectId: string | null, userId: string, userRole: string) {
  if (!projectId) return;
  if (userRole === "ADMIN") return;
  const role = await getProjectRole(userId, projectId);
  if (!role) throw new Error("Project access required");
}

async function assertIssueAccess(issueId: string | null, projectId: string | null, userId: string, userRole: string) {
  if (!issueId) return null;
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, projectId: true },
  });
  if (!issue) throw new Error("Issue not found");
  if (projectId && issue.projectId !== projectId) throw new Error("Issue does not belong to the selected project");
  await assertProjectAccess(issue.projectId, userId, userRole);
  return issue.projectId;
}

async function assertTaskAccess(taskId: string | null, userId: string, userRole: string) {
  if (!taskId) return null;
  const task = await prisma.reminder.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      itemType: true,
      creatorId: true,
      assigneeId: true,
      departmentId: true,
      projectId: true,
    },
  });
  if (!task || task.itemType !== "TODO") throw new Error("Task not found");
  if (userRole === "ADMIN" || task.creatorId === userId || task.assigneeId === userId) return task;

  if (task.departmentId) {
    const membership = await prisma.departmentMember.findUnique({
      where: { departmentId_userId: { departmentId: task.departmentId, userId } },
      select: { id: true },
    });
    if (membership) return task;
  }

  if (task.projectId) {
    const role = await getProjectRole(userId, task.projectId);
    if (role) return task;
  }

  throw new Error("Task access required");
}

function revalidateNotes(departmentId: string | null) {
  if (departmentId) {
    revalidatePath(`/departments/${departmentId}/items`);
    revalidatePath(`/departments/${departmentId}`);
  } else {
    revalidatePath("/");
  }
}

export async function createNoteFolder(data: {
  name: string;
  color?: string;
  departmentId?: string;
}) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const name = data.name.trim();
    if (!name) return { success: false, error: "Folder name is required" };
    if (name.length > 60) return { success: false, error: "Folder name is too long" };

    const position = await prisma.noteFolder.count({ where: { ownerId: currentUser.id } });
    const folder = await prisma.noteFolder.create({
      data: {
        name,
        color: data.color?.trim() || null,
        position,
        ownerId: currentUser.id,
      },
    });

    revalidateNotes(normalizeOptionalId(data.departmentId));
    return { success: true, folderId: folder.id };
  } catch (error) {
    console.error("Failed to create note folder:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create folder" };
  }
}

export async function updateNoteFolder(folderId: string, data: {
  name: string;
  color?: string;
  departmentId?: string;
}) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const name = data.name.trim();
    if (!name) return { success: false, error: "Folder name is required" };
    if (name.length > 60) return { success: false, error: "Folder name is too long" };

    await assertFolderOwner(folderId, currentUser.id);
    const folder = await prisma.noteFolder.update({
      where: { id: folderId },
      data: { name, color: data.color?.trim() || null },
    });

    revalidateNotes(normalizeOptionalId(data.departmentId));
    return { success: true, folderId: folder.id };
  } catch (error) {
    console.error("Failed to update note folder:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update folder" };
  }
}

export async function deleteNoteFolder(folderId: string, departmentId?: string) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    await assertFolderOwner(folderId, currentUser.id);
    await prisma.noteFolder.delete({ where: { id: folderId } });

    revalidateNotes(normalizeOptionalId(departmentId));
    return { success: true };
  } catch (error) {
    console.error("Failed to delete note folder:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete folder" };
  }
}

export async function createNote(data: {
  title: string;
  content?: string;
  isPinned?: boolean;
  folderId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  issueId?: string | null;
  taskId?: string | null;
}) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const title = data.title.trim();
    if (!title) return { success: false, error: "Note title is required" };

    const folderId = normalizeOptionalId(data.folderId);
    const departmentId = normalizeOptionalId(data.departmentId);
    let projectId = normalizeOptionalId(data.projectId);
    const issueId = normalizeOptionalId(data.issueId);
    const taskId = normalizeOptionalId(data.taskId);

    await assertFolderOwner(folderId, currentUser.id);
    await assertDepartmentAccess(departmentId, currentUser.id, currentUser.role);
    await assertProjectAccess(projectId, currentUser.id, currentUser.role);
    const issueProjectId = await assertIssueAccess(issueId, projectId, currentUser.id, currentUser.role);
    const task = await assertTaskAccess(taskId, currentUser.id, currentUser.role);

    projectId = projectId || issueProjectId || task?.projectId || null;

    const note = await prisma.note.create({
      data: {
        title,
        content: data.content?.trim() || null,
        isPinned: Boolean(data.isPinned),
        authorId: currentUser.id,
        folderId,
        departmentId,
        projectId,
        issueId,
        taskId,
      },
    });

    revalidateNotes(departmentId);
    return { success: true, noteId: note.id };
  } catch (error) {
    console.error("Failed to create note:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create note" };
  }
}

export async function updateNote(noteId: string, data: {
  title: string;
  content?: string;
  isPinned?: boolean;
  folderId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  issueId?: string | null;
  taskId?: string | null;
}) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const existing = await prisma.note.findFirst({
      where: { id: noteId, authorId: currentUser.id },
      select: { id: true, departmentId: true },
    });
    if (!existing) return { success: false, error: "Note not found" };

    const title = data.title.trim();
    if (!title) return { success: false, error: "Note title is required" };

    const folderId = normalizeOptionalId(data.folderId);
    const departmentId = normalizeOptionalId(data.departmentId);
    let projectId = normalizeOptionalId(data.projectId);
    const issueId = normalizeOptionalId(data.issueId);
    const taskId = normalizeOptionalId(data.taskId);

    await assertFolderOwner(folderId, currentUser.id);
    await assertDepartmentAccess(departmentId, currentUser.id, currentUser.role);
    await assertProjectAccess(projectId, currentUser.id, currentUser.role);
    const issueProjectId = await assertIssueAccess(issueId, projectId, currentUser.id, currentUser.role);
    const task = await assertTaskAccess(taskId, currentUser.id, currentUser.role);

    projectId = projectId || issueProjectId || task?.projectId || null;

    const note = await prisma.note.update({
      where: { id: noteId },
      data: {
        title,
        content: data.content?.trim() || null,
        isPinned: Boolean(data.isPinned),
        folderId,
        departmentId,
        projectId,
        issueId,
        taskId,
      },
    });

    revalidateNotes(existing.departmentId);
    revalidateNotes(departmentId);
    return { success: true, noteId: note.id };
  } catch (error) {
    console.error("Failed to update note:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update note" };
  }
}

export async function deleteNote(noteId: string, departmentId?: string | null) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const note = await prisma.note.findFirst({
      where: { id: noteId, authorId: currentUser.id },
      select: { id: true, departmentId: true },
    });
    if (!note) return { success: false, error: "Note not found" };

    await prisma.note.update({
      where: { id: note.id },
      data: { deletedAt: new Date() },
    });
    revalidateNotes(note.departmentId);
    revalidateNotes(normalizeOptionalId(departmentId));
    return { success: true };
  } catch (error) {
    console.error("Failed to delete note:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete note" };
  }
}

export async function restoreNote(noteId: string, departmentId?: string | null) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const note = await prisma.note.findFirst({
      where: { id: noteId, authorId: currentUser.id },
      select: { id: true, departmentId: true },
    });
    if (!note) return { success: false, error: "Note not found" };

    await prisma.note.update({
      where: { id: note.id },
      data: { deletedAt: null },
    });
    revalidateNotes(note.departmentId);
    revalidateNotes(normalizeOptionalId(departmentId));
    return { success: true };
  } catch (error) {
    console.error("Failed to restore note:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to restore note" };
  }
}

export async function permanentlyDeleteNote(noteId: string, departmentId?: string | null) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    if (!currentUser.id) return { success: false, error: "Unauthorized" };

    const note = await prisma.note.findFirst({
      where: { id: noteId, authorId: currentUser.id },
      select: { id: true, departmentId: true },
    });
    if (!note) return { success: false, error: "Note not found" };

    await prisma.note.delete({ where: { id: note.id } });
    revalidateNotes(note.departmentId);
    revalidateNotes(normalizeOptionalId(departmentId));
    return { success: true };
  } catch (error) {
    console.error("Failed to permanently delete note:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to permanently delete note" };
  }
}
