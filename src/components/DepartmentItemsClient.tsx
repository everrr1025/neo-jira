"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Folder, List, Pencil, Plus, RotateCcw, Search, Star, StickyNote, Trash2, X } from "lucide-react";

import { addReminderComment, createReminder, deleteReminderTask, setReminderCompleted, updateReminderTask } from "@/app/actions/reminders";
import { createNote, createNoteFolder, deleteNote, deleteNoteFolder, permanentlyDeleteNote, restoreNote, updateNote, updateNoteFolder } from "@/app/actions/notes";
import { DropdownField } from "@/components/DropdownField";
import LocalizedDateInput from "@/components/LocalizedDateInput";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/RichTextEditor";
import type {
  DepartmentReminderIssueOption,
  DepartmentReminderAssigneeOption,
  DepartmentItemCenterItem,
  DepartmentReminderScopeOption,
} from "@/lib/departmentReminders";
import type { Locale } from "@/lib/i18n";
import type { NoteFolderListItem, NoteListItem, NoteTaskOption } from "@/lib/notes";

const TEXT = {
  en: {
    title: "Items",
    tasks: "Tasks",
    schedule: "Schedule",
    notesTab: "Notes",
    list: "List",
    calendar: "Calendar",
    addTask: "New task",
    addNote: "New note",
    allNotes: "All notes",
    pinnedNotes: "Favorites",
    uncategorized: "Uncategorized",
    folders: "Folders",
    newFolder: "New folder",
    renameFolder: "Rename",
    deleteFolder: "Delete folder",
    deleteFolderConfirm: "Delete this folder? Notes in it will move to Uncategorized.",
    folderNamePrompt: "Folder name",
    searchNotes: "Search notes",
    noNotes: "No notes yet.",
    noteFolder: "Folder",
    noFolder: "No folder",
    linkedProject: "Project",
    linkedIssue: "Issue",
    linkedTask: "Task",
    noLinkedProject: "No project",
    noLinkedIssue: "No issue",
    noLinkedTask: "No task",
    pinned: "Favorited",
    pinNote: "Favorite note",
    trash: "Trash",
    restoreNote: "Restore",
    permanentlyDeleteNote: "Delete forever",
    permanentlyDeleteConfirm: "Permanently delete this note? This cannot be undone.",
    untitledNote: "Untitled note",
    selectNotePrompt: "Select a note or create a new one.",
    lastSaved: "Last saved",
    deleteNote: "Delete",
    deleteNoteConfirm: "Delete this note?",
    allTasks: "All tasks",
    createdByMe: "Created by me",
    assignedToMe: "Assigned to me",
    incompleteTasks: "Incomplete",
    dueSoonTasks: "Due soon",
    more: "More",
    less: "Less",
    empty: "No items yet.",
    titleField: "Title",
    notes: "Notes",
    type: "Type",
    note: "Note",
    todo: "Task",
    event: "Event",
    reminder: "Reminder",
    scope: "Scope",
    personal: "Personal",
    department: "Department",
    project: "Project",
    projectLabel: "Project",
    issue: "Linked issue",
    noIssue: "No issue",
    time: "Time",
    dueDate: "Due date",
    noDueDate: "No due date",
    hasTime: "Add time",
    important: "Important",
    assignee: "Assignee",
    unassigned: "Unassigned",
    ongoing: "In progress",
    notStarted: "Not started",
    incomplete: "Incomplete",
    completed: "Done",
    deleteTask: "Delete",
    deleteConfirm: "Delete this task? Replies and related task data will also be removed.",
    reopen: "Reopen",
    edit: "Edit",
    save: "Save",
    replies: "Replies",
    reply: "Reply",
    addReply: "Add reply",
    noReplies: "No replies yet.",
    openedBy: "Opened by",
    priority: "Priority",
    create: "Create",
    cancel: "Cancel",
    done: "Done",
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  },
  zh: {
    title: "事项",
    tasks: "任务",
    schedule: "日程",
    notesTab: "笔记",
    list: "列表",
    calendar: "日历",
    addTask: "新建任务",
    addNote: "新建笔记",
    allNotes: "全部笔记",
    pinnedNotes: "收藏",
    uncategorized: "未分类",
    folders: "文件夹",
    newFolder: "新建文件夹",
    renameFolder: "重命名",
    deleteFolder: "删除文件夹",
    deleteFolderConfirm: "确定删除这个文件夹吗？其中的笔记会移动到未分类。",
    folderNamePrompt: "文件夹名称",
    searchNotes: "搜索笔记",
    noNotes: "暂无笔记。",
    noteFolder: "文件夹",
    noFolder: "无文件夹",
    linkedProject: "项目",
    linkedIssue: "问题",
    linkedTask: "任务",
    noLinkedProject: "不关联项目",
    noLinkedIssue: "不关联问题",
    noLinkedTask: "不关联任务",
    pinned: "已收藏",
    pinNote: "收藏笔记",
    trash: "垃圾箱",
    restoreNote: "恢复",
    permanentlyDeleteNote: "彻底删除",
    permanentlyDeleteConfirm: "彻底删除这条笔记吗？此操作无法撤销。",
    untitledNote: "未命名笔记",
    selectNotePrompt: "选择一条笔记，或新建一条笔记。",
    lastSaved: "最后保存",
    deleteNote: "删除",
    deleteNoteConfirm: "确定删除这条笔记吗？",
    allTasks: "所有任务",
    createdByMe: "我发起的",
    assignedToMe: "我负责的",
    incompleteTasks: "未完成",
    dueSoonTasks: "即将到期",
    more: "更多",
    less: "收起",
    empty: "暂无事项。",
    titleField: "标题",
    notes: "内容",
    type: "类型",
    note: "笔记",
    todo: "任务",
    event: "日程",
    reminder: "提醒",
    scope: "范围",
    personal: "个人",
    department: "部门",
    project: "项目",
    projectLabel: "项目",
    issue: "关联问题",
    noIssue: "不关联问题",
    time: "时间",
    dueDate: "到期时间",
    noDueDate: "无到期时间",
    hasTime: "添加时间",
    important: "重要",
    assignee: "负责人",
    unassigned: "未指派",
    ongoing: "进行中",
    notStarted: "未开始",
    incomplete: "未完成",
    completed: "已完成",
    deleteTask: "删除",
    deleteConfirm: "确定删除这个任务吗？相关回复和任务数据也会一起清理。",
    reopen: "重新打开",
    edit: "编辑",
    save: "保存",
    replies: "回复",
    reply: "回复",
    addReply: "添加回复",
    noReplies: "暂无回复。",
    openedBy: "发起人",
    priority: "优先级",
    create: "创建",
    cancel: "取消",
    done: "完成",
    low: "低",
    medium: "中",
    high: "高",
    urgent: "紧急",
  },
} as const;

function formatDateTimeLocal(date = new Date()) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() - next.getTimezoneOffset());
  return next.toISOString().slice(0, 16);
}

function formatDateTimeLocalFromIso(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function itemTypeLabel(type: string, locale: Locale) {
  const t = TEXT[locale];
  if (type === "TODO") return t.todo;
  if (type === "EVENT") return t.event;
  if (type === "REMINDER") return t.reminder;
  return t.note;
}

function priorityLabel(priority: string, locale: Locale) {
  const t = TEXT[locale];
  if (priority === "LOW") return t.low;
  if (priority === "HIGH") return t.high;
  if (priority === "URGENT") return t.urgent;
  return t.medium;
}

function taskStatusLabel(status: string, locale: Locale) {
  const t = TEXT[locale];
  return status === "DONE" ? t.completed : t.incomplete;
}

function formatDisplayDate(value: string | null, locale: Locale) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US");
}

function dayKey(date: string) {
  return new Date(date).toISOString().slice(0, 10);
}

type TaskFilter = "all" | "created" | "assigned" | "incomplete" | "dueSoon";
type ItemTab = "tasks" | "schedule" | "notes";
type NoteFolderFilter = "all" | "pinned" | "trash" | `folder:${string}`;

function notePreview(content: string | null) {
  if (!content) return "";
  return content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatSavedAgo(value: string, locale: Locale) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (locale === "zh") {
    if (diffMinutes < 1) return "刚刚保存";
    if (diffMinutes < 60) return `保存于${diffMinutes}分钟前`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `保存于${diffHours}小时前`;
    const diffDays = Math.floor(diffHours / 24);
    return `保存于${diffDays}天前`;
  }

  if (diffMinutes < 1) return "Saved just now";
  if (diffMinutes < 60) return `Saved ${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Saved ${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `Saved ${diffDays} d ago`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function composeNoteEditorContent(note: Pick<NoteListItem, "title" | "content"> | null, fallbackTitle: string) {
  const title = note?.title?.trim() || fallbackTitle;
  const body = note?.content?.trim() || "<p></p>";
  return `<h1>${escapeHtml(title)}</h1>${body}`;
}

function splitNoteEditorContent(editorContent: string, fallbackTitle: string) {
  if (typeof document === "undefined") {
    return { title: fallbackTitle, content: editorContent };
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = editorContent || "";
  let titleBlock: Element | null = null;

  for (const child of Array.from(wrapper.children)) {
    const text = child.textContent?.trim() || "";
    if (text) {
      titleBlock = child;
      break;
    }
    child.remove();
  }

  const rawTitle = titleBlock?.textContent?.trim() || "";

  if (titleBlock) {
    titleBlock.remove();
  }

  return {
    title: rawTitle || fallbackTitle,
    content: wrapper.innerHTML.trim(),
  };
}

export default function DepartmentItemsClient({
  departmentId,
  locale,
  items,
  noteFolders,
  notes,
  noteIssueOptions,
  noteTaskOptions,
  noteProjectOptions,
  initialTab = "tasks",
  currentUserId,
  canCreateDepartmentItem,
  projectOptions,
  assigneeOptions,
}: {
  departmentId: string;
  locale: Locale;
  items: DepartmentItemCenterItem[];
  noteFolders: NoteFolderListItem[];
  notes: NoteListItem[];
  noteIssueOptions: DepartmentReminderIssueOption[];
  noteTaskOptions: NoteTaskOption[];
  noteProjectOptions: DepartmentReminderScopeOption[];
  initialTab?: ItemTab;
  currentUserId: string;
  canCreateDepartmentItem: boolean;
  projectOptions: DepartmentReminderScopeOption[];
  assigneeOptions: DepartmentReminderAssigneeOption[];
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const noteEditorRef = useRef<RichTextEditorHandle>(null);
  const [view, setView] = useState<"list" | "calendar">("list");
  const activeTab = initialTab;
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [noteFolderFilter, setNoteFolderFilter] = useState<NoteFolderFilter>("all");
  const [noteQuery, setNoteQuery] = useState("");
  const initialNote = notes.find((note) => !note.deletedAt) || null;
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(initialNote?.id || null);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [noteDropTarget, setNoteDropTarget] = useState<string | null>(null);
  const [noteError, setNoteError] = useState("");
  const [noteForm, setNoteForm] = useState({
    title: initialNote?.title || "",
    content: composeNoteEditorContent(initialNote, TEXT[locale].untitledNote),
    folderId: initialNote?.folderId || "",
    isPinned: Boolean(initialNote?.isPinned),
    projectId: initialNote?.projectId || "",
    issueId: initialNote?.issueId || "",
    taskId: initialNote?.taskId || "",
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateMoreOpen, setIsCreateMoreOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: "",
    content: "",
    itemType: "TODO" as "NOTE" | "TODO" | "EVENT" | "REMINDER",
    hasTime: false,
    startAt: formatDateTimeLocal(),
    dueAt: "",
    isImportant: false,
    priority: "MEDIUM",
    scopeType: "PERSONAL" as "PERSONAL" | "DEPARTMENT" | "PROJECT",
    projectId: projectOptions[0]?.id || "",
    issueId: "",
    assigneeId: currentUserId,
  });
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    dueAt: "",
    scopeType: "PERSONAL" as "PERSONAL" | "DEPARTMENT" | "PROJECT",
    projectId: "",
    assigneeId: currentUserId,
  });

  const taskAssigneeChoices = useMemo(() => {
    const currentUser = assigneeOptions.find((assignee) => assignee.id === currentUserId);
    const choices: Array<{
      value: string;
      label: string;
      scopeType: "PERSONAL" | "DEPARTMENT" | "PROJECT";
      projectId: string;
      assigneeId: string;
    }> = [
      {
        value: `PERSONAL::${currentUserId}`,
        label: currentUser?.name || currentUser?.email || (locale === "zh" ? "我" : "Me"),
        scopeType: "PERSONAL" as const,
        projectId: "",
        assigneeId: currentUserId,
      },
    ];

    if (canCreateDepartmentItem) {
      for (const assignee of assigneeOptions.filter((option) => option.id !== currentUserId)) {
        choices.push({
          value: `DEPARTMENT::${assignee.id}`,
          label: assignee.id === currentUserId ? `${assignee.name} (${locale === "zh" ? "我" : "me"})` : assignee.name,
          scopeType: "DEPARTMENT" as const,
          projectId: "",
          assigneeId: assignee.id,
        });
      }
      return choices;
    }

    for (const project of projectOptions) {
      for (const assignee of assigneeOptions.filter((option) => option.id !== currentUserId && option.projectIds.includes(project.id))) {
        choices.push({
          value: `PROJECT:${project.id}:${assignee.id}`,
          label: `${assignee.name} · ${project.key}`,
          scopeType: "PROJECT" as const,
          projectId: project.id,
          assigneeId: assignee.id,
        });
      }
    }

    return choices;
  }, [assigneeOptions, canCreateDepartmentItem, currentUserId, locale, projectOptions]);
  const taskItems = items.filter((item) => item.itemType === "TODO");
  const filteredTaskItems = taskItems.filter((item) => {
    if (taskFilter === "created") return item.creatorId === currentUserId;
    if (taskFilter === "assigned") return item.assigneeId === currentUserId;
    if (taskFilter === "incomplete") return !item.completedAt;
    if (taskFilter === "dueSoon") {
      if (item.completedAt || !item.dueDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const soon = new Date(today);
      soon.setDate(soon.getDate() + 7);
      const dueDate = new Date(item.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today && dueDate <= soon;
    }
    return true;
  });
  const visibleItems = items.filter((item) => {
    if (activeTab === "tasks") return filteredTaskItems.some((task) => task.id === item.id);
    if (activeTab === "schedule") return item.itemType === "EVENT" || item.itemType === "REMINDER";
    return false;
  });
  const activeNotes = notes.filter((note) => !note.deletedAt);
  const trashedNotes = notes.filter((note) => note.deletedAt);
  const filteredNotes = notes.filter((note) => {
    if (noteFolderFilter === "trash") {
      if (!note.deletedAt) return false;
    } else if (note.deletedAt) {
      return false;
    }
    if (noteFolderFilter === "pinned" && !note.isPinned) return false;
    if (noteFolderFilter.startsWith("folder:") && note.folderId !== noteFolderFilter.slice("folder:".length)) return false;

    const query = noteQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      note.title,
      notePreview(note.content),
      note.projectKey,
      note.projectName,
      note.issueKey,
      note.issueTitle,
      note.taskTitle,
    ].filter(Boolean).some((value) => value!.toLowerCase().includes(query));
  });
  const selectedNote = selectedNoteId ? notes.find((note) => note.id === selectedNoteId) || null : null;
  const selectedTask = selectedTaskId ? items.find((item) => item.id === selectedTaskId) || null : null;
  const calendarItems = visibleItems.filter((item) => item.itemType !== "NOTE");
  const groupedByDay = calendarItems.reduce((acc, item) => {
    const key = dayKey(item.date);
    acc[key] = [...(acc[key] || []), item];
    return acc;
  }, {} as Record<string, DepartmentItemCenterItem[]>);
  const calendarDays = Object.keys(groupedByDay).sort();

  const resetForm = () =>
    setForm({
      title: "",
      content: "",
      itemType: "TODO",
      hasTime: false,
      startAt: formatDateTimeLocal(),
      dueAt: "",
      isImportant: false,
      priority: "MEDIUM",
      scopeType: "PERSONAL",
      projectId: projectOptions[0]?.id || "",
      issueId: "",
      assigneeId: currentUserId,
    });

  const openCreateModal = () => {
    resetForm();
    setError("");
    setIsCreateMoreOpen(false);
    setIsCreateOpen(true);
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await createReminder({
        departmentId,
        title: form.title,
        content: form.content,
        itemType: form.itemType,
        startAt: form.hasTime ? form.startAt : undefined,
        dueAt: form.dueAt || undefined,
        priority: form.priority,
        isImportant: form.isImportant,
        scopeType: form.scopeType,
        projectId: form.scopeType === "PROJECT" ? form.projectId : undefined,
        issueId: form.issueId || undefined,
        assigneeId: form.assigneeId || undefined,
      });

      if (!result.success) {
        setError(result.error || "Failed");
        return;
      }

      setIsCreateOpen(false);
      resetForm();
      router.refresh();
    });
  };

  const handleComplete = (item: DepartmentItemCenterItem) => {
    if (!item.canComplete) return;
    startTransition(async () => {
      const result = await setReminderCompleted(item.id, true);
      if (!result.success) {
        setError(result.error || "Failed");
        return;
      }
      router.refresh();
    });
  };

  const handleReopen = (item: DepartmentItemCenterItem) => {
    if (!item.canComplete) return;
    startTransition(async () => {
      const result = await setReminderCompleted(item.id, false);
      if (!result.success) {
        setError(result.error || "Failed");
        return;
      }
      router.refresh();
    });
  };

  const applyTaskAssigneeChoice = (value: string) => {
    const choice = taskAssigneeChoices.find((option) => option.value === value) || taskAssigneeChoices[0];
    if (!choice) return;
    setForm((current) => ({
      ...current,
      scopeType: choice.scopeType,
      projectId: choice.projectId,
      assigneeId: choice.assigneeId,
      issueId: "",
    }));
  };

  const applyEditAssigneeChoice = (value: string) => {
    const choice = taskAssigneeChoices.find((option) => option.value === value) || taskAssigneeChoices[0];
    if (!choice) return;
    setEditForm((current) => ({
      ...current,
      scopeType: choice.scopeType,
      projectId: choice.projectId,
      assigneeId: choice.assigneeId,
    }));
  };

  const currentTaskAssigneeValue =
    taskAssigneeChoices.find(
      (choice) =>
        choice.scopeType === form.scopeType &&
        choice.assigneeId === form.assigneeId &&
        (choice.scopeType !== "PROJECT" || choice.projectId === form.projectId)
    )?.value || taskAssigneeChoices[0]?.value || "";
  const currentEditAssigneeValue =
    taskAssigneeChoices.find(
      (choice) =>
        choice.scopeType === editForm.scopeType &&
        choice.assigneeId === editForm.assigneeId &&
        (choice.scopeType !== "PROJECT" || choice.projectId === editForm.projectId)
    )?.value || taskAssigneeChoices[0]?.value || "";

  const openTaskDetail = (item: DepartmentItemCenterItem) => {
    setSelectedTaskId(item.id);
    setIsEditingTask(false);
    setDetailError("");
    setReplyContent("");
    setEditForm({
      title: item.title,
      content: item.content || "",
      dueAt: formatDateTimeLocalFromIso(item.dueDate),
      scopeType: item.scopeType === "PROJECT" ? "PROJECT" : item.scopeType === "DEPARTMENT" ? "DEPARTMENT" : "PERSONAL",
      projectId: item.scopeType === "PROJECT" ? taskAssigneeChoices.find((choice) => choice.assigneeId === item.assigneeId && choice.scopeType === "PROJECT")?.projectId || "" : "",
      assigneeId: item.assigneeId || currentUserId,
    });
  };

  const saveTaskEdits = async () => {
    if (!selectedTask) return;
    return updateReminderTask(selectedTask.id, {
      title: editForm.title,
      content: editForm.content,
      dueAt: editForm.dueAt || undefined,
      assigneeId: editForm.assigneeId,
      scopeType: editForm.scopeType,
      projectId: editForm.scopeType === "PROJECT" ? editForm.projectId : undefined,
    });
  };

  const saveTaskReply = async () => {
    if (!selectedTask || !replyContent.trim()) return;
    return addReminderComment(selectedTask.id, replyContent);
  };

  const handleSaveTaskDialog = () => {
    if (!selectedTask) return;
    setDetailError("");
    startTransition(async () => {
      if (isEditingTask) {
        const taskResult = await saveTaskEdits();
        if (!taskResult?.success) {
          setDetailError(taskResult?.error || "Failed");
          return;
        }
      }

      if (replyContent.trim()) {
        const replyResult = await saveTaskReply();
        if (!replyResult?.success) {
          setDetailError(replyResult?.error || "Failed");
          return;
        }
      }

      setIsEditingTask(false);
      setReplyContent("");
      router.refresh();
    });
  };

  const handleDeleteTask = () => {
    if (!selectedTask || !selectedTask.canEdit) return;
    if (!window.confirm(t.deleteConfirm)) return;
    setDetailError("");
    startTransition(async () => {
      const result = await deleteReminderTask(selectedTask.id);
      if (!result.success) {
        setDetailError(result.error || "Failed");
        return;
      }
      setSelectedTaskId(null);
      router.refresh();
    });
  };

  const resetNoteForm = (folderId = "") => {
    setNoteForm({
      title: t.untitledNote,
      content: composeNoteEditorContent({ title: t.untitledNote, content: "" }, t.untitledNote),
      folderId,
      isPinned: false,
      projectId: "",
      issueId: "",
      taskId: "",
    });
  };

  const openCreateNote = () => {
    const currentFolderId = noteFolderFilter.startsWith("folder:") ? noteFolderFilter.slice("folder:".length) : "";
    setNoteError("");
    startTransition(async () => {
      const result = await createNote({
        title: t.untitledNote,
        content: "",
        folderId: currentFolderId || null,
        departmentId,
      });
      if (!result.success) {
        setNoteError(result.error || "Failed");
        return;
      }
      setSelectedNoteId(result.noteId || null);
      if (noteFolderFilter === "trash") setNoteFolderFilter("all");
      resetNoteForm(currentFolderId);
      router.refresh();
    });
  };

  const openEditNote = (note: NoteListItem) => {
    setSelectedNoteId(note.id);
    setNoteForm({
      title: note.title,
      content: composeNoteEditorContent(note, t.untitledNote),
      folderId: note.folderId || "",
      isPinned: note.isPinned,
      projectId: note.projectId || "",
      issueId: note.issueId || "",
      taskId: note.taskId || "",
    });
    setNoteError("");
  };

  const handleDeleteNote = (targetNote = selectedNote) => {
    if (!targetNote) return;
    if (!window.confirm(t.deleteNoteConfirm)) return;
    setNoteError("");
    startTransition(async () => {
      const result = await deleteNote(targetNote.id, departmentId);
      if (!result.success) {
        setNoteError(result.error || "Failed");
        return;
      }
      if (selectedNoteId === targetNote.id) {
        setSelectedNoteId(activeNotes.find((note) => note.id !== targetNote.id)?.id || null);
      }
      router.refresh();
    });
  };

  const handleRestoreNote = (targetNote = selectedNote) => {
    if (!targetNote) return;
    setNoteError("");
    startTransition(async () => {
      const result = await restoreNote(targetNote.id, departmentId);
      if (!result.success) {
        setNoteError(result.error || "Failed");
        return;
      }
      setNoteFolderFilter("all");
      router.refresh();
    });
  };

  const handlePermanentlyDeleteNote = (targetNote = selectedNote) => {
    if (!targetNote) return;
    if (!window.confirm(t.permanentlyDeleteConfirm)) return;
    setNoteError("");
    startTransition(async () => {
      const result = await permanentlyDeleteNote(targetNote.id, departmentId);
      if (!result.success) {
        setNoteError(result.error || "Failed");
        return;
      }
      if (selectedNoteId === targetNote.id) {
        setSelectedNoteId(trashedNotes.find((note) => note.id !== targetNote.id)?.id || null);
      }
      router.refresh();
    });
  };

  const handleCreateFolder = () => {
    const name = window.prompt(t.folderNamePrompt);
    if (!name?.trim()) return;
    setNoteError("");
    startTransition(async () => {
      const result = await createNoteFolder({ name, departmentId });
      if (!result.success) {
        setNoteError(result.error || "Failed");
        return;
      }
      router.refresh();
    });
  };

  const handleRenameFolder = (folder: NoteFolderListItem) => {
    const name = window.prompt(t.folderNamePrompt, folder.name);
    if (!name?.trim()) return;
    setNoteError("");
    startTransition(async () => {
      const result = await updateNoteFolder(folder.id, { name, color: folder.color || undefined, departmentId });
      if (!result.success) {
        setNoteError(result.error || "Failed");
        return;
      }
      router.refresh();
    });
  };

  const handleDeleteFolder = (folder: NoteFolderListItem) => {
    if (!window.confirm(t.deleteFolderConfirm)) return;
    setNoteError("");
    startTransition(async () => {
      const result = await deleteNoteFolder(folder.id, departmentId);
      if (!result.success) {
        setNoteError(result.error || "Failed");
        return;
      }
      if (noteFolderFilter === `folder:${folder.id}`) setNoteFolderFilter("all");
      router.refresh();
    });
  };

  const moveNoteToFolder = (noteId: string, folderId: string | null) => {
    const note = notes.find((item) => item.id === noteId);
    if (!note || note.deletedAt || note.folderId === folderId) return;

    const splitContent = note.id === selectedNote?.id
      ? splitNoteEditorContent(noteForm.content, t.untitledNote)
      : { title: note.title, content: note.content || "" };

    setNoteError("");
    startTransition(async () => {
      const result = await updateNote(note.id, {
        title: splitContent.title,
        content: splitContent.content,
        isPinned: note.isPinned,
        folderId,
        departmentId,
        projectId: note.projectId,
        issueId: note.issueId,
        taskId: note.taskId,
      });

      if (!result.success) {
        setNoteError(result.error || "Failed");
        return;
      }

      if (note.id === selectedNote?.id) {
        setNoteForm((current) => ({ ...current, folderId: folderId || "" }));
      }
      router.refresh();
    });
  };

  const handleNoteDrop = (folderId: string | null) => {
    if (draggedNoteId) {
      moveNoteToFolder(draggedNoteId, folderId);
    }
    setDraggedNoteId(null);
    setNoteDropTarget(null);
  };

  useEffect(() => {
    if (!selectedNote || selectedNote.deletedAt) return;

    const splitContent = splitNoteEditorContent(noteForm.content, t.untitledNote);
    if (!splitContent.title.trim()) return;

    const hasChanges =
      splitContent.title !== selectedNote.title ||
      splitContent.content !== (selectedNote.content || "");

    if (!hasChanges) return;

    const timer = window.setTimeout(() => {
      setNoteError("");
      startTransition(async () => {
        await noteEditorRef.current?.commitPendingUploads();
        const result = await updateNote(selectedNote.id, {
          title: splitContent.title,
          content: splitContent.content,
          isPinned: selectedNote.isPinned,
          folderId: selectedNote.folderId,
          departmentId,
          projectId: selectedNote.projectId,
          issueId: selectedNote.issueId,
          taskId: selectedNote.taskId,
        });

        if (!result.success) {
          setNoteError(result.error || "Failed");
          return;
        }

        router.refresh();
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    departmentId,
    noteForm.content,
    router,
    selectedNote,
    startTransition,
    t.untitledNote,
  ]);

  const taskFilters: Array<{ id: TaskFilter; label: string }> = [
    { id: "all", label: t.allTasks },
    { id: "created", label: t.createdByMe },
    { id: "assigned", label: t.assignedToMe },
    { id: "incomplete", label: t.incompleteTasks },
    { id: "dueSoon", label: t.dueSoonTasks },
  ];

  const renderTaskRow = (item: DepartmentItemCenterItem) => (
    <div key={item.id} className="grid min-h-12 grid-cols-[minmax(0,1fr)_112px_88px_150px] items-center gap-3 border-b border-slate-100 bg-white px-3 py-2 text-sm last:border-b-0">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${item.completedAt ? "bg-emerald-500" : item.isOverdue ? "bg-red-500" : "bg-blue-500"}`} />
          <button
            type="button"
            onClick={() => openTaskDetail(item)}
            className={`truncate text-left font-medium hover:text-blue-700 ${item.completedAt ? "text-slate-400 line-through" : "text-slate-900"}`}
          >
            {item.title}
          </button>
          {item.isImportant ? <Star size={13} className="shrink-0 fill-amber-400 text-amber-400" /> : null}
        </div>
        {item.content ? <p className="mt-0.5 truncate text-xs text-slate-500">{item.content}</p> : null}
      </div>
      <span className={`truncate text-xs ${item.isOverdue ? "font-semibold text-red-600" : "text-slate-500"}`}>
        {item.dueDate ? formatDisplayDate(item.dueDate, locale) : t.noDueDate}
      </span>
      <span className={`text-xs font-medium ${item.completedAt ? "text-emerald-700" : "text-slate-600"}`}>
        {taskStatusLabel(item.taskStatus, locale)}
      </span>
      <span className="truncate text-xs text-slate-500">{item.assigneeName || item.assigneeEmail || t.unassigned}</span>
    </div>
  );

  const renderItem = (item: DepartmentItemCenterItem) => (
    <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {itemTypeLabel(item.itemType, locale)}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {item.scopeLabel}
            </span>
            {item.isImportant ? <Star size={14} className="fill-amber-400 text-amber-400" /> : null}
            {item.itemType === "TODO" ? (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.completedAt ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                {item.completedAt ? t.completed : t.ongoing}
              </span>
            ) : item.completedAt ? (
              <span className="text-xs font-medium text-emerald-600">{t.done}</span>
            ) : null}
          </div>
          {item.link ? (
            <Link href={item.link} className="mt-2 block break-words font-semibold text-slate-900 hover:text-blue-700">
              {item.issueKey ? `${item.issueKey} ${item.title}` : item.title}
            </Link>
          ) : (
            <h3 className="mt-2 break-words font-semibold text-slate-900">{item.title}</h3>
          )}
          {item.content ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.content}</p> : null}
          <p className="mt-3 text-xs text-slate-400">
            {item.itemType === "NOTE" ? new Date(item.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US") : new Date(item.date).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
            {item.projectKey ? ` · ${item.projectKey}` : ""}
            {item.assigneeName || item.assigneeEmail ? ` · ${t.assignee}: ${item.assigneeName || item.assigneeEmail}` : ""}
            {` · ${priorityLabel(item.priority, locale)}`}
          </p>
        </div>
        {item.canComplete && !item.completedAt ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleComplete(item)}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            <Check size={13} />
            {t.done}
          </button>
        ) : item.canComplete && item.completedAt && item.itemType === "TODO" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleReopen(item)}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RotateCcw size={13} />
            {t.reopen}
          </button>
        ) : null}
      </div>
    </div>
  );

  const renderNotesView = () => {
    const folderButtonClass = (active: boolean, dropTargetId?: string) =>
      `flex h-10 w-full items-center justify-between gap-2 border-l-4 px-3 text-sm transition-colors ${
        active
          ? "border-blue-600 bg-blue-50/70 font-medium text-blue-700"
          : "border-transparent text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
      } ${dropTargetId && noteDropTarget === dropTargetId ? "ring-2 ring-blue-300 ring-inset" : ""}`;

    const noteButtonClass = (note: NoteListItem) =>
      `block min-w-0 flex-1 truncate rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
        selectedNoteId === note.id ? "bg-blue-50 font-medium text-blue-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`;
    const renderNoteName = (note: NoteListItem) => (
      <div
        key={note.id}
        draggable={!note.deletedAt}
        onDragStart={(event) => {
          if (note.deletedAt) return;
          setDraggedNoteId(note.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", note.id);
        }}
        onDragEnd={() => {
          setDraggedNoteId(null);
          setNoteDropTarget(null);
        }}
        className={`group/note flex items-center gap-1 ${note.deletedAt ? "" : "cursor-grab active:cursor-grabbing"} ${draggedNoteId === note.id ? "opacity-50" : ""}`}
      >
        <button type="button" onClick={() => openEditNote(note)} className={noteButtonClass(note)}>
          {note.title}
        </button>
        {note.deletedAt ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={(event) => {
                event.stopPropagation();
                handleRestoreNote(note);
              }}
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 group-hover/note:flex"
              title={t.restoreNote}
            >
              <RotateCcw size={13} />
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={(event) => {
                event.stopPropagation();
                handlePermanentlyDeleteNote(note);
              }}
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover/note:flex"
              title={t.permanentlyDeleteNote}
            >
              <Trash2 size={13} />
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={(event) => {
              event.stopPropagation();
              handleDeleteNote(note);
            }}
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover/note:flex"
            title={t.deleteNote}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    );

    const folderCounts = activeNotes.reduce((acc, note) => {
      const key = note.folderId || "uncategorized";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const uncategorizedNotes = filteredNotes.filter((note) => !note.folderId);
    const selectedIsDeleted = Boolean(selectedNote?.deletedAt);
    const folderNameById = new Map(noteFolders.map((folder) => [folder.id, folder.name]));

    return (
      <div className="min-h-[calc(100vh-220px)] overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-slate-50">
          <div className="p-4">
            <button
              type="button"
              onClick={openCreateNote}
              disabled={isPending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus size={17} />
              {t.addNote}
            </button>
          </div>
          <div className="space-y-1 px-3">
            <button
              type="button"
              onClick={() => setNoteFolderFilter("all")}
              onDragOver={(event) => {
                if (!draggedNoteId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setNoteDropTarget("all");
              }}
              onDragLeave={() => setNoteDropTarget((current) => current === "all" ? null : current)}
              onDrop={(event) => {
                event.preventDefault();
                handleNoteDrop(null);
              }}
              className={folderButtonClass(noteFolderFilter === "all", "all")}
            >
              <span className="inline-flex min-w-0 items-center gap-2"><StickyNote size={15} />{t.allNotes}</span>
              <span>{activeNotes.length}</span>
            </button>
            <button type="button" onClick={() => setNoteFolderFilter("pinned")} className={folderButtonClass(noteFolderFilter === "pinned")}>
              <span className="inline-flex min-w-0 items-center gap-2"><Star size={15} />{t.pinnedNotes}</span>
              <span>{activeNotes.filter((note) => note.isPinned).length}</span>
            </button>
            <button type="button" onClick={() => setNoteFolderFilter("trash")} className={folderButtonClass(noteFolderFilter === "trash")}>
              <span className="inline-flex min-w-0 items-center gap-2"><Trash2 size={15} />{t.trash}</span>
              <span>{trashedNotes.length}</span>
            </button>
          </div>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto border-t border-slate-200 px-3 py-4">
            <div className="space-y-1">
              {noteFolderFilter !== "trash" ? (
                <>
                  <div className="mb-2 flex items-center justify-between px-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.folders}</p>
                    <button type="button" onClick={handleCreateFolder} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-900" title={t.newFolder}>
                      <Plus size={14} />
                    </button>
                  </div>
                  {noteFolderFilter === "all" || noteFolderFilter === "pinned" ? (
                    <div className="mb-2 ml-4 space-y-1">
                      {uncategorizedNotes.map((note) => (
                        renderNoteName(note)
                      ))}
                    </div>
                  ) : null}
                  {noteFolders.map((folder) => (
                    <div key={folder.id} className="group">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setNoteFolderFilter(`folder:${folder.id}`)}
                          onDragOver={(event) => {
                            if (!draggedNoteId) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                            setNoteDropTarget(folder.id);
                          }}
                          onDragLeave={() => setNoteDropTarget((current) => current === folder.id ? null : current)}
                          onDrop={(event) => {
                            event.preventDefault();
                            handleNoteDrop(folder.id);
                          }}
                          className={folderButtonClass(noteFolderFilter === `folder:${folder.id}`, folder.id)}
                        >
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <Folder size={15} />
                            <span className="truncate">{folder.name}</span>
                          </span>
                          <span>{folderCounts[folder.id] || 0}</span>
                        </button>
                        <button type="button" onClick={() => handleRenameFolder(folder)} className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 group-hover:flex" title={t.renameFolder}>
                          <Pencil size={13} />
                        </button>
                        <button type="button" onClick={() => handleDeleteFolder(folder)} className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover:flex" title={t.deleteFolder}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="ml-4 mt-1 space-y-1">
                        {filteredNotes.filter((note) => note.folderId === folder.id).map((note) => (
                          renderNoteName(note)
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="space-y-1">
                  {filteredNotes.map((note) => (
                    <div key={note.id}>
                      {renderNoteName(note)}
                      {note.folderId ? (
                        <div className="ml-3 mt-0.5 truncate text-[11px] text-slate-400">
                          {folderNameById.get(note.folderId) || t.noFolder}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col bg-white">
          {noteError ? <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">{noteError}</div> : null}
          {selectedNote ? (
            <div className="min-h-0 flex-1 overflow-hidden p-0">
                <RichTextEditor
                  key={selectedNote.id}
                  ref={noteEditorRef}
                  value={noteForm.content}
                  onChange={(value) => setNoteForm((current) => ({ ...current, content: value }))}
                  readOnly={selectedIsDeleted}
                  height={560}
                  borderless
                  toolbarRight={<span className="text-sm italic text-slate-400">{formatSavedAgo(selectedNote.updatedAt, locale)}</span>}
                />
            </div>
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center p-8 text-sm text-slate-500">
              {filteredNotes.length === 0 ? t.noNotes : t.selectNotePrompt}
            </div>
          )}
        </section>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">
            {activeTab === "tasks" ? t.tasks : activeTab === "schedule" ? t.schedule : t.notesTab}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "notes" ? (
            <div className="relative w-72 max-w-[50vw]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={noteQuery}
                onChange={(event) => setNoteQuery(event.target.value)}
                placeholder={t.searchNotes}
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none focus:border-blue-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          ) : null}
          {activeTab === "schedule" ? <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`inline-flex h-8 items-center gap-2 rounded px-3 text-sm ${view === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <List size={14} />
              {t.list}
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`inline-flex h-8 items-center gap-2 rounded px-3 text-sm ${view === "calendar" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <CalendarDays size={14} />
              {t.calendar}
            </button>
          </div> : null}
          {activeTab === "tasks" ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              {t.addTask}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}

      {activeTab === "tasks" ? (
        <div className="flex flex-wrap gap-2">
          {taskFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setTaskFilter(filter.id)}
              className={`h-8 rounded-md border px-3 text-sm font-medium ${
                taskFilter === filter.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === "notes" ? (
        renderNotesView()
      ) : view === "list" ? (
        activeTab === "tasks" ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {visibleItems.length === 0 ? <p className="p-3 text-sm text-slate-500">{t.empty}</p> : visibleItems.map(renderTaskRow)}
          </div>
        ) : (
          <div className="space-y-3">{visibleItems.length === 0 ? <p className="text-sm text-slate-500">{t.empty}</p> : visibleItems.map(renderItem)}</div>
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {calendarDays.length === 0 ? (
            <p className="text-sm text-slate-500">{t.empty}</p>
          ) : (
            calendarDays.map((day) => (
              <div key={day} className="rounded-2xl border bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-500">
                  {new Date(`${day}T00:00:00`).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </h3>
                <div className="space-y-2">{groupedByDay[day].map(renderItem)}</div>
              </div>
            ))
          )}
        </div>
      )}

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{t.addTask}</h3>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t.titleField}</label>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t.notes}</label>
                <textarea
                  value={form.content}
                  onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                  rows={6}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsCreateMoreOpen((current) => !current)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {isCreateMoreOpen ? t.less : t.more}
              </button>
              {isCreateMoreOpen ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">{t.dueDate}</label>
                    <LocalizedDateInput
                      locale={locale}
                      value={form.dueAt}
                      onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  <DropdownField
                    id="taskAssignee"
                    label={t.assignee}
                    value={currentTaskAssigneeValue}
                    onChange={applyTaskAssigneeChoice}
                    options={taskAssigneeChoices.map((choice) => ({ value: choice.value, label: choice.label }))}
                    className="flex-1"
                  />
                </div>
              ) : null}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
                  {t.cancel}
                </button>
                <button type="submit" disabled={isPending} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {t.create}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-slate-900">{selectedTask.title}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {t.openedBy}: {selectedTask.creatorName || selectedTask.creatorEmail || "-"} · {t.assignee}: {selectedTask.assigneeName || selectedTask.assigneeEmail || t.unassigned}
                  {selectedTask.dueDate ? ` · ${t.dueDate}: ${formatDisplayDate(selectedTask.dueDate, locale)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedTask.canEdit ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingTask((current) => !current)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {isEditingTask ? t.less : t.edit}
                  </button>
                ) : null}
                <button type="button" onClick={() => setSelectedTaskId(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {detailError ? <div className="mb-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">{detailError}</div> : null}

            {selectedTask.canEdit && isEditingTask ? (
              <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t.titleField}</label>
                  <input
                    value={editForm.title}
                    onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t.notes}</label>
                  <textarea
                    value={editForm.content}
                    onChange={(event) => setEditForm((current) => ({ ...current, content: event.target.value }))}
                    rows={6}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DropdownField
                    id="editTaskAssignee"
                    label={t.assignee}
                    value={currentEditAssigneeValue}
                    onChange={applyEditAssigneeChoice}
                    options={taskAssigneeChoices.map((choice) => ({ value: choice.value, label: choice.label }))}
                    className="flex-1"
                  />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">{t.dueDate}</label>
                    <LocalizedDateInput
                      locale={locale}
                      value={editForm.dueAt}
                      onChange={(event) => setEditForm((current) => ({ ...current, dueAt: event.target.value }))}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedTask.content || "-"}</p>
              </div>
            )}

            <div className="mt-5">
              <div className="space-y-2">
                {selectedTask.comments.length === 0 ? (
                  <p className="text-sm text-slate-500">{t.noReplies}</p>
                ) : (
                  selectedTask.comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{comment.authorName || comment.authorEmail}</span>
                        <span>{new Date(comment.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
              {selectedTask.canComment ? (
                <div className="mt-4 space-y-2">
                  <textarea
                    value={replyContent}
                    onChange={(event) => setReplyContent(event.target.value)}
                    placeholder={t.reply}
                    rows={5}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              ) : null}
            </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                {selectedTask.completedAt ? (
                  <button
                    type="button"
                    disabled={isPending || !selectedTask.canComplete}
                    onClick={() => handleReopen(selectedTask)}
                    className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    {t.reopen}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isPending || !selectedTask.canComplete}
                    onClick={() => handleComplete(selectedTask)}
                    className="inline-flex h-9 items-center gap-1 rounded-md border border-emerald-200 bg-white px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <Check size={14} />
                    {t.done}
                  </button>
                )}
                {selectedTask.canEdit ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleDeleteTask}
                    className="inline-flex h-9 items-center gap-1 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {t.deleteTask}
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(null)}
                  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  disabled={isPending || (isEditingTask && !editForm.title.trim()) || (!isEditingTask && !replyContent.trim())}
                  onClick={handleSaveTaskDialog}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
