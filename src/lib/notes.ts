import prisma from "@/lib/prisma";

export type NoteFolderListItem = {
  id: string;
  name: string;
  color: string | null;
  position: number;
};

export type NoteListItem = {
  id: string;
  title: string;
  content: string | null;
  isPinned: boolean;
  folderId: string | null;
  departmentId: string | null;
  projectId: string | null;
  projectKey: string | null;
  projectName: string | null;
  issueId: string | null;
  issueKey: string | null;
  issueTitle: string | null;
  taskId: string | null;
  taskTitle: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NoteTaskOption = {
  id: string;
  title: string;
  projectKey: string | null;
};

export async function getNoteFoldersForUser(userId: string) {
  const folders = await prisma.noteFolder.findMany({
    where: { ownerId: userId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      position: true,
    },
  });

  return folders satisfies NoteFolderListItem[];
}

export async function getNotesForUser(userId: string) {
  const notes = await prisma.note.findMany({
    where: { authorId: userId },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    take: 300,
    select: {
      id: true,
      title: true,
      content: true,
      isPinned: true,
      folderId: true,
      departmentId: true,
      projectId: true,
      issueId: true,
      taskId: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      project: { select: { key: true, name: true } },
      issue: { select: { key: true, title: true } },
      task: { select: { title: true, project: { select: { key: true } } } },
    },
  });

  return notes.map((note) => ({
    id: note.id,
    title: note.title,
    content: note.content,
    isPinned: note.isPinned,
    folderId: note.folderId,
    departmentId: note.departmentId,
    projectId: note.projectId,
    projectKey: note.project?.key || null,
    projectName: note.project?.name || null,
    issueId: note.issueId,
    issueKey: note.issue?.key || null,
    issueTitle: note.issue?.title || null,
    taskId: note.taskId,
    taskTitle: note.task?.title || null,
    deletedAt: note.deletedAt?.toISOString() || null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  })) satisfies NoteListItem[];
}

export async function getNoteTaskOptionsForUser({
  userId,
  departmentId,
  visibleProjectIds,
}: {
  userId: string;
  departmentId: string;
  visibleProjectIds: string[];
}) {
  const tasks = await prisma.reminder.findMany({
    where: {
      itemType: "TODO",
      OR: [
        { creatorId: userId },
        { assigneeId: userId },
        { scopeType: "DEPARTMENT", departmentId },
        visibleProjectIds.length > 0 ? { scopeType: "PROJECT", projectId: { in: visibleProjectIds } } : { id: "__none__" },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      project: { select: { key: true } },
    },
  });

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    projectKey: task.project?.key || null,
  })) satisfies NoteTaskOption[];
}
