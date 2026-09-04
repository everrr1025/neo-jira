"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  ListFilter,
  Loader2,
  MapPin,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Star,
  StickyNote,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";

import { addReminderComment, createReminder, deleteReminderItem, deleteReminderTask, setReminderCompleted, updateMeetingAttendance, updateReminderItem, updateReminderTask } from "@/app/actions/reminders";
import { createNote, createNoteFolder, deleteNote, deleteNoteFolder, emptyNoteTrash, permanentlyDeleteNote, restoreNote, updateNote, updateNoteFolder } from "@/app/actions/notes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DropdownField } from "@/components/DropdownField";
import LocalizedDateInput from "@/components/LocalizedDateInput";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/RichTextEditor";
import ShadcnDatePicker from "@/components/ShadcnDatePicker";
import type {
  DepartmentReminderIssueOption,
  DepartmentReminderAssigneeOption,
  DepartmentItemCenterItem,
  DepartmentReminderScopeOption,
} from "@/lib/departmentReminders";
import { getTranslations, getIssueTypeLabel } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getListActionColumnWidth, LIST_ACTION_BUTTON_GAP, LIST_ACTION_COLUMN_PADDING_X } from "@/lib/listColumnSizing";
import type { NoteFolderListItem, NoteListItem, NoteTaskOption } from "@/lib/notes";
import { getWorkflowStatusName } from "@/lib/workflows";
import { formatFullDateTime, formatListDate, formatListDateTime, formatRelativeTime } from "@/lib/timeFormat";
import { getProjectPath } from "@/lib/projectRoutes";

const TEXT = {
  en: {
    title: "Items",
    tasks: "Tasks",
    schedule: "Schedule",
    notesTab: "Notes",
    list: "List",
    calendar: "Calendar",
    addTask: "New task",
    searchTasks: "Search tasks...",
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
    unpinNote: "Remove from favorites",
    clearSearch: "Clear search",
    pendingSave: "Unsaved changes",
    savingNote: "Saving...",
    saveFailed: "Save failed",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    trash: "Trash",
    emptyTrash: "Empty trash",
    emptyTrashConfirm: "Permanently delete all notes in trash? This cannot be undone.",
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
    noContent: "No content",
    addReply: "Add reply",
    noReplies: "No replies yet.",
    openedBy: "Opened by",
    priority: "Priority",
    status: "Status",
    actions: "Actions",
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
    searchTasks: "搜索任务...",
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
    unpinNote: "取消收藏",
    clearSearch: "清除搜索",
    pendingSave: "有未保存更改",
    savingNote: "保存中...",
    saveFailed: "保存失败",
    fullscreen: "全屏编辑",
    exitFullscreen: "退出全屏",
    trash: "垃圾箱",
    emptyTrash: "清空全部",
    emptyTrashConfirm: "彻底删除垃圾箱中的全部笔记吗？此操作无法撤销。",
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
    noContent: "无内容",
    addReply: "添加回复",
    noReplies: "暂无回复。",
    openedBy: "发起人",
    priority: "优先级",
    status: "状态",
    actions: "操作",
    create: "创建",
    cancel: "取消",
    done: "完成",
    low: "低",
    medium: "中",
    high: "高",
    urgent: "紧急",
  },
} as const;

const SCHEDULE_TEXT = {
  en: {
    title: "Schedule",
    month: "Month",
    week: "Week",
    eventTypes: "Event types",
    meetings: "Meetings",
    outOfOffice: "Out-of-office",
    reminders: "Reminders",
    memos: "Memos",
    search: "Search schedule...",
    today: "Today",
    create: "Create",
    quickCreate: "Quick create",
    addSchedule: "Create meeting",
    date: "Date",
    startTime: "Start time",
    endTime: "End time",
    noTime: "All day",
    visibility: "Visible",
    personal: "Personal",
    department: "Department",
    details: "Details",
    openTask: "Open task",
    linkedTask: "Linked task",
    location: "Location",
    participants: "Participants",
    reminderRule: "Reminder",
    meetingMinutes: "Notes",
    addMeetingTitle: "Add meeting title",
    addGuest: "Add guest...",
    agendaPlaceholder: "Add notes...",
    createMeeting: "Create Meeting",
    deleteSchedule: "Delete",
    deleteScheduleConfirm: "Delete this schedule item?",
    deleteMeetingConfirm: "Delete this meeting? Invited participants will no longer see it in the department calendar.",
    attendance: "Attendance",
    attendanceSummary: "Confirmed",
    confirmAttendance: "Confirm",
    declineAttendance: "Decline",
    tentativeAttendance: "Tentative",
    pendingAttendance: "Pending",
    confirmedAttendance: "Confirmed",
    declinedAttendance: "Declined",
    attendanceUpdated: "Response saved",
    allSchedule: "All schedule",
    myMeetings: "My meetings",
    pendingMeetings: "Pending",
    meetingCommentPlaceholder: "Please leave a message",
    sendMessage: "Send",
    visibleSummary: "Visible",
    todaySummary: "Today",
    meeting: "Meeting",
    out: "Out-of-office",
    memo: "Memo",
    privateMemo: "Private",
    publicMemo: "Public",
    memoContent: "Memo",
    none: "None",
    reminder15: "15 mins before",
    reminder30: "30 mins before",
    reminder60: "1 hour before",
    reminderDay: "1 day before",
    moreItems: "more",
    noEvents: "No schedule items",
  },
  zh: {
    title: "日程",
    month: "月",
    week: "周",
    eventTypes: "事项类型",
    meetings: "会议",
    outOfOffice: "外出",
    reminders: "提醒",
    memos: "备忘",
    search: "搜索日程...",
    today: "今天",
    create: "创建",
    quickCreate: "快速创建",
    addSchedule: "创建会议",
    date: "日期",
    startTime: "开始时间",
    endTime: "结束时间",
    noTime: "全天",
    visibility: "可见",
    personal: "个人",
    department: "部门",
    details: "详情",
    openTask: "打开任务",
    linkedTask: "关联任务",
    location: "地点",
    participants: "参与人员",
    reminderRule: "提醒",
    meetingMinutes: "备注",
    addMeetingTitle: "添加会议标题",
    addGuest: "添加参会人...",
    agendaPlaceholder: "填写备注...",
    createMeeting: "创建会议",
    deleteSchedule: "删除",
    deleteScheduleConfirm: "确定删除这个日程吗？",
    deleteMeetingConfirm: "确定删除这个会议吗？已邀请的参会者将不再在部门日历中看到它。",
    attendance: "参会确认",
    attendanceSummary: "已确认",
    confirmAttendance: "确认参加",
    declineAttendance: "无法参加",
    tentativeAttendance: "暂不确定",
    pendingAttendance: "待确认",
    confirmedAttendance: "已确认",
    declinedAttendance: "无法参加",
    attendanceUpdated: "已保存确认状态",
    allSchedule: "全部日程",
    myMeetings: "我的会议",
    pendingMeetings: "待确认",
    meetingCommentPlaceholder: "请留言",
    sendMessage: "发送",
    visibleSummary: "当前显示",
    todaySummary: "今天",
    meeting: "会议",
    out: "外出",
    memo: "备忘",
    privateMemo: "私有",
    publicMemo: "公开",
    memoContent: "备注",
    none: "无",
    reminder15: "提前 15 分钟",
    reminder30: "提前 30 分钟",
    reminder60: "提前 1 小时",
    reminderDay: "提前 1 天",
    moreItems: "更多",
    noEvents: "暂无日程",
  },
} as const;

type StoredTaskListFilters = {
  taskQuery?: string;
  taskDueDateFilter?: TaskDueDateFilter;
  taskDueDateValue?: string;
  taskCreatorIds?: string[];
  taskStatuses?: string[];
  taskAssigneeIds?: string[];
  taskSortField?: TaskSortField;
  taskSortDirection?: TaskSortDirection;
  taskPageSize?: number;
  taskVisibleColumnIds?: TaskColumnId[];
  taskColumnWidths?: Partial<Record<TaskColumnId, number>>;
};

type TaskAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
};

const TASK_ATTACHMENT_MARKER_PATTERN = /<!--neo-task-attachments:([\s\S]*?)-->/g;

function readStoredTaskListFilters(storageKey: string): StoredTaskListFilters {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredTaskListFilters;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseTaskAttachmentsFromContent(content?: string | null): TaskAttachment[] {
  if (!content) return [];

  const attachments: TaskAttachment[] = [];
  for (const match of content.matchAll(TASK_ATTACHMENT_MARKER_PATTERN)) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1])) as TaskAttachment[];
      if (Array.isArray(parsed)) {
        attachments.push(
          ...parsed.filter(
            (attachment) =>
              attachment &&
              typeof attachment.id === "string" &&
              typeof attachment.fileName === "string" &&
              typeof attachment.fileUrl === "string" &&
              (attachment.fileSize === undefined || typeof attachment.fileSize === "number")
          )
        );
      }
    } catch {
      // Ignore malformed legacy markers.
    }
  }

  return attachments;
}

function stripTaskAttachmentsFromContent(content?: string | null) {
  return (content || "").replace(TASK_ATTACHMENT_MARKER_PATTERN, "").trim();
}

function appendTaskAttachmentsToContent(content: string, attachments: TaskAttachment[]) {
  if (attachments.length === 0) return content;
  return `${content || ""}<!--neo-task-attachments:${encodeURIComponent(JSON.stringify(attachments))}-->`;
}

function formatAttachmentSize(fileSize?: number) {
  if (!Number.isFinite(fileSize) || !fileSize || fileSize <= 0) return "";
  if (fileSize < 1024) return `${fileSize} B`;
  if (fileSize < 1024 * 1024) return `${(fileSize / 1024).toFixed(1)} KB`;
  return `${(fileSize / 1024 / 1024).toFixed(1)} MB`;
}

function getTaskAttachmentIcon(fileName: string) {
  if (/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i.test(fileName)) {
    return <FileImage size={14} className="shrink-0 text-blue-500" />;
  }
  if (/\.(xls|xlsx|csv)$/i.test(fileName)) {
    return <FileSpreadsheet size={14} className="shrink-0 text-emerald-600" />;
  }
  if (/\.(zip|rar|7z|tar|gz)$/i.test(fileName)) {
    return <FileArchive size={14} className="shrink-0 text-amber-600" />;
  }
  if (/\.(pdf)$/i.test(fileName)) {
    return <FileText size={14} className="shrink-0 text-red-500" />;
  }
  if (/\.(doc|docx|txt|md)$/i.test(fileName)) {
    return <FileText size={14} className="shrink-0 text-sky-600" />;
  }
  return <Paperclip size={14} className="shrink-0 text-slate-400" />;
}

function getAttachmentDownloadName(fileName: string) {
  return /\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i.test(fileName) ? undefined : fileName;
}

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

function formatTimeLocalFromIso(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
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
  if (status === "DONE") return t.completed;
  if (status === "NOT_STARTED") return t.notStarted;
  return t.ongoing;
}

function formatDisplayDate(value: string | null) {
  if (!value) return "";
  return formatListDate(value);
}

function dayKey(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-${day}`;
}

function composeDateTime(date: Date, hour = 9, minute = 0) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return formatDateTimeLocal(next);
}

function combineDateAndTime(dateValue: string, timeValue: string) {
  return `${dateValue || format(new Date(), "yyyy-MM-dd")}T${timeValue || "09:00"}`;
}

function timeToMinutes(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function isTimeInScheduleRange(startTime: string, endTime: string) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const latestStartMinutes = 21 * 60 + 45;
  const latestEndMinutes = 22 * 60;
  return (
    startMinutes >= WEEK_START_HOUR * 60 &&
    startMinutes <= latestStartMinutes &&
    endMinutes <= latestEndMinutes &&
    endMinutes > startMinutes &&
    startMinutes % 15 === 0 &&
    endMinutes % 15 === 0
  );
}

function getScheduleType(item: DepartmentItemCenterItem): ScheduleType {
  if (item.kind === "ISSUE_DUE" || item.itemType === "TODO") return "reminder";
  if (item.itemType === "REMINDER") return "memo";
  if (item.scopeType === "DEPARTMENT" && /外出|出差|请假|调研|out|travel|leave/i.test(`${item.title} ${item.content || ""}`)) {
    return "out";
  }
  return "meeting";
}

function scheduleTypeLabel(type: ScheduleType, locale: Locale) {
  const st = SCHEDULE_TEXT[locale];
  if (type === "meeting") return st.meetings;
  if (type === "out") return st.outOfOffice;
  if (type === "reminder") return st.reminders;
  return st.memos;
}

function scheduleChipClass(type: ScheduleType) {
  if (type === "reminder") return "border-l-destructive bg-destructive/10 text-destructive";
  if (type === "out") return "border-l-muted-foreground bg-muted text-muted-foreground";
  if (type === "memo") return "border-l-amber-500 bg-amber-50 text-amber-800";
  return "border-l-primary bg-primary/10 text-primary";
}

function scheduleDotClass(type: ScheduleType) {
  if (type === "reminder") return "bg-destructive";
  if (type === "out") return "bg-muted-foreground";
  if (type === "memo") return "bg-amber-500";
  return "bg-primary";
}

function scheduleBadgeClass(type: ScheduleType) {
  if (type === "reminder") return "border-destructive/20 bg-destructive/10 text-destructive";
  if (type === "out") return "border-border bg-muted text-muted-foreground";
  if (type === "memo") return "border border-amber-200 bg-amber-50 text-amber-800";
  return "border-primary/20 bg-primary/10 text-primary";
}

function attendanceStatusLabel(status: string, locale: Locale) {
  const st = SCHEDULE_TEXT[locale];
  if (status === "CONFIRMED") return st.confirmedAttendance;
  if (status === "DECLINED") return st.declinedAttendance;
  if (status === "TENTATIVE") return st.tentativeAttendance;
  return st.pendingAttendance;
}

function attendanceStatusClass(status: string) {
  if (status === "CONFIRMED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "DECLINED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "TENTATIVE") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function scheduleTimeLabel(item: DepartmentItemCenterItem, locale: Locale, includeEnd = false) {
  const date = new Date(item.date);
  if (Number.isNaN(date.getTime())) return "";
  const hasSpecificTime = hasTimedSchedulePlacement(item);
  if (isAllDayScheduleItem(item) || !hasSpecificTime || item.kind === "ISSUE_DUE") {
    return item.kind === "ISSUE_DUE" ? (locale === "zh" ? "截止" : "Due") : "";
  }
  const start = date.toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (!includeEnd || !item.endDate) return start;
  const end = new Date(item.endDate);
  if (Number.isNaN(end.getTime())) return start;
  return `${start}-${end.toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

function hasTimedSchedulePlacement(item: DepartmentItemCenterItem) {
  if (item.kind === "ISSUE_DUE" || item.itemType === "TODO") return false;
  const start = new Date(item.date);
  if (Number.isNaN(start.getTime())) return false;
  return start.getHours() !== 0 || start.getMinutes() !== 0;
}

function isAllDayScheduleItem(item: DepartmentItemCenterItem) {
  if (item.kind === "ISSUE_DUE" || item.itemType === "TODO") return true;
  const start = new Date(item.date);
  if (Number.isNaN(start.getTime())) return true;
  if (item.itemType === "REMINDER") {
    const end = item.endDate ? new Date(item.endDate) : null;
    return Boolean(
      end &&
      !Number.isNaN(end.getTime()) &&
      start.getHours() === WEEK_START_HOUR &&
      start.getMinutes() === 0 &&
      end.getHours() === WEEK_END_HOUR &&
      end.getMinutes() === 0
    );
  }
  return start.getHours() === 0 && start.getMinutes() === 0;
}

function getWeekTimedLayout(item: DepartmentItemCenterItem) {
  if (isAllDayScheduleItem(item)) return null;
  const start = new Date(item.date);
  const rawEnd = item.endDate ? new Date(item.endDate) : null;
  if (Number.isNaN(start.getTime())) return null;

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = rawEnd && !Number.isNaN(rawEnd.getTime())
    ? rawEnd.getHours() * 60 + rawEnd.getMinutes()
    : startMinutes + 60;
  const minMinutes = WEEK_START_HOUR * 60;
  const maxMinutes = WEEK_END_HOUR * 60;
  const safeEndMinutes = endMinutes > startMinutes ? endMinutes : startMinutes + 60;

  if (safeEndMinutes <= minMinutes || startMinutes >= maxMinutes) return null;

  const visibleStart = Math.max(startMinutes, minMinutes);
  const visibleEnd = Math.min(safeEndMinutes, maxMinutes);
  return {
    top: ((visibleStart - minMinutes) / 60) * WEEK_HOUR_HEIGHT,
    height: Math.max(28, ((visibleEnd - visibleStart) / 60) * WEEK_HOUR_HEIGHT),
  };
}

function getWeekTimedBounds(item: DepartmentItemCenterItem) {
  if (isAllDayScheduleItem(item)) return null;
  const start = new Date(item.date);
  const rawEnd = item.endDate ? new Date(item.endDate) : null;
  if (Number.isNaN(start.getTime())) return null;

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = rawEnd && !Number.isNaN(rawEnd.getTime())
    ? rawEnd.getHours() * 60 + rawEnd.getMinutes()
    : startMinutes + 60;
  const safeEndMinutes = endMinutes > startMinutes ? endMinutes : startMinutes + 60;

  return { startMinutes, endMinutes: safeEndMinutes };
}

function getWeekTimedRenderItems(items: DepartmentItemCenterItem[]) {
  const sortedItems = items
    .map((item) => {
      const layout = getWeekTimedLayout(item);
      const bounds = getWeekTimedBounds(item);
      if (!layout || !bounds) return null;
      return { item, layout, ...bounds };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  const renderItems: Array<(typeof sortedItems)[number] & { laneIndex: number; laneCount: number }> = [];
  let cluster: typeof sortedItems = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;

    const laneEnds: number[] = [];
    const clusterRenderItems = cluster.map((entry) => {
      const reusableLane = laneEnds.findIndex((endMinutes) => endMinutes <= entry.startMinutes);
      const laneIndex = reusableLane === -1 ? laneEnds.length : reusableLane;
      laneEnds[laneIndex] = entry.endMinutes;
      return { ...entry, laneIndex, laneCount: 1 };
    });
    const laneCount = Math.max(1, laneEnds.length);
    renderItems.push(...clusterRenderItems.map((entry) => ({ ...entry, laneCount })));
  };

  sortedItems.forEach((entry) => {
    if (cluster.length > 0 && entry.startMinutes >= clusterEnd) {
      flushCluster();
      cluster = [];
      clusterEnd = -Infinity;
    }
    cluster.push(entry);
    clusterEnd = Math.max(clusterEnd, entry.endMinutes);
  });
  flushCluster();

  return renderItems;
}

function scheduleDateLabel(item: DepartmentItemCenterItem, locale: Locale) {
  const start = new Date(item.date);
  if (Number.isNaN(start.getTime())) return "";
  return start.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function attendeeAvatarSrc(id: string) {
  let sum = 0;
  for (const char of id) sum += char.charCodeAt(0);
  return `/avatars/${String((sum % 36) + 1).padStart(2, "0")}.png`;
}

function parseScheduleDetails(content: string | null) {
  const lines = (content || "").split(/\r?\n/).map((line) => line.trim());
  let location = "";
  const participantNames: string[] = [];
  const noteLines: string[] = [];

  for (const line of lines) {
    if (!line) {
      if (noteLines.length > 0) noteLines.push("");
      continue;
    }

    const locationMatch = line.match(/^(?:地点|Location):\s*(.+)$/i);
    if (locationMatch) {
      location = locationMatch[1].trim();
      continue;
    }

    const participantsMatch = line.match(/^(?:参与人员|Participants):\s*(.+)$/i);
    if (participantsMatch) {
      participantNames.push(
        ...participantsMatch[1]
          .split(/[,，]/)
          .map((name) => name.trim())
          .filter(Boolean)
      );
      continue;
    }

    if (/^(?:类型|Type):/i.test(line)) continue;
    noteLines.push(line);
  }

  return {
    location,
    participantNames,
    notes: noteLines.join("\n").trim(),
  };
}

const WEEK_START_HOUR = 7;
const WEEK_END_HOUR = 22;
const WEEK_HOUR_HEIGHT = 64;
const WEEK_GRID_TOP_PADDING = 0;
const WEEK_EVENT_INSET = 2;
const WEEK_HOURS = Array.from({ length: WEEK_END_HOUR - WEEK_START_HOUR + 1 }, (_, index) => WEEK_START_HOUR + index);
const SCHEDULE_TIME_MINUTES = ["00", "15", "30", "45"] as const;

function LocalizedTimeInput({
  id,
  label,
  value,
  onChange,
  locale,
  minTime = `${String(WEEK_START_HOUR).padStart(2, "0")}:00`,
  maxTime = "21:45",
  required = false,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  minTime?: string;
  maxTime?: string;
  required?: boolean;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [selectedHour = "09", selectedMinute = "00"] = value.split(":");
  const minMinutes = timeToMinutes(minTime);
  const maxMinutes = timeToMinutes(maxTime);
  const availableHours = WEEK_HOURS
    .map((hour) => `${hour}`.padStart(2, "0"))
    .filter((hour) => {
      const hourStart = timeToMinutes(`${hour}:00`);
      const hourEnd = timeToMinutes(`${hour}:45`);
      return hourStart <= maxMinutes && hourEnd >= minMinutes;
    });
  const hourValue = availableHours.includes(selectedHour) ? selectedHour : availableHours[0] || "09";
  const availableMinutes = SCHEDULE_TIME_MINUTES.filter((minute) => {
    const nextMinutes = timeToMinutes(`${hourValue}:${minute}`);
    return nextMinutes >= minMinutes && nextMinutes <= maxMinutes;
  });
  const minuteValue = availableMinutes.includes(selectedMinute as (typeof SCHEDULE_TIME_MINUTES)[number])
    ? selectedMinute
    : availableMinutes[0] || "00";
  const updateTime = (nextHour: string, nextMinute: string) => {
    const nextAvailableMinutes = SCHEDULE_TIME_MINUTES.filter((minute) => {
      const nextMinutes = timeToMinutes(`${nextHour}:${minute}`);
      return nextMinutes >= minMinutes && nextMinutes <= maxMinutes;
    });
    onChange(`${nextHour}:${nextAvailableMinutes.includes(nextMinute as (typeof SCHEDULE_TIME_MINUTES)[number]) ? nextMinute : nextAvailableMinutes[0] || "00"}`);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <input
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={() => undefined}
        required={required}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      <div id={inputId} className="grid grid-cols-2 gap-2">
        <div className="relative">
          <select
            aria-label={locale === "zh" ? "小时" : "Hour"}
            value={hourValue}
            onChange={(event) => updateTime(event.target.value, minuteValue)}
            className="h-9 w-full appearance-none rounded-md border border-input bg-background py-1 pl-3 pr-8 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {availableHours.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="relative">
          <select
            aria-label={locale === "zh" ? "分钟" : "Minute"}
            value={minuteValue}
            onChange={(event) => updateTime(hourValue, event.target.value)}
            className="h-9 w-full appearance-none rounded-md border border-input bg-background py-1 pl-3 pr-8 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {availableMinutes.map((minute) => (
              <option key={minute} value={minute}>
                {minute}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

type TaskDueDateFilter = "ALL" | "EQ" | "GTE" | "LTE";
type TaskSortField = "title" | "dueDate" | "createdAt" | "creator" | "status" | "assignee";
type TaskSortDirection = "asc" | "desc";
type TaskColumnId = "title" | "content" | "dueDate" | "createdAt" | "creator" | "status" | "assignee" | "actions";
type TaskColumnConfig = {
  id: TaskColumnId;
  label: string;
  width: number;
  minWidth: number;
};
type ItemTab = "tasks" | "schedule" | "notes";
type ScheduleView = "week" | "month";
type ScheduleType = "meeting" | "out" | "reminder" | "memo";
type ScheduleCreateKind = "meeting" | "out" | "memo";
type AttendanceStatus = "PENDING" | "CONFIRMED" | "DECLINED" | "TENTATIVE";
type NoteFolderFilter = "all" | "pinned" | "trash" | `folder:${string}` | `pinned-folder:${string}`;
type NoteSaveStatus = "saved" | "pending" | "saving" | "error";
type SavedNoteSnapshot = {
  id: string;
  title: string;
  content: string;
};

const TASK_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const TASK_STATUS_SORT_ORDER: Record<string, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  DONE: 2,
};
const TASK_DEFAULT_COLUMN_IDS: TaskColumnId[] = [
  "title",
  "content",
  "dueDate",
  "creator",
  "status",
  "assignee",
];
const TASK_DEFAULT_COLUMN_WIDTHS: Record<TaskColumnId, number> = {
  title: 220,
  content: 260,
  dueDate: 130,
  createdAt: 180,
  creator: 160,
  status: 120,
  assignee: 160,
  actions: 150,
};
const TASK_ACTION_COLUMN_MIN_WIDTH = 56;
const TASK_UNASSIGNED_FILTER_VALUE = "__unassigned";
const TASK_UNKNOWN_CREATOR_FILTER_VALUE = "__unknown_creator";

type TaskFilterOption = { value: string; label: string };

function estimateTaskHeaderTextWidth(label: string) {
  return Array.from(label).reduce((total, char) => total + (char.charCodeAt(0) > 255 ? 12.25 : 7), 0);
}

function estimateTaskHeaderMinWidth(columnId: TaskColumnId, label: string, activeDueDateFilterLabel?: string) {
  if (columnId === "actions") return TASK_ACTION_COLUMN_MIN_WIDTH;

  const horizontalPadding = 40;
  const sortWidth = TASK_COLUMN_SORT_FIELD_MAP[columnId] ? 16 : 0;
  const isFilterable = columnId === "dueDate" || columnId === "creator" || columnId === "status" || columnId === "assignee";
  const filterWidth = !isFilterable
    ? 0
    : columnId === "dueDate" && activeDueDateFilterLabel
      ? Math.min(128, estimateTaskHeaderTextWidth(activeDueDateFilterLabel) + 14) + 4
      : 28;

  const contentMinWidth = columnId === "createdAt" ? 160 : columnId === "dueDate" ? 112 : 80;
  return Math.max(contentMinWidth, horizontalPadding + estimateTaskHeaderTextWidth(label) + sortWidth + filterWidth);
}

function taskFilterTrigger(active: boolean, label: string, value: string) {
  return (
    <Button
      type="button"
      variant={active ? "outline" : "ghost"}
      size={active ? "sm" : "icon-xs"}
      className={active
        ? "h-5 min-w-0 max-w-32 shrink-0 bg-background px-1.5 text-xs font-normal normal-case"
        : "shrink-0 text-muted-foreground"}
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {active ? <span className="truncate">{value}</span> : <ListFilter />}
    </Button>
  );
}

function TaskDateFilter({
  label,
  value,
  date,
  options,
  onChange,
  onDateChange,
}: {
  label: string;
  value: string;
  date: string;
  options: TaskFilterOption[];
  onChange: (value: string) => void;
  onDateChange: (value: string) => void;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label || options[0]?.label || value;
  const isActive = value !== "ALL";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {taskFilterTrigger(isActive, `${label}: ${[selectedLabel, date].filter(Boolean).join(" ")}`, [selectedLabel, date].filter(Boolean).join(" "))}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 normal-case">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options[0] ? <DropdownMenuRadioItem value={options[0].value}>{options[0].label}</DropdownMenuRadioItem> : null}
          {options.length > 1 ? <DropdownMenuSeparator /> : null}
          {options.slice(1).map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {isActive ? (
          <>
            <DropdownMenuSeparator />
            <div className="p-2" onKeyDown={(event) => event.stopPropagation()}>
              <input
                type="date"
                value={date}
                onChange={(event) => onDateChange(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label={label}
              />
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TaskMultiFilter({
  label,
  values,
  options,
  allLabel,
  locale,
  onChange,
}: {
  label: string;
  values: string[];
  options: TaskFilterOption[];
  allLabel: string;
  locale: Locale;
  onChange: (values: string[]) => void;
}) {
  const selectedLabels = options.filter((option) => values.includes(option.value)).map((option) => option.label);
  const selectionLabel = selectedLabels.join(locale === "zh" ? "、" : ", ") || allLabel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {taskFilterTrigger(values.length > 0, `${label}: ${selectionLabel}`, String(values.length))}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 normal-case">
        <DropdownMenuCheckboxItem
          checked={values.length === 0}
          onCheckedChange={() => onChange([])}
          onSelect={(event) => event.preventDefault()}
        >
          {allLabel}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={values.includes(option.value)}
            onCheckedChange={(checked) => onChange(
              checked === true
                ? [...values, option.value]
                : values.filter((value) => value !== option.value)
            )}
            onSelect={(event) => event.preventDefault()}
          >
            <span className="truncate" title={option.label}>{option.label}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function estimateTaskActionColumnWidth(headerLabel: string) {
  const headerWidth = estimateTaskHeaderTextWidth(headerLabel) + 24 + LIST_ACTION_BUTTON_GAP + LIST_ACTION_COLUMN_PADDING_X * 2;
  return Math.ceil(Math.max(TASK_ACTION_COLUMN_MIN_WIDTH, headerWidth, getListActionColumnWidth(2)));
}

const TASK_COLUMN_SORT_FIELD_MAP: Partial<Record<TaskColumnId, TaskSortField>> = {
  title: "title",
  dueDate: "dueDate",
  createdAt: "createdAt",
  creator: "creator",
  status: "status",
  assignee: "assignee",
};

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

function formatIssueFieldValue(
  field: DepartmentReminderIssueOption["issueFieldDefinitions"][number],
  value?: DepartmentReminderIssueOption["issueFieldValues"][number],
) {
  if (!value) return "";
  if (field.type === "BOOLEAN") return value.valueBoolean ? "true" : "false";
  if (field.type === "NUMBER") return value.valueNumber === null || value.valueNumber === undefined ? "" : String(value.valueNumber);
  if (field.type === "SELECT") return value.valueOption || "";
  return value.valueText || "";
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

function normalizeNoteComparisonTitle(title: string) {
  return title.trim();
}

function normalizeNoteComparisonContent(content: string) {
  if (typeof document === "undefined") {
    return content.trim();
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = content.trim();
  const hasText = Boolean(wrapper.textContent?.replace(/\u00a0/g, " ").trim());
  const hasMedia = Boolean(wrapper.querySelector("img, video, iframe, table, hr, pre, blockquote, ul, ol"));

  return hasText || hasMedia ? wrapper.innerHTML.trim() : "";
}

function noteContentHasUnsavedChanges(
  current: { title: string; content: string },
  saved: { title: string; content: string },
) {
  return (
    normalizeNoteComparisonTitle(current.title) !== normalizeNoteComparisonTitle(saved.title) ||
    normalizeNoteComparisonContent(current.content) !== normalizeNoteComparisonContent(saved.content)
  );
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
  initialSelectedScheduleItemId = null,
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
  initialSelectedScheduleItemId?: string | null;
  currentUserId: string;
  canCreateDepartmentItem: boolean;
  projectOptions: DepartmentReminderScopeOption[];
  assigneeOptions: DepartmentReminderAssigneeOption[];
}) {
  const t = TEXT[locale];
  const st = SCHEDULE_TEXT[locale];
  const issueText = getTranslations(locale).issueDetail;
  const taskTableText = locale === "zh"
    ? {
        createdAt: "\u521b\u5efa\u65f6\u95f4",
        showing: "\u663e\u793a",
        to: "\u5230",
        of: "\u5171",
        tasks: "\u6761\u4efb\u52a1",
        page: "\u7b2c",
        perPage: "\u6bcf\u9875",
        columns: "\u663e\u793a\u5217",
        resetColumns: "\u91cd\u7f6e\u5217",
        all: "\u5168\u90e8",
        dueDate: "\u5230\u671f\u65e5\u671f",
        allDueDates: "\u5168\u90e8\u5230\u671f\u65e5\u671f",
        dateEquals: "\u7b49\u4e8e",
        dateOnOrAfter: "\u665a\u4e8e\u6216\u7b49\u4e8e",
        dateOnOrBefore: "\u65e9\u4e8e\u6216\u7b49\u4e8e",
        unknownCreator: "\u672a\u77e5\u53d1\u8d77\u4eba",
        removeFilter: "\u53d6\u6d88\u7b5b\u9009",
      }
    : {
        createdAt: "Created at",
        showing: "Showing",
        to: "to",
        of: "of",
        tasks: "tasks",
        page: "Page",
        perPage: "Per page",
        columns: "Columns",
        resetColumns: "Reset columns",
        all: "All",
        dueDate: "Due date",
        allDueDates: "All due dates",
        dateEquals: "Equals",
        dateOnOrAfter: "On or after",
        dateOnOrBefore: "On or before",
        unknownCreator: "Unknown creator",
        removeFilter: "Remove filter",
      };
  const router = useRouter();
  const taskFilterStorageKey = `neo-jira:task-list-filters:${departmentId}:v1`;
  const noteEditorRef = useRef<RichTextEditorHandle>(null);
  const taskContentEditorRef = useRef<RichTextEditorHandle>(null);
  const editTaskContentEditorRef = useRef<RichTextEditorHandle>(null);
  const scheduleFilterIdPrefix = useId();
  const [scheduleView, setScheduleView] = useState<ScheduleView>("week");
  const [visibleScheduleTypes, setVisibleScheduleTypes] = useState<Record<ScheduleType, boolean>>({
    meeting: true,
    out: true,
    reminder: true,
    memo: true,
  });
  const [scheduleCursor, setScheduleCursor] = useState(() => new Date());
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [selectedScheduleItemId, setSelectedScheduleItemId] = useState<string | null>(initialSelectedScheduleItemId);
  const [scheduleOverflowDate, setScheduleOverflowDate] = useState<string | null>(null);
  const activeTab = initialTab;
  const [taskQuery, setTaskQuery] = useState("");
  const [taskDueDateFilter, setTaskDueDateFilter] = useState<TaskDueDateFilter>("ALL");
  const [taskDueDateValue, setTaskDueDateValue] = useState("");
  const [taskCreatorIds, setTaskCreatorIds] = useState<string[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<string[]>([]);
  const [taskAssigneeIds, setTaskAssigneeIds] = useState<string[]>([]);
  const [taskSortField, setTaskSortField] = useState<TaskSortField>("createdAt");
  const [taskSortDirection, setTaskSortDirection] = useState<TaskSortDirection>("desc");
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState<number>(TASK_PAGE_SIZE_OPTIONS[0]);
  const [hasLoadedTaskPreferences, setHasLoadedTaskPreferences] = useState(false);
  const taskColumnDefinitions = useMemo<TaskColumnConfig[]>(
    () => {
      const column = (id: TaskColumnId, label: string): TaskColumnConfig => ({
        id,
        label,
        width: TASK_DEFAULT_COLUMN_WIDTHS[id],
        minWidth: estimateTaskHeaderMinWidth(id, label),
      });
      return [
        column("title", t.titleField),
        column("content", t.notes),
        column("dueDate", taskTableText.dueDate),
        column("createdAt", taskTableText.createdAt),
        column("creator", t.openedBy),
        column("status", t.status),
        column("assignee", t.assignee),
        column("actions", t.actions),
      ];
    },
    [t.actions, t.assignee, t.notes, t.openedBy, t.status, t.titleField, taskTableText.createdAt, taskTableText.dueDate]
  );
  const taskColumnsById = useMemo(
    () => new Map(taskColumnDefinitions.map((column) => [column.id, column] as const)),
    [taskColumnDefinitions]
  );
  const [taskVisibleColumnIds, setTaskVisibleColumnIds] = useState<TaskColumnId[]>(TASK_DEFAULT_COLUMN_IDS);
  const [taskColumnWidths, setTaskColumnWidths] = useState<Record<TaskColumnId, number>>(TASK_DEFAULT_COLUMN_WIDTHS);
  const taskConfigurableColumns = useMemo(
    () => taskColumnDefinitions.filter((column) => column.id !== "actions"),
    [taskColumnDefinitions]
  );
  const activeDueDateFilterLabel = taskDueDateFilter === "ALL"
    ? undefined
    : [
        {
          EQ: taskTableText.dateEquals,
          GTE: taskTableText.dateOnOrAfter,
          LTE: taskTableText.dateOnOrBefore,
        }[taskDueDateFilter],
        taskDueDateValue,
      ].filter(Boolean).join(locale === "zh" ? "：" : ": ");
  const taskColumns = useMemo(
    () => {
      const visibleColumns = taskVisibleColumnIds
        .map((columnId) => {
          const column = taskColumnsById.get(columnId);
          if (!column) return null;
          const minWidth = column.id === "dueDate"
            ? estimateTaskHeaderMinWidth(column.id, column.label, activeDueDateFilterLabel)
            : column.minWidth;
          return {
            ...column,
            minWidth,
            width: Math.max(taskColumnWidths[columnId] ?? column.width, minWidth),
          };
        })
        .filter((column): column is TaskColumnConfig => Boolean(column));
      const actionsColumn = taskColumnsById.get("actions");
      return actionsColumn
        ? [...visibleColumns, { ...actionsColumn, width: Math.max(taskColumnWidths.actions ?? actionsColumn.width, actionsColumn.minWidth) }]
        : visibleColumns;
    },
    [activeDueDateFilterLabel, taskColumnWidths, taskColumnsById, taskVisibleColumnIds]
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTaskFilters = readStoredTaskListFilters(taskFilterStorageKey);
    if (typeof storedTaskFilters.taskQuery === "string") setTaskQuery(storedTaskFilters.taskQuery);
    if (["ALL", "EQ", "GTE", "LTE"].includes(storedTaskFilters.taskDueDateFilter || "")) {
      setTaskDueDateFilter(storedTaskFilters.taskDueDateFilter!);
    }
    if (typeof storedTaskFilters.taskDueDateValue === "string") setTaskDueDateValue(storedTaskFilters.taskDueDateValue);
    if (Array.isArray(storedTaskFilters.taskCreatorIds)) setTaskCreatorIds(storedTaskFilters.taskCreatorIds);
    if (Array.isArray(storedTaskFilters.taskStatuses)) setTaskStatuses(storedTaskFilters.taskStatuses);
    if (Array.isArray(storedTaskFilters.taskAssigneeIds)) setTaskAssigneeIds(storedTaskFilters.taskAssigneeIds);
    if (storedTaskFilters.taskSortField) setTaskSortField(storedTaskFilters.taskSortField);
    if (storedTaskFilters.taskSortDirection) setTaskSortDirection(storedTaskFilters.taskSortDirection);
    if (TASK_PAGE_SIZE_OPTIONS.some((option) => option === storedTaskFilters.taskPageSize)) {
      setTaskPageSize(storedTaskFilters.taskPageSize!);
    }
    const validVisibleColumnIds = storedTaskFilters.taskVisibleColumnIds?.filter((columnId) =>
      taskConfigurableColumns.some((column) => column.id === columnId)
    );
    if (validVisibleColumnIds?.length) {
      setTaskVisibleColumnIds(validVisibleColumnIds);
    }
    const validColumnWidths = Object.entries(storedTaskFilters.taskColumnWidths || {}).reduce(
      (acc, [columnId, width]) => {
        if (TASK_DEFAULT_COLUMN_IDS.includes(columnId as TaskColumnId) && typeof width === "number" && width >= 80) {
          acc[columnId as TaskColumnId] = width;
        }
        return acc;
      },
      {} as Partial<Record<TaskColumnId, number>>
    );
    setTaskColumnWidths({ ...TASK_DEFAULT_COLUMN_WIDTHS, ...validColumnWidths });
    setHasLoadedTaskPreferences(true);
  }, [taskConfigurableColumns, taskFilterStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedTaskPreferences) return;
    window.localStorage.setItem(
      taskFilterStorageKey,
      JSON.stringify({
        taskQuery,
        taskDueDateFilter,
        taskDueDateValue,
        taskCreatorIds,
        taskStatuses,
        taskAssigneeIds,
        taskSortField,
        taskSortDirection,
        taskPageSize,
        taskVisibleColumnIds,
        taskColumnWidths,
      } satisfies StoredTaskListFilters)
    );
  }, [hasLoadedTaskPreferences, taskAssigneeIds, taskColumnWidths, taskCreatorIds, taskDueDateFilter, taskDueDateValue, taskFilterStorageKey, taskPageSize, taskQuery, taskSortDirection, taskSortField, taskStatuses, taskVisibleColumnIds]);
  const [noteFolderFilter, setNoteFolderFilter] = useState<NoteFolderFilter>("all");
  const [collapsedNoteFolderIds, setCollapsedNoteFolderIds] = useState<Record<string, boolean>>({});
  const [noteQuery, setNoteQuery] = useState("");
  const [pinnedNoteOverrides, setPinnedNoteOverrides] = useState<Record<string, boolean>>({});
  const [noteTitleOverrides, setNoteTitleOverrides] = useState<Record<string, string>>({});
  const [noteSaveStatus, setNoteSaveStatus] = useState<NoteSaveStatus>("saved");
  const [selectedNoteIssueId, setSelectedNoteIssueId] = useState<string | null>(null);
  const [isNoteIssuePropertiesExpanded, setIsNoteIssuePropertiesExpanded] = useState(false);
  const initialNote = notes.find((note) => !note.deletedAt) || null;
  const savedNoteSnapshotRef = useRef<SavedNoteSnapshot | null>(
    initialNote
      ? {
          id: initialNote.id,
          title: initialNote.title,
          content: initialNote.content || "",
        }
      : null
  );
  const [noteSavedAt, setNoteSavedAt] = useState(initialNote?.updatedAt || "");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(initialNote?.id || null);
  const [isNoteFullscreen, setIsNoteFullscreen] = useState(false);
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
  const [editingScheduleItemId, setEditingScheduleItemId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskSnapshot, setSelectedTaskSnapshot] = useState<DepartmentItemCenterItem | null>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [taskPendingDelete, setTaskPendingDelete] = useState<DepartmentItemCenterItem | null>(null);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [scheduleReplyContent, setScheduleReplyContent] = useState("");
  const [activeAttendeeMatchIndex, setActiveAttendeeMatchIndex] = useState(0);
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
    scheduleKind: "meeting" as ScheduleCreateKind,
    scheduleDate: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
    endAt: "",
    location: "",
    attendeeIds: [] as string[],
    attendeeQuery: "",
    reminderRule: "15",
    meetingMinutes: "",
  });
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([]);
  const [isTaskAttachmentUploading, setIsTaskAttachmentUploading] = useState(false);
  const [editTaskAttachments, setEditTaskAttachments] = useState<TaskAttachment[]>([]);
  const [editTaskOriginalAttachments, setEditTaskOriginalAttachments] = useState<TaskAttachment[]>([]);
  const [isEditTaskAttachmentUploading, setIsEditTaskAttachmentUploading] = useState(false);
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
  const taskCreatorOptions = useMemo<TaskFilterOption[]>(() => {
    const creators = new Map<string, string>();
    for (const item of taskItems) {
      const value = item.creatorId || TASK_UNKNOWN_CREATOR_FILTER_VALUE;
      const label = item.creatorName || item.creatorEmail || taskTableText.unknownCreator;
      if (!creators.has(value)) creators.set(value, label);
    }
    return Array.from(creators, ([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, locale === "zh" ? "zh-CN" : "en-US"));
  }, [locale, taskItems, taskTableText.unknownCreator]);
  const taskAssigneeOptions = useMemo<TaskFilterOption[]>(() => {
    const assignees = new Map<string, string>();
    for (const item of taskItems) {
      const value = item.assigneeId || TASK_UNASSIGNED_FILTER_VALUE;
      const label = item.assigneeName || item.assigneeEmail || t.unassigned;
      if (!assignees.has(value)) assignees.set(value, label);
    }
    return Array.from(assignees, ([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, locale === "zh" ? "zh-CN" : "en-US"));
  }, [locale, t.unassigned, taskItems]);
  const taskStatusOptions = useMemo<TaskFilterOption[]>(() => {
    const statusOrder = ["NOT_STARTED", "IN_PROGRESS", "DONE"];
    const statuses = new Set(taskItems.map((item) => item.completedAt ? "DONE" : item.taskStatus));
    return statusOrder
      .filter((status) => statuses.has(status))
      .map((status) => ({ value: status, label: taskStatusLabel(status, locale) }));
  }, [locale, taskItems]);
  const taskDueDateOptions: TaskFilterOption[] = [
    { value: "ALL", label: taskTableText.allDueDates },
    { value: "EQ", label: taskTableText.dateEquals },
    { value: "GTE", label: taskTableText.dateOnOrAfter },
    { value: "LTE", label: taskTableText.dateOnOrBefore },
  ];
  const taskFilterSummary = [
    ...(taskDueDateFilter !== "ALL" ? [{
      key: "dueDate",
      label: taskTableText.dueDate,
      value: [taskDueDateOptions.find((option) => option.value === taskDueDateFilter)?.label || taskDueDateFilter, taskDueDateValue]
        .filter(Boolean)
        .join(locale === "zh" ? "：" : ": "),
      clear: () => {
        setTaskDueDateFilter("ALL");
        setTaskDueDateValue("");
        setTaskPage(1);
      },
    }] : []),
    ...(taskCreatorIds.length > 0 ? [{
      key: "creator",
      label: t.openedBy,
      value: taskCreatorIds.map((id) => taskCreatorOptions.find((option) => option.value === id)?.label || taskTableText.unknownCreator).join(locale === "zh" ? "、" : ", "),
      clear: () => {
        setTaskCreatorIds([]);
        setTaskPage(1);
      },
    }] : []),
    ...(taskStatuses.length > 0 ? [{
      key: "status",
      label: t.status,
      value: taskStatuses.map((status) => taskStatusOptions.find((option) => option.value === status)?.label || status).join(locale === "zh" ? "、" : ", "),
      clear: () => {
        setTaskStatuses([]);
        setTaskPage(1);
      },
    }] : []),
    ...(taskAssigneeIds.length > 0 ? [{
      key: "assignee",
      label: t.assignee,
      value: taskAssigneeIds.map((id) => taskAssigneeOptions.find((option) => option.value === id)?.label || t.unassigned).join(locale === "zh" ? "、" : ", "),
      clear: () => {
        setTaskAssigneeIds([]);
        setTaskPage(1);
      },
    }] : []),
  ];
  const filteredTaskItems = taskItems.filter((item) => {
    const creatorValue = item.creatorId || TASK_UNKNOWN_CREATOR_FILTER_VALUE;
    if (taskCreatorIds.length > 0 && !taskCreatorIds.includes(creatorValue)) return false;

    const statusValue = item.completedAt ? "DONE" : item.taskStatus;
    if (taskStatuses.length > 0 && !taskStatuses.includes(statusValue)) return false;

    const assigneeValue = item.assigneeId || TASK_UNASSIGNED_FILTER_VALUE;
    if (taskAssigneeIds.length > 0 && !taskAssigneeIds.includes(assigneeValue)) return false;

    if (taskDueDateFilter !== "ALL" && taskDueDateValue) {
      if (!item.dueDate) return false;
      const dueDate = formatListDate(item.dueDate);
      if (taskDueDateFilter === "EQ") return dueDate === taskDueDateValue;
      if (taskDueDateFilter === "GTE") return dueDate >= taskDueDateValue;
      return dueDate <= taskDueDateValue;
    }
    return true;
  }).filter((item) => {
    const query = taskQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      item.title,
      item.content,
      item.projectKey,
      item.projectName,
      item.issueKey,
      item.issueTitle,
      item.assigneeName,
      item.assigneeEmail,
      item.creatorName,
      item.creatorEmail,
    ].filter(Boolean).some((value) => value!.toLowerCase().includes(query));
  });
  const sortedTaskItems = useMemo(() => {
    const compareText = (left: string | null | undefined, right: string | null | undefined) =>
      (left || "").localeCompare(right || "", locale === "zh" ? "zh-CN" : "en-US", {
        numeric: true,
        sensitivity: "base",
      });
    const compareDate = (left: string | null | undefined, right: string | null | undefined) => {
      if (!left && !right) return 0;
      if (!left) return 1;
      if (!right) return -1;
      return new Date(left).getTime() - new Date(right).getTime();
    };

    return [...filteredTaskItems].sort((left, right) => {
      let result = 0;

      if (taskSortField === "title") {
        result = compareText(left.title, right.title);
      } else if (taskSortField === "dueDate") {
        result = compareDate(left.dueDate, right.dueDate);
      } else if (taskSortField === "createdAt") {
        result = compareDate(left.createdAt, right.createdAt);
      } else if (taskSortField === "creator") {
        result = compareText(left.creatorName || left.creatorEmail, right.creatorName || right.creatorEmail);
      } else if (taskSortField === "status") {
        result =
          (TASK_STATUS_SORT_ORDER[left.completedAt ? "DONE" : left.taskStatus] ?? Number.MAX_SAFE_INTEGER) -
          (TASK_STATUS_SORT_ORDER[right.completedAt ? "DONE" : right.taskStatus] ?? Number.MAX_SAFE_INTEGER);
      } else if (taskSortField === "assignee") {
        result = compareText(left.assigneeName || left.assigneeEmail, right.assigneeName || right.assigneeEmail);
      }

      if (result === 0) {
        result = compareDate(right.createdAt, left.createdAt);
      }

      return taskSortDirection === "asc" ? result : -result;
    });
  }, [filteredTaskItems, locale, taskSortDirection, taskSortField]);
  const taskTotalPages = sortedTaskItems.length === 0 ? 0 : Math.ceil(sortedTaskItems.length / taskPageSize);
  const currentTaskPage = taskTotalPages === 0 ? 1 : Math.min(taskPage, taskTotalPages);
  const paginatedTaskItems = useMemo(() => {
    const start = (currentTaskPage - 1) * taskPageSize;
    return sortedTaskItems.slice(start, start + taskPageSize);
  }, [currentTaskPage, sortedTaskItems, taskPageSize]);
  const displayedTaskColumns = taskColumns;
  const displayedTaskDataColumns = displayedTaskColumns.filter((column) => column.id !== "actions");
  const displayedTaskActionColumn = displayedTaskColumns.find((column) => column.id === "actions");
  const taskActionColumnWidth = useMemo(() => estimateTaskActionColumnWidth(t.actions), [t.actions]);
  const taskTableMinWidth = useMemo(
    () => displayedTaskColumns.reduce(
      (total, column) => total + (column.id === "actions" ? taskActionColumnWidth : column.width),
      0
    ),
    [displayedTaskColumns, taskActionColumnWidth]
  );
  const taskRangeStart = sortedTaskItems.length === 0 ? 0 : (currentTaskPage - 1) * taskPageSize + 1;
  const taskRangeEnd = Math.min(currentTaskPage * taskPageSize, sortedTaskItems.length);
  const [taskDragSourceIndex, setTaskDragSourceIndex] = useState<number | null>(null);
  const [taskDragOverIndex, setTaskDragOverIndex] = useState<number | null>(null);
  const [taskDragOverSide, setTaskDragOverSide] = useState<"left" | "right" | null>(null);
  const taskResizingRef = useRef<{
    colIndex: number;
    startX: number;
    startWidth: number;
    scrollContainer: HTMLElement | null;
    startScrollLeft: number;
  } | null>(null);

  const handleTaskColumnDragStart = (event: React.DragEvent, index: number) => {
    if (displayedTaskColumns[index]?.id === "actions") {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("taskColIndex", index.toString());
    event.dataTransfer.effectAllowed = "move";
    setTaskDragSourceIndex(index);
  };

  const handleTaskColumnDrop = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault();
    if (displayedTaskColumns[targetIndex]?.id === "actions") return;
    const sourceIndexStr = event.dataTransfer.getData("taskColIndex");
    if (sourceIndexStr) {
      const sourceIndex = parseInt(sourceIndexStr, 10);
      if (displayedTaskColumns[sourceIndex]?.id === "actions") return;
      if (sourceIndex !== targetIndex) {
        const nextVisibleColumnIds = [...taskVisibleColumnIds];
        const [removed] = nextVisibleColumnIds.splice(sourceIndex, 1);
        const adjustedTarget =
          taskDragOverSide === "right"
            ? sourceIndex < targetIndex
              ? targetIndex
              : targetIndex + 1
            : sourceIndex < targetIndex
              ? targetIndex - 1
              : targetIndex;
        nextVisibleColumnIds.splice(Math.max(0, adjustedTarget), 0, removed);
        setTaskVisibleColumnIds(nextVisibleColumnIds);
      }
    }
    setTaskDragSourceIndex(null);
    setTaskDragOverIndex(null);
    setTaskDragOverSide(null);
  };

  const handleTaskColumnDragOver = (event: React.DragEvent, index: number) => {
    if (displayedTaskColumns[index]?.id === "actions" || displayedTaskColumns[taskDragSourceIndex ?? -1]?.id === "actions") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const side = event.clientX < midX ? "left" : "right";
    setTaskDragOverIndex(index);
    setTaskDragOverSide(side);
  };

  const handleTaskColumnDragEnd = () => {
    setTaskDragSourceIndex(null);
    setTaskDragOverIndex(null);
    setTaskDragOverSide(null);
  };

  const handleTaskColumnResizeStart = (event: React.MouseEvent, colIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    const column = displayedTaskColumns[colIndex];
    if (!column || column.id === "actions") return;
    const startWidth = column.width || 150;
    const scrollContainer = event.currentTarget.closest<HTMLElement>(".overflow-x-auto");
    taskResizingRef.current = {
      colIndex,
      startX: event.clientX,
      startWidth,
      scrollContainer,
      startScrollLeft: scrollContainer?.scrollLeft ?? 0,
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const resizeState = taskResizingRef.current;
      if (!resizeState) return;

      const delta = moveEvent.clientX - resizeState.startX;
      const resizeColumnId = displayedTaskColumns[resizeState.colIndex]?.id;
      if (!resizeColumnId) return;
      const resizeMinWidth = displayedTaskColumns[resizeState.colIndex]?.minWidth || 80;

      const newWidth = Math.max(resizeMinWidth, resizeState.startWidth + delta);

      setTaskColumnWidths((current) => ({
        ...current,
        [resizeColumnId]: newWidth,
      }));
      if (resizeState.colIndex === displayedTaskColumns.length - 2 && resizeState.scrollContainer) {
        const nextScrollLeft = Math.max(0, resizeState.startScrollLeft + newWidth - resizeState.startWidth);
        window.requestAnimationFrame(() => resizeState.scrollContainer?.scrollTo({ left: nextScrollLeft }));
      }
    };

    const onMouseUp = () => {
      taskResizingRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleToggleTaskColumnVisibility = (columnId: TaskColumnId) => {
    if (columnId === "actions") return;
    setTaskVisibleColumnIds((current) => {
      if (current.includes(columnId)) {
        if (current.length === 1) return current;
        return current.filter((id) => id !== columnId);
      }
      const availableOrder = taskConfigurableColumns.map((column) => column.id);
      return [...current, columnId].sort((left, right) => availableOrder.indexOf(left) - availableOrder.indexOf(right));
    });
  };

  const resetTaskColumns = () => {
    setTaskVisibleColumnIds(TASK_DEFAULT_COLUMN_IDS);
    setTaskColumnWidths(TASK_DEFAULT_COLUMN_WIDTHS);
  };
  const visibleItems = items.filter((item) => {
    if (activeTab === "tasks") return filteredTaskItems.some((task) => task.id === item.id);
    if (activeTab === "schedule") {
      if (item.itemType !== "EVENT" && item.itemType !== "REMINDER" && item.itemType !== "TODO" && item.itemType !== "ISSUE_DUE") return false;
      if (item.kind === "ISSUE_DUE") return item.assigneeId === currentUserId;
      if (item.creatorId === currentUserId || item.assigneeId === currentUserId) return true;
      if (item.scopeType === "DEPARTMENT" && (item.itemType === "EVENT" || item.itemType === "REMINDER")) return true;
      return item.attendees.some((attendee) => attendee.userId === currentUserId);
    }
    return false;
  });
  const scheduleItems = items
    .filter((item) => item.itemType === "EVENT" || item.itemType === "REMINDER" || item.itemType === "TODO" || item.itemType === "ISSUE_DUE")
    .filter((item) => item.itemType !== "TODO" || Boolean(item.dueDate))
    .filter((item) => {
      if (item.kind === "ISSUE_DUE") return item.assigneeId === currentUserId;
      if (item.creatorId === currentUserId || item.assigneeId === currentUserId) return true;
      if (item.scopeType === "DEPARTMENT" && (item.itemType === "EVENT" || item.itemType === "REMINDER")) return true;
      return item.attendees.some((attendee) => attendee.userId === currentUserId);
    })
    .filter((item) => {
      const type = getScheduleType(item);
      if (!visibleScheduleTypes[type]) return false;
      const query = scheduleSearch.trim().toLowerCase();
      if (!query) return true;
      return [
        item.title,
        item.content,
        item.projectKey,
        item.projectName,
        item.issueKey,
        item.issueTitle,
        item.assigneeName,
        item.assigneeEmail,
        item.creatorName,
        item.creatorEmail,
      ].filter(Boolean).some((value) => value!.toLowerCase().includes(query));
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const activeNotes = notes.filter((note) => !note.deletedAt);
  const trashedNotes = notes.filter((note) => note.deletedAt);
  const isNotePinned = (note: NoteListItem) => pinnedNoteOverrides[note.id] ?? note.isPinned;
  const noteTitle = (note: NoteListItem) => noteTitleOverrides[note.id] ?? note.title;
  const isPinnedFilter = noteFolderFilter === "pinned" || noteFolderFilter.startsWith("pinned-folder:");
  const filteredNotes = notes.filter((note) => {
    if (noteFolderFilter === "trash") {
      if (!note.deletedAt) return false;
    } else if (note.deletedAt) {
      return false;
    }
    if (isPinnedFilter && !isNotePinned(note)) return false;

    const query = noteQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      noteTitle(note),
      notePreview(note.content),
      note.projectKey,
      note.projectName,
      note.issueKey,
      note.issueTitle,
      note.taskTitle,
    ].filter(Boolean).some((value) => value!.toLowerCase().includes(query));
  });
  const selectedNote = selectedNoteId ? notes.find((note) => note.id === selectedNoteId) || null : null;
  const selectedTaskFromItems = selectedTaskId ? items.find((item) => item.id === selectedTaskId) || null : null;
  const selectedTask =
    selectedTaskSnapshot?.id === selectedTaskId
      ? ({ ...(selectedTaskFromItems || selectedTaskSnapshot), content: selectedTaskSnapshot.content } as DepartmentItemCenterItem)
      : selectedTaskFromItems;
  const selectedTaskAttachments = parseTaskAttachmentsFromContent(selectedTask?.content);
  const selectedTaskContent = stripTaskAttachmentsFromContent(selectedTask?.content);
  const selectedScheduleItem = selectedScheduleItemId ? items.find((item) => item.id === selectedScheduleItemId) || null : null;
  const editingScheduleItem = editingScheduleItemId ? items.find((item) => item.id === editingScheduleItemId) || null : null;
  const selectedNoteIssue = selectedNoteIssueId
    ? noteIssueOptions.find((issue) => issue.id === selectedNoteIssueId) || null
    : null;

  useEffect(() => {
    if (!selectedScheduleItem) return;
    const selectedDate = new Date(selectedScheduleItem.date);
    if (!Number.isNaN(selectedDate.getTime())) setScheduleCursor(selectedDate);
  }, [selectedScheduleItem]);

  useEffect(() => {
    setIsNoteIssuePropertiesExpanded(false);
  }, [selectedNoteIssueId]);

  useEffect(() => {
    if (!selectedNote) return;
    const currentSnapshot = savedNoteSnapshotRef.current;
    if (currentSnapshot?.id === selectedNote.id) return;

    savedNoteSnapshotRef.current = {
      id: selectedNote.id,
      title: selectedNote.title,
      content: selectedNote.content || "",
    };
    setNoteSavedAt(selectedNote.updatedAt);
    setNoteSaveStatus("saved");
  }, [selectedNote]);

  useEffect(() => {
    if (!selectedNoteId) {
      setNoteSaveStatus("saved");
    }
  }, [selectedNoteId]);

  useEffect(() => {
    setScheduleReplyContent("");
  }, [selectedScheduleItemId]);

  useEffect(() => {
    setActiveAttendeeMatchIndex(0);
  }, [form.attendeeQuery]);

  const calendarItems = scheduleItems.filter((item) => item.itemType !== "NOTE");
  const pendingMeetingItems = items.filter((item) => {
    if (getScheduleType(item) !== "meeting") return false;
    return item.attendees.some((attendee) =>
      attendee.userId === currentUserId && (attendee.status === "PENDING" || attendee.status === "TENTATIVE")
    );
  }).sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    const safeATime = Number.isNaN(aTime) ? Number.POSITIVE_INFINITY : aTime;
    const safeBTime = Number.isNaN(bTime) ? Number.POSITIVE_INFINITY : bTime;
    return safeATime - safeBTime;
  });
  const pendingMeetingCount = pendingMeetingItems.length;
  const groupedByDay = calendarItems.reduce((acc, item) => {
    const key = dayKey(item.date);
    acc[key] = [...(acc[key] || []), item];
    return acc;
  }, {} as Record<string, DepartmentItemCenterItem[]>);
  const allDayGroupedByDay = calendarItems.reduce((acc, item) => {
    if (!isAllDayScheduleItem(item)) return acc;
    const key = dayKey(item.date);
    acc[key] = [...(acc[key] || []), item];
    return acc;
  }, {} as Record<string, DepartmentItemCenterItem[]>);
  const timedGroupedByDay = calendarItems.reduce((acc, item) => {
    if (isAllDayScheduleItem(item)) return acc;
    const key = dayKey(item.date);
    acc[key] = [...(acc[key] || []), item];
    return acc;
  }, {} as Record<string, DepartmentItemCenterItem[]>);
  const todayScheduleCount = calendarItems.filter((item) => isSameDay(new Date(item.date), new Date())).length;
  const scheduleOverflowItems = scheduleOverflowDate
    ? [...(groupedByDay[scheduleOverflowDate] || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];
  const scheduleOverflowTitle = scheduleOverflowDate
    ? new Date(`${scheduleOverflowDate}T00:00`).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        weekday: "short",
      })
    : "";

  const resetForm = (overrides: Partial<typeof form> = {}) =>
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
      scheduleKind: "meeting",
      scheduleDate: format(new Date(), "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "10:00",
      endAt: "",
      location: "",
      attendeeIds: [],
      attendeeQuery: "",
      reminderRule: "15",
      meetingMinutes: "",
      ...overrides,
    });

  const openCreateModal = () => {
    setEditingScheduleItemId(null);
    resetForm();
    setTaskAttachments([]);
    setError("");
    setIsCreateMoreOpen(false);
    setIsCreateOpen(true);
  };

  const openCreateScheduleModal = (date = scheduleCursor, startTime = "07:00", endTime = "22:00", hasTime = true) => {
    setEditingScheduleItemId(null);
    const scheduleDate = format(date, "yyyy-MM-dd");
    const [startHour = "07", startMinute = "00"] = startTime.split(":");
    const [endHour = "10", endMinute = "00"] = endTime.split(":");
    resetForm({
      itemType: "REMINDER",
      startAt: composeDateTime(date, Number(startHour), Number(startMinute)),
      endAt: composeDateTime(date, Number(endHour), Number(endMinute)),
      dueAt: "",
      scopeType: "PERSONAL",
      assigneeId: currentUserId,
      scheduleKind: "memo",
      scheduleDate,
      startTime,
      endTime,
      hasTime: true,
      location: "",
      attendeeIds: [],
      attendeeQuery: "",
      reminderRule: "15",
      meetingMinutes: "",
    });
    setError("");
    setIsCreateMoreOpen(true);
    setIsCreateOpen(true);
  };

  const openEditScheduleItem = (item: DepartmentItemCenterItem) => {
    if (item.kind !== "REMINDER" || !item.canEdit) return;
    const scheduleKind = getScheduleType(item) === "memo" ? "memo" : getScheduleType(item) === "out" ? "out" : "meeting";
    const details = parseScheduleDetails(item.content);
    const attendeeIds = item.attendees.length > 0
      ? item.attendees
          .map((attendee) => attendee.userId)
      : details.participantNames
          .map((name) => {
            const normalizedName = name.toLowerCase();
            return assigneeOptions.find((assignee) =>
              assignee.name.toLowerCase() === normalizedName ||
              assignee.email.toLowerCase() === normalizedName
            )?.id;
          })
          .filter((id): id is string => Boolean(id));
    setEditingScheduleItemId(item.id);
    const isMemoSchedule = scheduleKind === "memo";
    const memoHasTimedPlacement = hasTimedSchedulePlacement(item);
    resetForm({
      title: item.title,
      itemType: scheduleKind === "memo" ? "REMINDER" : "EVENT",
      hasTime: true,
      startAt: item.date,
      endAt: item.endDate || "",
      dueAt: "",
      scopeType: item.scopeType === "PERSONAL" ? "PERSONAL" : "DEPARTMENT",
      assigneeId: item.assigneeId || currentUserId,
      scheduleKind,
      scheduleDate: format(new Date(item.date), "yyyy-MM-dd"),
      startTime: isMemoSchedule && !memoHasTimedPlacement ? "07:00" : formatTimeLocalFromIso(item.date) || "09:00",
      endTime: isMemoSchedule && !memoHasTimedPlacement ? "22:00" : formatTimeLocalFromIso(item.endDate) || formatTimeLocalFromIso(item.date) || (isMemoSchedule ? "22:00" : "10:00"),
      location: details.location,
      attendeeIds,
      attendeeQuery: "",
      reminderRule: "15",
      meetingMinutes: details.notes,
    });
    setError("");
    setIsCreateMoreOpen(true);
    setIsCreateOpen(true);
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const isScheduleCreate = activeTab === "schedule";
    const isTimedSchedule = isScheduleCreate;
    if (isTimedSchedule && !isTimeInScheduleRange(form.startTime, form.endTime)) {
      setError(locale === "zh" ? "日程开始时间必须在 07:00-21:45 之间，结束时间最晚 22:00，并以 15 分钟为间隔。" : "Schedule start time must be between 07:00 and 21:45, end time can be up to 22:00, in 15-minute increments.");
      return;
    }
    startTransition(async () => {
      const attendeeNames = form.attendeeIds
        .map((id) => assigneeOptions.find((assignee) => assignee.id === id))
        .filter(Boolean)
        .map((assignee) => assignee!.name || assignee!.email);
      const scheduleContent = form.scheduleKind === "memo" ? form.meetingMinutes.trim() : [
        `${t.type}: ${scheduleTypeLabel(form.scheduleKind, locale)}`,
        form.location.trim() ? `${st.location}: ${form.location.trim()}` : "",
        attendeeNames.length > 0 ? `${st.participants}: ${attendeeNames.join(", ")}` : "",
        form.meetingMinutes.trim(),
      ].filter(Boolean).join("\n\n");
      const scheduleItemType = form.scheduleKind === "memo" ? "REMINDER" : "EVENT";
      const scheduleScopeType = isScheduleCreate && form.scheduleKind !== "memo" ? "DEPARTMENT" : form.scopeType;
      const scheduleStartAt = combineDateAndTime(form.scheduleDate, form.startTime);
      const scheduleEndAt = combineDateAndTime(form.scheduleDate, form.endTime);
      const result =
        isScheduleCreate && editingScheduleItem
          ? await updateReminderItem(editingScheduleItem.id, {
              title: form.title,
              content: scheduleContent,
              itemType: scheduleItemType,
              startAt: scheduleStartAt,
              endAt: scheduleEndAt,
              scopeType: scheduleScopeType,
              departmentId,
              attendeeIds: form.scheduleKind === "meeting" ? form.attendeeIds : [],
            })
          : await createReminder({
              departmentId,
              title: form.title,
              content: isScheduleCreate ? scheduleContent : buildTaskContentWithAttachments(),
              itemType: isScheduleCreate ? scheduleItemType : form.itemType,
              startAt: isScheduleCreate ? scheduleStartAt : form.itemType === "TODO" ? undefined : form.startAt,
              endAt: isScheduleCreate ? scheduleEndAt : undefined,
              dueAt: form.dueAt || undefined,
              priority: form.priority,
              isImportant: form.isImportant,
              scopeType: scheduleScopeType,
              projectId: isScheduleCreate ? undefined : form.scopeType === "PROJECT" ? form.projectId : undefined,
              issueId: form.issueId || undefined,
              assigneeId: form.assigneeId || undefined,
              attendeeIds: isScheduleCreate && form.scheduleKind === "meeting" ? form.attendeeIds : undefined,
            });

      if (!result.success) {
        setError(result.error || "Failed");
        return;
      }

      if (!isScheduleCreate) {
        taskContentEditorRef.current?.commitPendingUploads();
        setTaskAttachments([]);
      }
      setIsCreateOpen(false);
      setEditingScheduleItemId(null);
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
    const attachments = parseTaskAttachmentsFromContent(item.content);
    setSelectedTaskId(item.id);
    setSelectedTaskSnapshot(item);
    setIsEditingTask(false);
    setDetailError("");
    setReplyContent("");
    setEditTaskAttachments(attachments);
    setEditTaskOriginalAttachments(attachments);
    setEditForm({
      title: item.title,
      content: stripTaskAttachmentsFromContent(item.content),
      dueAt: formatDateTimeLocalFromIso(item.dueDate),
      scopeType: item.scopeType === "PROJECT" ? "PROJECT" : item.scopeType === "DEPARTMENT" ? "DEPARTMENT" : "PERSONAL",
      projectId: item.scopeType === "PROJECT" ? taskAssigneeChoices.find((choice) => choice.assigneeId === item.assigneeId && choice.scopeType === "PROJECT")?.projectId || "" : "",
      assigneeId: item.assigneeId || currentUserId,
    });
  };

  const openTaskEditor = (item: DepartmentItemCenterItem) => {
    openTaskDetail(item);
    setIsEditingTask(true);
  };

  const beginTaskEdit = () => {
    if (!selectedTask) return;
    const attachments = parseTaskAttachmentsFromContent(selectedTask.content);
    setEditTaskAttachments(attachments);
    setEditTaskOriginalAttachments(attachments);
    setEditForm({
      title: selectedTask.title,
      content: stripTaskAttachmentsFromContent(selectedTask.content),
      dueAt: formatDateTimeLocalFromIso(selectedTask.dueDate),
      scopeType: selectedTask.scopeType === "PROJECT" ? "PROJECT" : selectedTask.scopeType === "DEPARTMENT" ? "DEPARTMENT" : "PERSONAL",
      projectId: selectedTask.scopeType === "PROJECT" ? taskAssigneeChoices.find((choice) => choice.assigneeId === selectedTask.assigneeId && choice.scopeType === "PROJECT")?.projectId || "" : "",
      assigneeId: selectedTask.assigneeId || currentUserId,
    });
    setIsEditingTask(true);
  };

  const cleanupPendingEditTaskAttachments = async () => {
    const originalUrls = new Set(editTaskOriginalAttachments.map((attachment) => attachment.fileUrl));
    const uploadedDuringEdit = editTaskAttachments.filter((attachment) => !originalUrls.has(attachment.fileUrl));
    if (uploadedDuringEdit.length === 0) return;

    try {
      await Promise.all(
        uploadedDuringEdit.map((attachment) =>
          fetch("/api/upload", {
            method: "DELETE",
            body: JSON.stringify({ fileUrl: attachment.fileUrl }),
            headers: { "Content-Type": "application/json" },
          })
        )
      );
    } catch (error) {
      console.error("Failed to cleanup edit task attachments:", error);
    }
  };

  const cancelTaskEdit = async () => {
    await editTaskContentEditorRef.current?.discardPendingUploads();
    await cleanupPendingEditTaskAttachments();
    setEditTaskAttachments(editTaskOriginalAttachments);
    setIsEditingTask(false);
  };

  const saveTaskEdits = async () => {
    if (!selectedTask) return;
    return updateReminderTask(selectedTask.id, {
      title: editForm.title,
      content: appendTaskAttachmentsToContent(editForm.content, editTaskAttachments),
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
        const nextContent = appendTaskAttachmentsToContent(editForm.content, editTaskAttachments);
        const taskResult = await saveTaskEdits();
        if (!taskResult?.success) {
          setDetailError(taskResult?.error || "Failed");
          return;
        }
        editTaskContentEditorRef.current?.commitPendingUploads();
        setEditTaskOriginalAttachments(editTaskAttachments);
        setSelectedTaskSnapshot((current) =>
          current && current.id === selectedTask.id
            ? { ...current, title: editForm.title, content: nextContent, dueDate: editForm.dueAt || null }
            : current
        );
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

  const requestDeleteTask = (targetTask = selectedTask) => {
    if (!targetTask || !targetTask.canEdit) return;
    setDetailError("");
    setTaskPendingDelete(targetTask);
  };

  const handleDeleteTask = () => {
    const targetTask = taskPendingDelete;
    if (!targetTask || !targetTask.canEdit) return;
    if (targetTask.id !== selectedTask?.id) {
      setSelectedTaskId(null);
      setSelectedTaskSnapshot(null);
    }
    setDetailError("");
    startTransition(async () => {
      const result = await deleteReminderTask(targetTask.id);
      if (!result.success) {
        setDetailError(result.error || "Failed");
        return;
      }
      setTaskPendingDelete(null);
      setSelectedTaskId((current) => current === targetTask.id ? null : current);
      router.refresh();
    });
  };

  const handleDeleteScheduleItem = () => {
    if (!selectedScheduleItem || selectedScheduleItem.kind !== "REMINDER" || !selectedScheduleItem.canEdit) return;
    const type = getScheduleType(selectedScheduleItem);
    const confirmMessage = type === "meeting" ? st.deleteMeetingConfirm : st.deleteScheduleConfirm;
    if (!window.confirm(confirmMessage)) return;
    setDetailError("");
    startTransition(async () => {
      const result = await deleteReminderItem(selectedScheduleItem.id);
      if (!result.success) {
        setDetailError(result.error || "Failed");
        return;
      }
      setSelectedScheduleItemId(null);
      router.refresh();
    });
  };

  const handleMeetingAttendance = (status: AttendanceStatus) => {
    if (!selectedScheduleItem || !selectedScheduleCanRespond) return;
    setDetailError("");
    startTransition(async () => {
      const result = await updateMeetingAttendance(selectedScheduleItem.id, status, scheduleReplyContent);
      if (!result.success) {
        setDetailError(result.error || "Failed");
        return;
      }
      setScheduleReplyContent("");
      router.refresh();
    });
  };

  const handleSaveScheduleReply = () => {
    if (!selectedScheduleItem || !scheduleReplyContent.trim()) return;
    setDetailError("");
    startTransition(async () => {
      const result = await addReminderComment(selectedScheduleItem.id, scheduleReplyContent);
      if (!result.success) {
        setDetailError(result.error || "Failed");
        return;
      }
      setScheduleReplyContent("");
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

  const saveSelectedNoteNow = async () => {
    if (!selectedNote || selectedNote.deletedAt) return true;

    const splitContent = splitNoteEditorContent(noteForm.content, t.untitledNote);
    if (!splitContent.title.trim()) return true;

    const savedSnapshot = savedNoteSnapshotRef.current?.id === selectedNote.id
      ? savedNoteSnapshotRef.current
      : { id: selectedNote.id, title: selectedNote.title, content: selectedNote.content || "" };

    const hasChanges = noteContentHasUnsavedChanges(splitContent, savedSnapshot);

    if (!hasChanges) {
      setNoteSaveStatus("saved");
      return true;
    }

    setNoteError("");
    setNoteSaveStatus("saving");
    await noteEditorRef.current?.commitPendingUploads();

    const result = await updateNote(selectedNote.id, {
      title: splitContent.title,
      content: splitContent.content,
      isPinned: isNotePinned(selectedNote),
      folderId: selectedNote.folderId,
      departmentId,
      projectId: selectedNote.projectId,
      issueId: selectedNote.issueId,
      taskId: selectedNote.taskId,
    });

    if (!result.success) {
      setNoteError(result.error || "Failed");
      setNoteSaveStatus("error");
      return false;
    }

        savedNoteSnapshotRef.current = {
          id: selectedNote.id,
          title: splitContent.title,
          content: splitContent.content,
        };
        setNoteTitleOverrides((current) => ({ ...current, [selectedNote.id]: splitContent.title }));
        setNoteSavedAt(new Date().toISOString());
    setNoteSaveStatus("saved");
    return true;
  };

  const openCreateNote = () => {
    const currentFolderId = noteFolderFilter.startsWith("folder:")
      ? noteFolderFilter.slice("folder:".length)
      : noteFolderFilter.startsWith("pinned-folder:")
        ? noteFolderFilter.slice("pinned-folder:".length)
        : "";
    const shouldPinNewNote = isPinnedFilter;
    setNoteError("");
    startTransition(async () => {
      const result = await createNote({
        title: t.untitledNote,
        content: "",
        isPinned: shouldPinNewNote,
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
      if (result.noteId) {
        savedNoteSnapshotRef.current = {
          id: result.noteId,
          title: t.untitledNote,
          content: "",
        };
        setNoteSavedAt(new Date().toISOString());
      }
      setNoteForm((current) => ({ ...current, isPinned: shouldPinNewNote }));
      setNoteSaveStatus("saved");
      router.refresh();
    });
  };

  const cleanupTaskAttachments = async () => {
    if (taskAttachments.length === 0) return;

    try {
      await Promise.all(
        taskAttachments.map((attachment) =>
          fetch("/api/upload", {
            method: "DELETE",
            body: JSON.stringify({ fileUrl: attachment.fileUrl }),
            headers: { "Content-Type": "application/json" },
          })
        )
      );
    } catch (error) {
      console.error("Failed to cleanup task attachments:", error);
    }
  };

  const closeCreateTaskDialog = async () => {
    await taskContentEditorRef.current?.discardPendingUploads();
    await cleanupTaskAttachments();
    setTaskAttachments([]);
    setIsCreateOpen(false);
  };

  const handleTaskAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setError(locale === "zh" ? "附件大小不能超过 50 MB" : "File size cannot exceed 50 MB");
      event.target.value = "";
      return;
    }

    setError("");
    setIsTaskAttachmentUploading(true);
    const data = new FormData();
    data.append("file", file);
    data.append("departmentId", departmentId);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        setError(errorData?.error || (locale === "zh" ? "上传附件失败" : "Failed to upload attachment"));
        return;
      }

      const result = await response.json();
      setTaskAttachments((current) => [
        ...current,
        { id: `${Date.now()}-${result.fileUrl}`, fileName: result.fileName, fileUrl: result.fileUrl, fileSize: file.size },
      ]);
    } catch (error) {
      console.error("Failed to upload task attachment:", error);
      setError(locale === "zh" ? "上传附件失败" : "Failed to upload attachment");
    } finally {
      setIsTaskAttachmentUploading(false);
      event.target.value = "";
    }
  };

  const removeTaskAttachment = async (attachmentId: string) => {
    const attachment = taskAttachments.find((item) => item.id === attachmentId);
    if (!attachment) return;

    setTaskAttachments((current) => current.filter((item) => item.id !== attachmentId));
    try {
      await fetch("/api/upload", {
        method: "DELETE",
        body: JSON.stringify({ fileUrl: attachment.fileUrl }),
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Failed to delete task attachment:", error);
    }
  };

  const handleEditTaskAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setDetailError(locale === "zh" ? "附件大小不能超过 50 MB" : "File size cannot exceed 50 MB");
      event.target.value = "";
      return;
    }

    setDetailError("");
    setIsEditTaskAttachmentUploading(true);
    const data = new FormData();
    data.append("file", file);
    data.append("departmentId", departmentId);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        setDetailError(errorData?.error || (locale === "zh" ? "上传附件失败" : "Failed to upload attachment"));
        return;
      }

      const result = await response.json();
      setEditTaskAttachments((current) => [
        ...current,
        { id: `${Date.now()}-${result.fileUrl}`, fileName: result.fileName, fileUrl: result.fileUrl, fileSize: file.size },
      ]);
    } catch (error) {
      console.error("Failed to upload edit task attachment:", error);
      setDetailError(locale === "zh" ? "上传附件失败" : "Failed to upload attachment");
    } finally {
      setIsEditTaskAttachmentUploading(false);
      event.target.value = "";
    }
  };

  const removeEditTaskAttachment = async (attachmentId: string) => {
    const attachment = editTaskAttachments.find((item) => item.id === attachmentId);
    if (!attachment) return;

    setEditTaskAttachments((current) => current.filter((item) => item.id !== attachmentId));

    const isOriginalAttachment = editTaskOriginalAttachments.some((item) => item.fileUrl === attachment.fileUrl);
    if (isOriginalAttachment) return;

    try {
      await fetch("/api/upload", {
        method: "DELETE",
        body: JSON.stringify({ fileUrl: attachment.fileUrl }),
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Failed to delete edit task attachment:", error);
    }
  };

  const buildTaskContentWithAttachments = () => appendTaskAttachmentsToContent(form.content, taskAttachments);

  const openEditNote = (note: NoteListItem) => {
    void saveSelectedNoteNow();
    setSelectedNoteId(note.id);
    setIsNoteFullscreen(false);
    savedNoteSnapshotRef.current = {
      id: note.id,
      title: note.title,
      content: note.content || "",
    };
    setNoteSavedAt(note.updatedAt);
    setNoteSaveStatus("saved");
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

  const handleNoteContentChange = (value: string) => {
    if (selectedNote) {
      const splitContent = splitNoteEditorContent(value, t.untitledNote);
      const savedSnapshot = savedNoteSnapshotRef.current?.id === selectedNote.id
        ? savedNoteSnapshotRef.current
        : { id: selectedNote.id, title: selectedNote.title, content: selectedNote.content || "" };

      setNoteSaveStatus(noteContentHasUnsavedChanges(splitContent, savedSnapshot) ? "pending" : "saved");
      setNoteTitleOverrides((current) => ({ ...current, [selectedNote.id]: splitContent.title }));
    } else {
      setNoteSaveStatus("saved");
    }
    setNoteForm((current) => ({ ...current, content: value }));
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
      setSelectedNoteId((current) => {
        if (current !== targetNote.id) return current;
        savedNoteSnapshotRef.current = null;
        setNoteSaveStatus("saved");
        return null;
      });
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
      setSelectedNoteId((current) => {
        if (current !== targetNote.id) return current;
        savedNoteSnapshotRef.current = null;
        setNoteSaveStatus("saved");
        return null;
      });
      router.refresh();
    });
  };

  const handleEmptyNoteTrash = () => {
    if (trashedNotes.length === 0) return;
    if (!window.confirm(t.emptyTrashConfirm)) return;
    setNoteError("");
    startTransition(async () => {
      const result = await emptyNoteTrash(departmentId);
      if (!result.success) {
        setNoteError(result.error || "Failed");
        return;
      }
      savedNoteSnapshotRef.current = null;
      setSelectedNoteId(null);
      setNoteSaveStatus("saved");
      router.refresh();
    });
  };

  const handleToggleNotePinned = (targetNote = selectedNote) => {
    if (!targetNote || targetNote.deletedAt) return;

    const nextPinned = !isNotePinned(targetNote);
    const splitContent = targetNote.id === selectedNote?.id
      ? splitNoteEditorContent(noteForm.content, t.untitledNote)
      : { title: targetNote.title, content: targetNote.content || "" };

    setPinnedNoteOverrides((current) => ({ ...current, [targetNote.id]: nextPinned }));
    if (targetNote.id === selectedNote?.id) {
      setNoteForm((current) => ({ ...current, isPinned: nextPinned }));
    }
    setNoteError("");

    startTransition(async () => {
      const result = await updateNote(targetNote.id, {
        title: splitContent.title,
        content: splitContent.content,
        isPinned: nextPinned,
        folderId: targetNote.folderId,
        departmentId,
        projectId: targetNote.projectId,
        issueId: targetNote.issueId,
        taskId: targetNote.taskId,
      });

      if (!result.success) {
        setPinnedNoteOverrides((current) => ({ ...current, [targetNote.id]: !nextPinned }));
        if (targetNote.id === selectedNote?.id) {
          setNoteForm((current) => ({ ...current, isPinned: !nextPinned }));
        }
        setNoteError(result.error || "Failed");
        return;
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
      if (noteFolderFilter === `folder:${folder.id}` || noteFolderFilter === `pinned-folder:${folder.id}`) setNoteFolderFilter("all");
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
        isPinned: isNotePinned(note),
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

    const savedSnapshot = savedNoteSnapshotRef.current?.id === selectedNote.id
      ? savedNoteSnapshotRef.current
      : { id: selectedNote.id, title: selectedNote.title, content: selectedNote.content || "" };

    const hasChanges = noteContentHasUnsavedChanges(splitContent, savedSnapshot);

    if (!hasChanges) {
      setNoteSaveStatus("saved");
      return;
    }

    setNoteSaveStatus("pending");

    const timer = window.setTimeout(() => {
      setNoteError("");
      setNoteSaveStatus("saving");
      startTransition(async () => {
        await noteEditorRef.current?.commitPendingUploads();
        const result = await updateNote(selectedNote.id, {
          title: splitContent.title,
          content: splitContent.content,
          isPinned: isNotePinned(selectedNote),
          folderId: selectedNote.folderId,
          departmentId,
          projectId: selectedNote.projectId,
          issueId: selectedNote.issueId,
          taskId: selectedNote.taskId,
        });

        if (!result.success) {
          setNoteError(result.error || "Failed");
          setNoteSaveStatus("error");
          return;
        }

        savedNoteSnapshotRef.current = {
          id: selectedNote.id,
          title: splitContent.title,
          content: splitContent.content,
        };
        setNoteTitleOverrides((current) => ({ ...current, [selectedNote.id]: splitContent.title }));
        setNoteSavedAt(new Date().toISOString());
        setNoteSaveStatus("saved");
      });
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [
    departmentId,
    noteForm.content,
    pinnedNoteOverrides,
    selectedNote,
    startTransition,
    t.untitledNote,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && noteSaveStatus === "pending") {
        void saveSelectedNoteNow();
      }
    };
    const handleBeforeUnload = () => {
      if (noteSaveStatus === "pending") {
        void saveSelectedNoteNow();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [noteSaveStatus, noteForm.content, selectedNote, pinnedNoteOverrides]);

  const handleTaskSort = (field: TaskSortField) => {
    if (taskSortField === field) {
      setTaskSortDirection((current) => current === "asc" ? "desc" : "asc");
      setTaskPage(1);
      return;
    }

    setTaskSortField(field);
    setTaskSortDirection(field === "createdAt" ? "desc" : "asc");
    setTaskPage(1);
  };

  const renderTaskHeaderLabel = (column: TaskColumnConfig) => {
    const sortField = TASK_COLUMN_SORT_FIELD_MAP[column.id];
    const isSorted = Boolean(sortField) && taskSortField === sortField;
    const updateMultiFilter = (setter: (value: string[]) => void, value: string[]) => {
      setter(value);
      setTaskPage(1);
    };
    let filterControl = null;

    if (column.id === "dueDate") {
      filterControl = (
        <TaskDateFilter
          label={taskTableText.dueDate}
          value={taskDueDateFilter}
          date={taskDueDateValue}
          options={taskDueDateOptions}
          onChange={(value) => {
            setTaskDueDateFilter(value as TaskDueDateFilter);
            if (value === "ALL") setTaskDueDateValue("");
            setTaskPage(1);
          }}
          onDateChange={(value) => {
            setTaskDueDateValue(value);
            setTaskPage(1);
          }}
        />
      );
    } else if (column.id === "creator") {
      filterControl = (
        <TaskMultiFilter
          label={t.openedBy}
          values={taskCreatorIds}
          options={taskCreatorOptions}
          allLabel={taskTableText.all}
          locale={locale}
          onChange={(value) => updateMultiFilter(setTaskCreatorIds, value)}
        />
      );
    } else if (column.id === "status") {
      filterControl = (
        <TaskMultiFilter
          label={t.status}
          values={taskStatuses}
          options={taskStatusOptions}
          allLabel={taskTableText.all}
          locale={locale}
          onChange={(value) => updateMultiFilter(setTaskStatuses, value)}
        />
      );
    } else if (column.id === "assignee") {
      filterControl = (
        <TaskMultiFilter
          label={t.assignee}
          values={taskAssigneeIds}
          options={taskAssigneeOptions}
          allLabel={taskTableText.all}
          locale={locale}
          onChange={(value) => updateMultiFilter(setTaskAssigneeIds, value)}
        />
      );
    }

    return (
      <div
        className={`flex max-w-full min-w-0 items-center gap-1 ${column.id === "actions" ? "ml-auto justify-between" : ""}`}
        style={column.id === "actions" ? { width: `${taskActionColumnWidth - LIST_ACTION_COLUMN_PADDING_X * 2}px` } : undefined}
      >
        <button
          type="button"
          onClick={() => {
            if (sortField) handleTaskSort(sortField);
          }}
          disabled={!sortField}
          className={`inline-flex shrink-0 items-center gap-1 font-semibold ${
            sortField
              ? "cursor-pointer text-muted-foreground hover:text-foreground"
              : column.id === "actions"
                ? "cursor-default text-muted-foreground"
                : "cursor-move text-muted-foreground"
          }`}
          draggable={false}
        >
          <span className="whitespace-nowrap">{column.label}</span>
          {sortField && isSorted ? (
            taskSortDirection === "asc" ? (
              <ArrowUp size={12} />
            ) : (
              <ArrowDown size={12} />
            )
          ) : null}
        </button>
        {filterControl}
        {column.id === "actions" ? renderTaskColumnMenu() : null}
      </div>
    );
  };

  const renderTaskColumnMenu = () => {
    const visibleCount = taskVisibleColumnIds.length;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="ml-auto shrink-0 border-0 bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] shadow-none hover:bg-muted group-hover/column:bg-muted"
            aria-label={taskTableText.columns}
            title={taskTableText.columns}
          >
            <Eye className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-60">
          <DropdownMenuLabel className="flex items-center justify-between gap-3">
            <span>{taskTableText.columns}</span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
              {visibleCount}/{taskConfigurableColumns.length}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {taskConfigurableColumns.map((column) => {
            const isChecked = taskVisibleColumnIds.includes(column.id);
            const isDisabled = isChecked && visibleCount === 1;

            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={isChecked}
                disabled={isDisabled}
                onCheckedChange={() => handleToggleTaskColumnVisibility(column.id)}
                onSelect={(event) => event.preventDefault()}
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            );
          })}
          <DropdownMenuSeparator />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetTaskColumns}
            className="w-full justify-start text-primary hover:text-primary"
          >
            {taskTableText.resetColumns}
          </Button>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderTaskRow = (item: DepartmentItemCenterItem) => (
    <tr key={item.id} className="group transition-colors hover:bg-muted/40">
      {displayedTaskDataColumns.map((column) => {
        if (column.id === "title") {
          return (
            <td key={column.id} className="overflow-hidden px-5 py-4 font-semibold text-foreground">
              <button type="button" onClick={() => openTaskDetail(item)} className="flex w-full min-w-0 items-center gap-2 text-left hover:text-primary">
                <span className={`truncate ${item.completedAt ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {item.title}
                </span>
                {item.isImportant ? <Star size={13} className="shrink-0 fill-amber-400 text-amber-400" /> : null}
              </button>
            </td>
          );
        }

        if (column.id === "content") {
          return (
            <td key={column.id} className="overflow-hidden whitespace-normal px-5 py-4 align-top text-muted-foreground">
              <button type="button" onClick={() => openTaskDetail(item)} className="block w-full text-left">
                {item.content ? (
                  <span className="block overflow-hidden text-xs leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                    {notePreview(item.content)}
                  </span>
                ) : null}
              </button>
            </td>
          );
        }

        if (column.id === "dueDate") {
          return (
            <td key={column.id} className={`overflow-hidden px-5 py-4 text-xs font-medium ${item.isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
              <span className="block truncate">{item.dueDate ? formatDisplayDate(item.dueDate) : ""}</span>
            </td>
          );
        }

        if (column.id === "createdAt") {
          return (
            <td key={column.id} className="overflow-hidden px-5 py-4 text-xs font-medium text-muted-foreground">
              <span className="block truncate" title={formatFullDateTime(item.createdAt, locale)}>
                {formatListDateTime(item.createdAt)}
              </span>
            </td>
          );
        }

        if (column.id === "creator") {
          return (
            <td key={column.id} className="overflow-hidden px-5 py-4 text-sm font-medium text-foreground">
              <span className="block w-full truncate">{item.creatorName || item.creatorEmail || "-"}</span>
            </td>
          );
        }

        if (column.id === "status") {
          return (
            <td key={column.id} className="overflow-hidden px-5 py-4">
              <Badge variant={item.completedAt ? "secondary" : "outline"} className={item.completedAt ? "bg-emerald-50 text-emerald-700" : ""}>
                {taskStatusLabel(item.taskStatus, locale)}
              </Badge>
            </td>
          );
        }

        if (column.id === "assignee") {
          return (
            <td key={column.id} className="overflow-hidden px-5 py-4 text-sm font-medium text-foreground">
              <span className="block w-full truncate">{item.assigneeName || item.assigneeEmail || t.unassigned}</span>
            </td>
          );
        }

        return null;
      })}
      <td aria-hidden className="p-0" />
      {displayedTaskActionColumn ? (
        <td
          className="sticky right-0 z-10 overflow-hidden bg-card py-4 text-left whitespace-nowrap shadow-[-6px_0_8px_-8px_rgba(15,23,42,0.45)] group-hover:bg-muted/40"
          style={{ width: taskActionColumnWidth, minWidth: taskActionColumnWidth, paddingInline: LIST_ACTION_COLUMN_PADDING_X }}
        >
          <div className="inline-flex items-center" style={{ gap: LIST_ACTION_BUTTON_GAP }}>
            {item.canEdit ? (
              <>
                <Button type="button" size="icon-xs" variant="outline" onClick={() => openTaskEditor(item)} aria-label={t.edit} title={t.edit}>
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => requestDeleteTask(item)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t.deleteTask}
                  title={t.deleteTask}
                >
                  <Trash2 />
                </Button>
              </>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
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
          {item.content ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{notePreview(item.content)}</p> : null}
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

  const scheduleRangeStart = scheduleView === "week"
    ? startOfWeek(scheduleCursor, { weekStartsOn: 1 })
    : startOfWeek(startOfMonth(scheduleCursor), { weekStartsOn: 1 });
  const scheduleRangeEnd = scheduleView === "week"
    ? endOfWeek(scheduleCursor, { weekStartsOn: 1 })
    : endOfWeek(endOfMonth(scheduleCursor), { weekStartsOn: 1 });
  const scheduleDays = eachDayOfInterval({ start: scheduleRangeStart, end: scheduleRangeEnd });
  const weekTitleStartOptions: Intl.DateTimeFormatOptions =
    scheduleRangeStart.getFullYear() === scheduleRangeEnd.getFullYear()
      ? { month: "short", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  const weekTitleEndOptions: Intl.DateTimeFormatOptions =
    scheduleRangeStart.getFullYear() === scheduleRangeEnd.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  const scheduleTitle = scheduleView === "week"
    ? `${scheduleRangeStart.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", weekTitleStartOptions)} - ${scheduleRangeEnd.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", weekTitleEndOptions)}`
    : scheduleCursor.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "long", year: "numeric" });
  const visibleRangeCalendarItems = calendarItems.filter((item) => {
    const itemDate = new Date(item.date);
    return itemDate >= scheduleRangeStart && itemDate <= scheduleRangeEnd;
  });
  const scheduleTypes: Array<{ id: ScheduleType; label: string }> = [
    { id: "meeting", label: st.meetings },
    { id: "out", label: st.outOfOffice },
    { id: "reminder", label: st.reminders },
    { id: "memo", label: st.memos },
  ];

  const moveScheduleCursor = (direction: "previous" | "next") => {
    setScheduleCursor((current) => {
      if (scheduleView === "week") {
        const weekAnchor = startOfWeek(current, { weekStartsOn: 1 });
        return direction === "previous" ? subWeeks(weekAnchor, 1) : addWeeks(weekAnchor, 1);
      }
      return direction === "previous" ? subMonths(current, 1) : addMonths(current, 1);
    });
  };

  const openScheduleItem = (item: DepartmentItemCenterItem) => {
    if (item.kind === "ISSUE_DUE") {
      setSelectedNoteIssueId(item.id);
      setSelectedScheduleItemId(null);
      setScheduleOverflowDate(null);
      return;
    }
    if (item.itemType === "TODO") {
      openTaskDetail(item);
      return;
    }
    setDetailError("");
    setSelectedScheduleItemId(item.id);
  };

  const openEarliestPendingMeeting = () => {
    const earliestPendingMeeting = pendingMeetingItems[0];
    if (!earliestPendingMeeting) return;
    setScheduleOverflowDate(null);
    openScheduleItem(earliestPendingMeeting);
  };

  const renderScheduleChip = (item: DepartmentItemCenterItem, compact = false, maxTitleLines = 1) => {
    const type = getScheduleType(item);
    const myAttendance = type === "meeting" ? item.attendees.find((attendee) => attendee.userId === currentUserId) : null;
    const needsConfirmation = myAttendance?.status === "PENDING" || myAttendance?.status === "TENTATIVE";
    const time = scheduleView === "week" && !compact
      ? ""
      : scheduleTimeLabel(item, locale, scheduleView === "month");
    const title = item.kind === "ISSUE_DUE" && item.issueKey ? `${item.issueKey} ${item.title}` : item.title;
    const titleStyle = compact
      ? undefined
      : {
          display: "-webkit-box",
          WebkitBoxOrient: "vertical" as const,
          WebkitLineClamp: maxTitleLines,
          overflow: "hidden",
        };
    const content = (
      <>
        {type === "reminder" ? <Bell size={compact ? 10 : 12} className="shrink-0" /> : null}
        {needsConfirmation ? <UserCheck size={compact ? 10 : 12} className="shrink-0" /> : null}
        <span className={compact ? "truncate" : "min-w-0 whitespace-normal"} style={titleStyle}>
          {time ? `${time} · ${title}` : title}
        </span>
        {needsConfirmation ? <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-destructive ring-1 ring-background" /> : null}
      </>
    );
    const timedPaddingClass = maxTitleLines >= 6 ? "py-3" : maxTitleLines >= 3 ? "py-2" : "py-1";
    const timedAlignmentClass = maxTitleLines >= 3 ? "items-center" : "items-start";
    const chipClassName = `relative flex min-h-6 w-full min-w-0 gap-1 rounded-md border border-transparent border-l-2 px-1.5 text-left text-[11px] font-semibold leading-[13px] transition-colors hover:border-border ${compact ? "items-center py-1" : `h-full overflow-hidden ${timedAlignmentClass} ${timedPaddingClass}`} ${scheduleChipClass(type)}`;

    return (
      <button
        key={`${item.kind}-${item.id}`}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          openScheduleItem(item);
        }}
        className={chipClassName}
      >
        {content}
      </button>
    );
  };

  const selectedAttendees = assigneeOptions.filter((assignee) => form.attendeeIds.includes(assignee.id));
  const attendeeMatches = assigneeOptions
    .filter((assignee) => !form.attendeeIds.includes(assignee.id))
    .filter((assignee) => {
      const query = form.attendeeQuery.trim().toLowerCase();
      if (!query) return true;
      return `${assignee.name} ${assignee.email}`.toLowerCase().includes(query);
    })
    .slice(0, 5);

  const addAttendee = (assigneeId: string) => {
    setForm((current) => ({
      ...current,
      attendeeIds: current.attendeeIds.includes(assigneeId) ? current.attendeeIds : [...current.attendeeIds, assigneeId],
      attendeeQuery: "",
    }));
  };

  const removeAttendee = (assigneeId: string) => {
    setForm((current) => ({ ...current, attendeeIds: current.attendeeIds.filter((id) => id !== assigneeId) }));
  };

  const handleAttendeeInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!form.attendeeQuery.trim() || attendeeMatches.length === 0) {
      if (event.key === "Enter") event.preventDefault();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveAttendeeMatchIndex((current) => (current + 1) % attendeeMatches.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveAttendeeMatchIndex((current) => (current - 1 + attendeeMatches.length) % attendeeMatches.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      addAttendee(attendeeMatches[Math.min(activeAttendeeMatchIndex, attendeeMatches.length - 1)].id);
    }
  };

  const scheduleKindOptions = [
    { value: "meeting", label: st.meeting, indicatorClassName: scheduleDotClass("meeting") },
    { value: "out", label: st.out, indicatorClassName: scheduleDotClass("out") },
    { value: "memo", label: st.memo, indicatorClassName: scheduleDotClass("memo") },
  ];

  const handleScheduleKindChange = (value: string) => {
    const nextKind = value as ScheduleCreateKind;
    setForm((current) => ({
      ...current,
      scheduleKind: nextKind,
      scopeType: nextKind === "memo" ? "PERSONAL" : "DEPARTMENT",
      attendeeIds: nextKind === "meeting" ? current.attendeeIds : [],
      hasTime: nextKind === "memo" ? true : current.hasTime,
      startTime: nextKind === "memo" ? "07:00" : current.startTime,
      endTime: nextKind === "memo" ? "22:00" : current.endTime,
    }));
  };

  const selectedScheduleDetails = selectedScheduleItem ? parseScheduleDetails(selectedScheduleItem.content) : null;
  const selectedScheduleType = selectedScheduleItem ? getScheduleType(selectedScheduleItem) : null;
  const selectedScheduleIsMemo = selectedScheduleType === "memo";
  const selectedScheduleVisibilityLabel = selectedScheduleItem?.scopeType === "DEPARTMENT" ? st.publicMemo : st.privateMemo;
  const selectedScheduleParticipants = selectedScheduleItem
    ? selectedScheduleItem.attendees.length > 0
      ? selectedScheduleItem.attendees.map((attendee) => ({
          id: attendee.userId,
          name: attendee.userName || attendee.userEmail,
          email: attendee.userEmail,
          isCreator: attendee.userId === selectedScheduleItem.creatorId,
          status: attendee.status,
          note: attendee.note,
          respondedAt: attendee.respondedAt,
        }))
      : [
          {
            id: selectedScheduleItem.creatorId || "creator",
            name: selectedScheduleItem.creatorName || selectedScheduleItem.creatorEmail || "-",
            email: selectedScheduleItem.creatorEmail || "",
            isCreator: true,
            status: "CONFIRMED",
            note: null,
            respondedAt: null,
          },
          ...(selectedScheduleDetails?.participantNames || [])
            .filter((name) => {
              const creatorLabel = (selectedScheduleItem.creatorName || selectedScheduleItem.creatorEmail || "").toLowerCase();
              return name.toLowerCase() !== creatorLabel;
            })
            .map((name) => {
              const normalizedName = name.toLowerCase();
              const assignee = assigneeOptions.find((option) =>
                option.name.toLowerCase() === normalizedName ||
                option.email.toLowerCase() === normalizedName
              );
              return {
                id: assignee?.id || `guest:${name}`,
                name: assignee?.name || name,
                email: assignee?.email || "",
                isCreator: false,
                status: "PENDING",
                note: null,
                respondedAt: null,
              };
            }),
        ]
    : [];
  const selectedScheduleMyAttendance = selectedScheduleItem?.attendees.find((attendee) => attendee.userId === currentUserId) || null;
  const selectedScheduleConfirmedCount = selectedScheduleParticipants.filter((participant) => participant.status === "CONFIRMED").length;
  const selectedScheduleCanRespond = Boolean(selectedScheduleItem && selectedScheduleType === "meeting" && selectedScheduleMyAttendance);
  const selectedScheduleCanComment = Boolean(
    selectedScheduleItem &&
    selectedScheduleType === "meeting" &&
    (selectedScheduleItem.creatorId === currentUserId || selectedScheduleMyAttendance || selectedScheduleItem.canEdit)
  );

  const renderScheduleCreateDialog = () => (
    <DialogContent className="flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden p-0 sm:max-w-[600px]">
      <DialogHeader className="shrink-0 border-b bg-muted/35 px-6 py-4 pr-12">
        <DialogTitle className="text-xl">{editingScheduleItem ? t.edit : locale === "zh" ? "新建日程" : "New schedule"}</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={handleCreate}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target instanceof HTMLElement && event.target.tagName !== "TEXTAREA") {
            event.preventDefault();
          }
        }}
      >
        <div className="max-h-[calc(100vh-220px)] space-y-6 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="scheduleTitle">{t.titleField}</Label>
            <Input
              id="scheduleTitle"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={form.scheduleKind === "out" ? (locale === "zh" ? "添加外出标题" : "Add out-of-office title") : form.scheduleKind === "memo" ? (locale === "zh" ? "添加备忘标题" : "Add memo title") : st.addMeetingTitle}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scheduleKind">{t.type}</Label>
              <Select value={form.scheduleKind} onValueChange={handleScheduleKindChange}>
                <SelectTrigger id="scheduleKind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scheduleKindOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="inline-flex items-center gap-2">
                        <span className={`size-2.5 rounded-full ${option.indicatorClassName}`} />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.scheduleKind !== "memo" ? (
              <div className="space-y-2">
              <Label htmlFor="scheduleLocation">{st.location}</Label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="scheduleLocation"
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                  className="pl-9"
                  placeholder={locale === "zh" ? "会议室 / 地点" : "Room or location"}
                />
              </div>
            </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="scheduleMemoVisibility">{st.visibility}</Label>
                  <Select
                    value={form.scopeType === "DEPARTMENT" ? "DEPARTMENT" : "PERSONAL"}
                    onValueChange={(value) => setForm((current) => ({ ...current, scopeType: value as "PERSONAL" | "DEPARTMENT" | "PROJECT" }))}
                  >
                    <SelectTrigger id="scheduleMemoVisibility" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {canCreateDepartmentItem ? <SelectItem value="DEPARTMENT">{st.publicMemo}</SelectItem> : null}
                      <SelectItem value="PERSONAL">{st.privateMemo}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {form.scheduleKind !== "memo" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <ShadcnDatePicker
                  id="scheduleDate"
                  label={st.date}
                  locale={locale}
                  value={form.scheduleDate}
                  onChange={(scheduleDate) => setForm((current) => ({ ...current, scheduleDate }))}
                  className="space-y-2"
                  required
                />
              <LocalizedTimeInput
                id="scheduleStartTime"
                label={st.startTime}
                value={form.startTime}
                onChange={(value) => setForm((current) => ({ ...current, startTime: value }))}
                locale={locale}
                required
              />
              <LocalizedTimeInput
                id="scheduleEndTime"
                label={st.endTime}
                value={form.endTime}
                onChange={(value) => setForm((current) => ({ ...current, endTime: value }))}
                locale={locale}
                maxTime="22:00"
                required
              />
          </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <ShadcnDatePicker
                id="scheduleMemoDate"
                label={st.date}
                locale={locale}
                value={form.scheduleDate}
                onChange={(scheduleDate) => setForm((current) => ({ ...current, scheduleDate }))}
                className="space-y-2"
                required
              />
              <LocalizedTimeInput
                id="scheduleMemoStartTime"
                label={st.startTime}
                value={form.startTime}
                onChange={(value) => setForm((current) => ({ ...current, startTime: value }))}
                locale={locale}
                required
              />
              <LocalizedTimeInput
                id="scheduleMemoEndTime"
                label={st.endTime}
                value={form.endTime}
                onChange={(value) => setForm((current) => ({ ...current, endTime: value }))}
                locale={locale}
                maxTime="22:00"
                required
              />
            </div>
          )}

          {form.scheduleKind === "meeting" ? <div className="space-y-2">
            <Label>{st.participants}</Label>
            <div className="rounded-md border bg-background p-2">
              <div className="flex min-h-8 flex-wrap gap-2">
                {selectedAttendees.map((attendee) => (
                  <span key={attendee.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-xs text-foreground">
                    <img src={attendeeAvatarSrc(attendee.id)} alt="" className="h-4 w-4 rounded-full border" />
                    {attendee.name || attendee.email}
                    <button type="button" onClick={() => removeAttendee(attendee.id)} className="text-muted-foreground hover:text-destructive">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  value={form.attendeeQuery}
                  onChange={(event) => setForm((current) => ({ ...current, attendeeQuery: event.target.value }))}
                  onKeyDown={handleAttendeeInputKeyDown}
                  placeholder={locale === "zh" ? (selectedAttendees.length > 0 ? "添加参会人" : "输入@选择参会人或直接输入姓名") : st.addGuest}
                  className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none"
                />
              </div>
              {form.attendeeQuery.trim() && attendeeMatches.length > 0 ? (
                <div className="mt-2 border-t pt-2">
                  {attendeeMatches.map((attendee, index) => (
                    <button
                      key={attendee.id}
                      type="button"
                      onMouseEnter={() => setActiveAttendeeMatchIndex(index)}
                      onClick={() => addAttendee(attendee.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground ${
                        index === activeAttendeeMatchIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <img src={attendeeAvatarSrc(attendee.id)} alt="" className="h-6 w-6 rounded-full border" />
                      <span className="min-w-0 truncate">{attendee.name || attendee.email}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div> : null}

          <div className="space-y-2">
            <Label htmlFor="scheduleNotes">{st.meetingMinutes}</Label>
            <Textarea
              id="scheduleNotes"
              value={form.meetingMinutes}
              onChange={(event) => setForm((current) => ({ ...current, meetingMinutes: event.target.value }))}
              placeholder={st.agendaPlaceholder}
              rows={form.scheduleKind === "memo" ? 12 : 10}
            />
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t bg-muted/35 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsCreateOpen(false);
              setEditingScheduleItemId(null);
            }}
          >
            {t.cancel}
          </Button>
          <Button type="submit" disabled={isPending}>
            {editingScheduleItem ? t.save : st.create}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );

  const renderScheduleWorkspace = () => (
    <div className="h-[calc(100vh-112px)] min-h-[640px] overflow-hidden rounded-xl border bg-card lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col border-r bg-muted/25 p-4 lg:flex">
        <div className="space-y-1">
          {scheduleTypes.map((type) => {
            const checkboxId = `${scheduleFilterIdPrefix}-${type.id}`;
            return (
              <div
                key={type.id}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <label htmlFor={checkboxId} className="flex min-w-0 cursor-pointer items-center gap-2">
                  <Checkbox
                    id={checkboxId}
                    checked={visibleScheduleTypes[type.id]}
                    onCheckedChange={(checked) => setVisibleScheduleTypes((current) => ({ ...current, [type.id]: checked === true }))}
                  />
                  <span>{type.label}</span>
                  <span className={`h-3 w-3 shrink-0 rounded-full ${scheduleDotClass(type.id)}`} />
                </label>
                {type.id === "meeting" && pendingMeetingCount > 0 ? (
                  <Badge variant="destructive" asChild className="ml-auto rounded-md px-1.5 py-0 text-[11px]">
                    <button type="button" onClick={openEarliestPendingMeeting}>
                      {locale === "zh" ? `${st.pendingMeetings}${pendingMeetingCount}` : `${st.pendingMeetings} ${pendingMeetingCount}`}
                    </button>
                  </Badge>
                ) : (
                  <span className="ml-auto" />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-6 border-t pt-5">
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>{st.todaySummary}</span>
              <span className="font-semibold tabular-nums text-foreground">{todayScheduleCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{scheduleView === "week" ? st.week : st.month}</span>
              <span className="font-semibold tabular-nums text-foreground">{visibleRangeCalendarItems.length}</span>
            </div>
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{scheduleTitle}</h2>
            <div className="flex overflow-hidden rounded-md border bg-background">
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => moveScheduleCursor("previous")} className="rounded-none border-r">
                <ChevronLeft size={16} />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => moveScheduleCursor("next")} className="rounded-none">
                <ChevronRight size={16} />
              </Button>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setScheduleCursor(new Date())}>
              {st.today}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-md border bg-muted p-1">
              {(["week", "month"] as ScheduleView[]).map((nextView) => (
                <button
                  key={nextView}
                  type="button"
                  onClick={() => setScheduleView(nextView)}
                  className={`h-8 rounded-md px-4 text-sm font-medium transition-colors ${scheduleView === nextView ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {nextView === "month" ? st.month : nextView === "week" ? st.week : t.list}
                </button>
              ))}
            </div>
          </div>
        </div>

        {scheduleView === "week" ? (
          <div className="shrink-0 overflow-y-auto bg-background [scrollbar-gutter:stable]">
            <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b">
              <div className="border-r" />
              {scheduleDays.map((date) => {
                const isCurrentDay = isSameDay(date, new Date());
                return (
                  <div
                    key={date.toISOString()}
                    className={`border-r px-3 py-3 text-center last:border-r-0 ${isCurrentDay ? "bg-primary/5" : ""}`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { weekday: "short" })}
                    </div>
                    <div className={`mt-1 text-sm font-semibold ${isCurrentDay ? "text-primary" : "text-foreground"}`}>
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b bg-muted/25">
              <div className="border-r px-0.5 py-0.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {st.noTime}
              </div>
              {scheduleDays.map((date) => {
                const key = format(date, "yyyy-MM-dd");
                const allDayItems = [...(allDayGroupedByDay[key] || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const shownItems = allDayItems.slice(0, 4);
                const isCurrentDay = isSameDay(date, new Date());
                return (
                  <div
                    key={`${key}-all-day`}
                    onClick={() => openCreateScheduleModal(date)}
                    className={`min-h-16 border-r p-0.5 text-left hover:bg-accent/50 last:border-r-0 ${isCurrentDay ? "bg-primary/5" : "bg-background"}`}
                  >
                    <div className="space-y-1">
                      {shownItems.map((item) => renderScheduleChip(item, true))}
                      {allDayItems.length > shownItems.length ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setScheduleOverflowDate(key);
                          }}
                          className="block w-full px-1 text-left text-[11px] font-medium text-muted-foreground hover:text-primary"
                        >
                          +{allDayItems.length - shownItems.length} {st.moreItems}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 overflow-y-auto border-b bg-background [scrollbar-gutter:stable]">
            {scheduleDays.slice(0, 7).map((date) => (
              <div key={date.toISOString()} className="border-r px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-foreground last:border-r-0">
                {date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { weekday: "short" })}
              </div>
            ))}
          </div>
        )}

        {scheduleView === "week" ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-background [scrollbar-gutter:stable]">
            <div
              className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]"
              style={{ height: (WEEK_END_HOUR - WEEK_START_HOUR) * WEEK_HOUR_HEIGHT + WEEK_GRID_TOP_PADDING, paddingTop: WEEK_GRID_TOP_PADDING }}
            >
              <div className="relative border-r bg-muted/25">
                {WEEK_HOURS.slice(0, -1).map((hour) => (
                  <div
                    key={hour}
                    className="absolute right-2 text-[11px] font-medium tabular-nums text-muted-foreground"
                    style={{ top: (hour - WEEK_START_HOUR) * WEEK_HOUR_HEIGHT }}
                  >
                    {`${String(hour).padStart(2, "0")}:00`}
                  </div>
                ))}
              </div>
              {scheduleDays.map((date) => {
                const key = format(date, "yyyy-MM-dd");
                const dayItems = [...(timedGroupedByDay[key] || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const timedRenderItems = getWeekTimedRenderItems(dayItems);
                const isCurrentDay = isSameDay(date, new Date());
                return (
                  <div
                    key={`${key}-time-grid`}
                    className={`relative border-r last:border-r-0 ${isCurrentDay ? "bg-primary/5" : ""}`}
                  >
                    {WEEK_HOURS.slice(0, -1).map((hour) => {
                      const startTime = `${String(hour).padStart(2, "0")}:00`;
                      const endTime = `${String(hour + 1).padStart(2, "0")}:00`;
                      return (
                        <button
                          key={hour}
                          type="button"
                          onClick={() => openCreateScheduleModal(date, startTime, endTime, true)}
                          className="block w-full border-b text-left hover:bg-accent/50"
                          style={{ height: WEEK_HOUR_HEIGHT }}
                          aria-label={`${startTime}-${endTime}`}
                        />
                      );
                    })}
                    {timedRenderItems.map(({ item, layout, laneIndex, laneCount }) => {
                      const columnWidth = 100 / laneCount;
                      const titleLineCount = Math.max(1, Math.floor((layout.height / WEEK_HOUR_HEIGHT) * 3));
                      return (
                        <div
                          key={`${item.kind}-${item.id}`}
                          className="absolute"
                          style={{
                            left: `calc(${laneIndex * columnWidth}% + ${WEEK_EVENT_INSET}px)`,
                            width: `calc(${columnWidth}% - ${WEEK_EVENT_INSET * 2}px)`,
                            top: layout.top + WEEK_EVENT_INSET,
                            height: Math.max(24, layout.height - WEEK_EVENT_INSET * 2),
                          }}
                        >
                          {renderScheduleChip(item, false, titleLineCount)}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ) : scheduleView === "month" ? (
          <div className="grid min-h-0 flex-1 grid-cols-7 auto-rows-[minmax(170px,1fr)] overflow-y-auto bg-background [scrollbar-gutter:stable]">
            {scheduleDays.map((date) => {
              const key = format(date, "yyyy-MM-dd");
              const dayItems = [...(groupedByDay[key] || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              const shownItems = dayItems.slice(0, 4);
              const isCurrentDay = isSameDay(date, new Date());
              const muted = scheduleView === "month" && !isSameMonth(date, scheduleCursor);
              return (
                <div
                  key={key}
                  onClick={() => openCreateScheduleModal(date)}
                  className={`group flex min-h-[170px] cursor-pointer flex-col border-r border-b p-2 text-left hover:bg-accent/50 ${isCurrentDay ? "bg-primary/5 ring-2 ring-inset ring-ring/40" : "bg-background"} ${muted ? "text-muted-foreground/60" : "text-foreground"}`}
                >
                  <div className={`mb-1 text-sm font-semibold ${isCurrentDay ? "text-primary" : ""}`}>
                    {date.getDate()}
                  </div>
                  <div className="min-h-0 w-full space-y-1 overflow-hidden">
                    {shownItems.map((item) => renderScheduleChip(item, true))}
                    {dayItems.length > shownItems.length ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setScheduleOverflowDate(key);
                        }}
                        className="block w-full px-1 text-left text-[11px] font-medium text-muted-foreground hover:text-primary"
                      >
                        +{dayItems.length - shownItems.length} {st.moreItems}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

      </section>

      {scheduleOverflowDate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 px-4" onClick={() => setScheduleOverflowDate(null)}>
          <div
            className="flex max-h-[78vh] w-full max-w-[520px] flex-col overflow-hidden rounded-xl border bg-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="min-w-0 truncate text-base font-semibold text-foreground">{scheduleOverflowTitle}</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setScheduleOverflowDate(null)}
                title={t.cancel}
              >
                <X size={18} />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {scheduleOverflowItems.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">{st.noEvents}</p>
              ) : (
                <div className="divide-y">
                  {scheduleOverflowItems.map((item) => {
                    const type = getScheduleType(item);
                    return (
                      <button
                        key={`${item.kind}-${item.id}`}
                        type="button"
                        onClick={() => {
                          setScheduleOverflowDate(null);
                          openScheduleItem(item);
                        }}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-card px-5 py-3 text-left text-sm transition-colors hover:bg-accent"
                      >
                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${scheduleDotClass(type)}`} />
                            <span className="truncate font-semibold text-foreground">{item.kind === "ISSUE_DUE" && item.issueKey ? `${item.issueKey} ${item.title}` : item.title}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{scheduleTimeLabel(item, locale, true) || st.noTime}</span>
                        </span>
                        <Badge variant="secondary" className="shrink-0 rounded-md">{scheduleTypeLabel(type, locale)}</Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedScheduleItem ? (
        <div className="fixed inset-0 z-50 bg-foreground/30" onClick={() => setSelectedScheduleItemId(null)}>
        <div
          className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l bg-card"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b bg-muted/20 px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`rounded-md ${scheduleBadgeClass(getScheduleType(selectedScheduleItem))}`}>
                  {scheduleTypeLabel(getScheduleType(selectedScheduleItem), locale)}
                </Badge>
                {selectedScheduleIsMemo ? (
                  <Badge variant="secondary" className="rounded-md">
                    {selectedScheduleVisibilityLabel}
                  </Badge>
                ) : null}
              </div>
              <h3 className="mt-3 break-words text-lg font-semibold text-foreground">{selectedScheduleItem.title}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {selectedScheduleItem.kind === "REMINDER" && selectedScheduleItem.canEdit ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEditScheduleItem(selectedScheduleItem)}
                    title={t.edit}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={isPending}
                    onClick={handleDeleteScheduleItem}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    title={st.deleteSchedule}
                  >
                    <Trash2 size={16} />
                  </Button>
                </>
              ) : null}
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSelectedScheduleItemId(null)} title={t.cancel}>
                <X size={18} />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4 text-sm text-foreground">
            {detailError ? <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{detailError}</div> : null}
            <div className={`grid gap-3 text-xs text-muted-foreground ${selectedScheduleIsMemo || !selectedScheduleDetails?.location ? "grid-cols-2" : "grid-cols-3"}`}>
              <div className="flex min-w-0 gap-2">
                <span className="mt-0.5 shrink-0 text-muted-foreground" title={locale === "zh" ? "时间" : "Time"}>
                  <Clock size={14} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-foreground">{scheduleDateLabel(selectedScheduleItem, locale)}</p>
                  <p className="mt-0.5">{scheduleTimeLabel(selectedScheduleItem, locale, true) || st.noTime}</p>
                  {selectedScheduleItem.dueDate ? <p className="text-xs text-muted-foreground">{t.dueDate}: {formatDisplayDate(selectedScheduleItem.dueDate)}</p> : null}
                </div>
              </div>
              {!selectedScheduleIsMemo && selectedScheduleDetails?.location ? (
                <div className="flex min-w-0 gap-2">
                  <span className="mt-0.5 shrink-0 text-muted-foreground" title={st.location}>
                    <MapPin size={14} />
                  </span>
                  <p className="min-w-0 break-words text-foreground">{selectedScheduleDetails.location}</p>
                </div>
              ) : null}
              <div className="min-w-0 text-right">
                <p className="truncate text-foreground">
                  {locale === "zh" ? "发起人" : "Organizer"} {selectedScheduleItem.creatorName || selectedScheduleItem.creatorEmail || "-"}
                </p>
              </div>
            </div>
            {selectedScheduleDetails?.notes ? (
              <div className="rounded-md border bg-muted/30 p-3 whitespace-pre-wrap leading-6">
                {selectedScheduleDetails.notes}
              </div>
            ) : null}
            {selectedScheduleIsMemo ? (
              <div className="text-xs text-muted-foreground">
                {selectedScheduleItem.creatorName || selectedScheduleItem.creatorEmail || "-"}{" "}
                {locale === "zh" ? "创建于" : "created"} {formatRelativeTime(selectedScheduleItem.createdAt, locale)}
              </div>
            ) : null}
            {!selectedScheduleIsMemo ? (
              <>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{st.participants}</p>
                    {selectedScheduleType === "meeting" && selectedScheduleParticipants.length > 0 ? (
                      <Badge variant="secondary" className="shrink-0 rounded-md">
                        {st.attendanceSummary} {selectedScheduleConfirmedCount}/{selectedScheduleParticipants.length}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="min-w-0 space-y-2">
                    {selectedScheduleParticipants.map((participant) => (
                      <div key={`${participant.id}-${participant.name}`} className="flex min-w-0 items-center gap-2 rounded-md border bg-background px-2 py-2">
                        {participant.id.startsWith("guest:") ? (
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                            {participant.name.slice(0, 1).toUpperCase()}
                          </span>
                        ) : (
                          <img src={attendeeAvatarSrc(participant.id)} alt="" className="h-7 w-7 shrink-0 rounded-full border" />
                        )}
                        <span className="min-w-0 truncate font-medium">{participant.name}</span>
                        {participant.isCreator ? <Badge variant="secondary" className="shrink-0 rounded-md px-1.5 py-0 text-[11px]">{t.openedBy}</Badge> : null}
                        {selectedScheduleType === "meeting" ? (
                          participant.id === currentUserId && selectedScheduleCanRespond ? (
                            <details className="group relative ml-auto shrink-0">
                              <summary className={`flex cursor-pointer list-none rounded-md border px-1.5 py-0.5 text-[11px] font-semibold [&::-webkit-details-marker]:hidden ${attendanceStatusClass(participant.status)}`}>
                                {attendanceStatusLabel(participant.status, locale)}
                              </summary>
                              <div className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-md border bg-popover py-1 text-popover-foreground">
                                {([
                                  ["CONFIRMED", st.confirmAttendance],
                                  ["TENTATIVE", st.tentativeAttendance],
                                  ["DECLINED", st.declineAttendance],
                                ] as Array<[AttendanceStatus, string]>).map(([status, label]) => (
                                  <button
                                    key={status}
                                    type="button"
                                    disabled={isPending}
                                    onClick={(event) => {
                                      handleMeetingAttendance(status);
                                      event.currentTarget.closest("details")?.removeAttribute("open");
                                    }}
                                    className={`block w-full px-3 py-2 text-left text-xs font-semibold disabled:opacity-50 ${
                                      participant.status === status
                                        ? "bg-accent text-accent-foreground"
                                        : "text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                                    }`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </details>
                          ) : (
                            <span className={`ml-auto shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${attendanceStatusClass(participant.status)}`}>
                              {attendanceStatusLabel(participant.status, locale)}
                            </span>
                          )
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.replies} ({selectedScheduleItem.comments.length})</p>
                  {selectedScheduleItem.comments.length > 0 ? (
                    <div className="space-y-2">
                      {selectedScheduleItem.comments.map((comment) => (
                        <div key={comment.id} className="rounded-md border bg-muted/30 px-3 py-2">
                          <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
                            <span className="min-w-0 truncate font-semibold text-foreground">{comment.authorName || comment.authorEmail}</span>
                            <span className="shrink-0" title={formatFullDateTime(comment.createdAt, locale)}>{formatRelativeTime(comment.createdAt, locale)}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {selectedScheduleCanComment ? (
                    <div className="space-y-2">
                      <Textarea
                        value={scheduleReplyContent}
                        onChange={(event) => setScheduleReplyContent(event.target.value)}
                        placeholder={st.meetingCommentPlaceholder}
                        rows={3}
                        className="min-h-24"
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          disabled={isPending || !scheduleReplyContent.trim()}
                          onClick={handleSaveScheduleReply}
                        >
                          {st.sendMessage}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
        </div>
      ) : null}
    </div>
  );

  const renderNotesView = () => {
    const folderButtonClass = (active: boolean, dropTargetId?: string) =>
      `flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-md px-2 text-sm transition-colors ${
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      } ${dropTargetId && noteDropTarget === dropTargetId ? "ring-2 ring-ring ring-inset" : ""}`;

    const noteButtonClass = (note: NoteListItem) =>
      `block min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        selectedNoteId === note.id
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
        className={`group/note flex min-w-0 items-center gap-0.5 ${note.deletedAt ? "" : "cursor-grab active:cursor-grabbing"} ${draggedNoteId === note.id ? "opacity-50" : ""}`}
      >
        <button type="button" onClick={() => openEditNote(note)} className={noteButtonClass(note)}>
          {noteTitle(note)}
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
              className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 group-hover/note:flex"
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
              className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover/note:flex"
              title={t.permanentlyDeleteNote}
            >
              <Trash2 size={13} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={(event) => {
                event.stopPropagation();
                handleToggleNotePinned(note);
              }}
              className={`h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-amber-50 disabled:opacity-50 ${
                isNotePinned(note) ? "hidden text-amber-500 group-hover/note:flex" : "hidden text-slate-400 hover:text-amber-500 group-hover/note:flex"
              }`}
              title={isNotePinned(note) ? t.unpinNote : t.pinNote}
            >
              <Star size={13} className={isNotePinned(note) ? "fill-amber-400" : ""} />
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={(event) => {
                event.stopPropagation();
                handleDeleteNote(note);
              }}
              className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover/note:flex"
              title={t.deleteNote}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    );

    const folderCounts = activeNotes.reduce((acc, note) => {
      const key = note.folderId || "uncategorized";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const pinnedFolderCounts = activeNotes.reduce((acc, note) => {
      if (!isNotePinned(note)) return acc;
      const key = note.folderId || "uncategorized";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const visibleNoteFolders = isPinnedFilter
      ? noteFolders.filter((folder) => (pinnedFolderCounts[folder.id] || 0) > 0)
      : noteFolders;
    const visibleFolderCounts = isPinnedFilter ? pinnedFolderCounts : folderCounts;
    const uncategorizedNotes = filteredNotes.filter((note) => !note.folderId);
    const selectedIsDeleted = Boolean(selectedNote?.deletedAt);
    const noteSaveLabel =
      noteSaveStatus === "pending"
        ? t.pendingSave
        : noteSaveStatus === "saving"
          ? t.savingNote
          : noteSaveStatus === "error"
            ? t.saveFailed
            : selectedNote
              ? formatSavedAgo(noteSavedAt || selectedNote.updatedAt, locale)
              : "";
    const folderNameById = new Map(noteFolders.map((folder) => [folder.id, folder.name]));
    const toggleFolderCollapsed = (folderId: string) => {
      setCollapsedNoteFolderIds((current) => ({
        ...current,
        [folderId]: !current[folderId],
      }));
    };

    return (
      <div
        className={`min-h-[520px] overflow-hidden bg-background ${
          isNoteFullscreen
            ? "h-screen rounded-none border-0"
            : "h-[calc(100vh-100px)] rounded-lg border"
        } lg:grid lg:grid-cols-[248px_minmax(0,1fr)]`}
      >
        <aside className="flex min-h-0 flex-col border-r bg-muted/30">
          <div className="space-y-0.5 px-2 pt-3">
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
              <span className="inline-flex min-w-0 items-center gap-1.5"><StickyNote size={15} />{t.allNotes}</span>
              <span>{activeNotes.length}</span>
            </button>
            <button type="button" onClick={() => setNoteFolderFilter("pinned")} className={folderButtonClass(isPinnedFilter)}>
              <span className="inline-flex min-w-0 items-center gap-1.5"><Star size={15} />{t.pinnedNotes}</span>
              <span>{activeNotes.filter((note) => isNotePinned(note)).length}</span>
            </button>
            <div className="group/trash flex min-w-0 items-center gap-0.5">
              <button type="button" onClick={() => setNoteFolderFilter("trash")} className={folderButtonClass(noteFolderFilter === "trash")}>
                <span className="inline-flex min-w-0 items-center gap-1.5"><Trash2 size={15} />{t.trash}</span>
                <span>{trashedNotes.length}</span>
              </button>
              {trashedNotes.length > 0 ? (
                <button
                  type="button"
                  onClick={handleEmptyNoteTrash}
                  disabled={isPending}
                  className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 group-hover/trash:flex"
                  title={t.emptyTrash}
                  aria-label={t.emptyTrash}
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          </div>
          <div
            className="mt-2 min-h-0 flex-1 overflow-y-auto border-t border-slate-200 px-2 py-2"
            onClick={(event) => {
              if (event.target === event.currentTarget) setNoteFolderFilter("all");
            }}
          >
            <div
              className="min-h-full space-y-1"
              onClick={(event) => {
                if (event.target === event.currentTarget) setNoteFolderFilter("all");
              }}
            >
              {noteFolderFilter !== "trash" ? (
                <>
                  <div className="mb-1 flex items-center justify-between px-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.folders}</p>
                    <button type="button" onClick={handleCreateFolder} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-900" title={t.newFolder}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <div
                    className={`mb-1 min-h-1 rounded-md px-1 py-0.5 ${noteDropTarget === "root" ? "ring-2 ring-blue-300 ring-inset" : ""}`}
                    onDragOver={(event) => {
                      if (!draggedNoteId) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setNoteDropTarget("root");
                    }}
                    onDragLeave={() => setNoteDropTarget((current) => current === "root" ? null : current)}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleNoteDrop(null);
                    }}
                  >
                    <div className="space-y-1">
                      {uncategorizedNotes.map((note) => (
                        renderNoteName(note)
                      ))}
                    </div>
                  </div>
                  {visibleNoteFolders.map((folder) => {
                    const isFolderExpanded = !collapsedNoteFolderIds[folder.id];

                    return (
                    <div key={folder.id} className="group">
                      <div className="flex min-w-0 items-center gap-0">
                        <button
                          type="button"
                          onClick={() => toggleFolderCollapsed(folder.id)}
                          className="ml-1 inline-flex h-9 w-3 shrink-0 items-center justify-center text-slate-400 hover:text-slate-700"
                          aria-label={isFolderExpanded ? t.less : t.more}
                        >
                          {isFolderExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNoteFolderFilter(isPinnedFilter ? `pinned-folder:${folder.id}` : `folder:${folder.id}`);
                            toggleFolderCollapsed(folder.id);
                          }}
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
                          className={`${folderButtonClass(noteFolderFilter === `folder:${folder.id}` || noteFolderFilter === `pinned-folder:${folder.id}`, folder.id)} flex-1 pl-1`}
                        >
                          <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
                            <Folder size={15} className="shrink-0" />
                            <span className="truncate">{folder.name}</span>
                          </span>
                          <span className="shrink-0">{visibleFolderCounts[folder.id] || 0}</span>
                        </button>
                        <button type="button" onClick={() => handleRenameFolder(folder)} className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 group-hover:flex" title={t.renameFolder}>
                          <Pencil size={13} />
                        </button>
                        <button type="button" onClick={() => handleDeleteFolder(folder)} className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover:flex" title={t.deleteFolder}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {isFolderExpanded ? (
                        <div className="ml-4 mt-1 space-y-1">
                          {filteredNotes.filter((note) => note.folderId === folder.id).map((note) => (
                            renderNoteName(note)
                          ))}
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                </>
              ) : (
                <div className="space-y-1">
                  {filteredNotes.map((note) => (
                    <div key={note.id}>
                      {renderNoteName(note)}
                      {note.folderId ? (
                        <div className="ml-3 mt-0.5 inline-flex max-w-[calc(100%-0.75rem)] items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                          <Folder size={10} className="mr-1 shrink-0" />
                          <span className="truncate">{folderNameById.get(note.folderId) || t.noFolder}</span>
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
                  departmentId={departmentId}
                  value={noteForm.content}
                  onChange={handleNoteContentChange}
                  readOnly={selectedIsDeleted}
                  height={560}
                  borderless
                  issueMentionOptions={noteIssueOptions}
                  issueMentionLabel={locale === "zh" ? "插入问题" : "Insert issue"}
                  onIssueLinkClick={(issueId) => setSelectedNoteIssueId(issueId)}
                  isFullscreen={isNoteFullscreen}
                  onToggleFullscreen={() => setIsNoteFullscreen((current) => !current)}
                  fullscreenLabel={t.fullscreen}
                  exitFullscreenLabel={t.exitFullscreen}
                  toolbarRight={
                    <div className="flex min-w-0 items-center gap-2">
                      {!selectedIsDeleted ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleToggleNotePinned(selectedNote);
                          }}
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-amber-50 ${
                            isNotePinned(selectedNote) ? "text-amber-500" : "text-slate-400 hover:text-amber-500"
                          } disabled:opacity-50`}
                          title={isNotePinned(selectedNote) ? t.unpinNote : t.pinNote}
                        >
                          <Star size={16} className={isNotePinned(selectedNote) ? "fill-amber-400" : ""} />
                        </button>
                      ) : null}
                      <span
                        className={`truncate text-sm italic ${
                          noteSaveStatus === "error"
                            ? "text-red-500"
                            : noteSaveStatus === "saving" || noteSaveStatus === "pending"
                              ? "text-blue-500"
                              : "text-slate-400"
                        }`}
                      >
                        {noteSaveLabel}
                      </span>
                    </div>
                  }
                />
            </div>
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center p-8 text-sm text-slate-500">
              {filteredNotes.length === 0 ? t.noNotes : t.selectNotePrompt}
            </div>
          )}
        </section>

        {selectedNoteIssue ? (
          <div className="fixed inset-0 z-[80] bg-[#091E42]/25" onClick={() => setSelectedNoteIssueId(null)}>
            <aside
              className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-slate-200 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                      {selectedNoteIssue.key}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      {selectedNoteIssue.projectKey}
                    </span>
                  </div>
                  <h3 className="mt-3 break-words text-lg font-semibold leading-6 text-slate-900">
                    {selectedNoteIssue.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNoteIssueId(null)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  title={t.cancel}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
                <div className="relative pb-5">
                  <div className="grid grid-cols-4 gap-x-3 text-sm">
                    {[
                      [issueText.status, getWorkflowStatusName(selectedNoteIssue.status, selectedNoteIssue.workflowStatuses, locale)],
                      [issueText.priority, priorityLabel(selectedNoteIssue.priority, locale)],
                      [issueText.assignee, selectedNoteIssue.assigneeName || selectedNoteIssue.assigneeEmail || t.unassigned],
                      [issueText.dueDate, selectedNoteIssue.dueDate ? formatDisplayDate(selectedNoteIssue.dueDate) : t.noDueDate],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <p className="text-xs font-semibold text-slate-500">{label}</p>
                        <p className="mt-0.5 truncate font-medium text-slate-800" title={value}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNoteIssuePropertiesExpanded((expanded) => !expanded)}
                    className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    title={locale === "zh" ? "展开/收起属性" : "Expand/collapse properties"}
                  >
                    <ChevronDown size={16} className={`transition-transform ${isNoteIssuePropertiesExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {isNoteIssuePropertiesExpanded ? (
                    <div className="mt-3 grid grid-cols-4 gap-x-3 text-sm">
                    {[
                      [issueText.type, getIssueTypeLabel(selectedNoteIssue.type, locale)],
                      [issueText.sprint, selectedNoteIssue.iterationName || ""],
                      [issueText.created, formatRelativeTime(selectedNoteIssue.createdAt, locale)],
                      [issueText.updated, formatRelativeTime(selectedNoteIssue.updatedAt, locale)],
                    ].filter(([, value]) => Boolean(value)).map(([label, value]) => {
                      const fullTimeTitle =
                        label === issueText.created
                          ? formatFullDateTime(selectedNoteIssue.createdAt, locale)
                          : label === issueText.updated
                            ? formatFullDateTime(selectedNoteIssue.updatedAt, locale)
                            : undefined;
                      return (
                      <div key={label} className="min-w-0">
                        <p className="text-xs font-semibold text-slate-500">{label}</p>
                        <p className="mt-0.5 truncate font-medium text-slate-800" title={fullTimeTitle || value}>{value}</p>
                      </div>
                      );
                    })}
                    </div>
                  ) : null}
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{issueText.description}</p>
                  <div className="min-h-32 rounded-md bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 [&_.neo-rich-text-editor__content]:text-sm [&_.neo-rich-text-editor__content_h1]:!text-sm [&_.neo-rich-text-editor__content_h2]:!text-sm [&_.neo-rich-text-editor__content_p]:text-sm">
                    {selectedNoteIssue.description ? (
                      <RichTextEditor value={selectedNoteIssue.description} onChange={() => {}} readOnly />
                    ) : (
                      <p className="text-sm text-slate-400">{locale === "zh" ? "暂无描述" : "No description"}</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {locale === "zh" ? "扩展字段" : "Custom fields"}
                  </p>
                  {selectedNoteIssue.issueFieldDefinitions.length > 0 ? (
                    <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                      {selectedNoteIssue.issueFieldDefinitions.map((field) => {
                        const value = selectedNoteIssue.issueFieldValues.find((item) => item.fieldDefinitionId === field.id);
                        const displayValue = formatIssueFieldValue(field, value);

                        return (
                          <div key={field.id} className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 px-3 py-2 text-sm">
                            <p className="text-xs font-semibold text-slate-500">{field.name}</p>
                            <p className="min-w-0 whitespace-pre-wrap break-words font-medium text-slate-800">
                              {displayValue || "-"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-400">
                      {locale === "zh" ? "暂无扩展字段" : "No custom fields"}
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {locale === "zh" ? `\u56de\u590d (${selectedNoteIssue.comments.length})` : `Replies (${selectedNoteIssue.comments.length})`}
                  </p>
                  {selectedNoteIssue.comments.length > 0 ? (
                    <div className="space-y-3">
                      {selectedNoteIssue.comments.map((comment) => (
                        <div key={comment.id} className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                            <span className="truncate font-semibold text-slate-700">
                              {comment.authorName || comment.authorEmail}
                            </span>
                            <span className="shrink-0" title={formatFullDateTime(comment.createdAt, locale)}>
                              {formatRelativeTime(comment.createdAt, locale)}
                            </span>
                          </div>
                          <div className="text-sm [&_.neo-rich-text-editor__content]:text-sm [&_.neo-rich-text-editor__content_h1]:!text-sm [&_.neo-rich-text-editor__content_h2]:!text-sm [&_.neo-rich-text-editor__content_p]:text-sm">
                            <RichTextEditor value={comment.content} onChange={() => {}} readOnly />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-400">
                      {locale === "zh" ? "\u6682\u65e0\u56de\u590d" : "No replies"}
                    </p>
                  )}
                </div>

                {selectedNoteIssue.attachments.length > 0 ? (
                  <div>
                    <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Paperclip size={13} />
                      {locale === "zh" ? `附件 (${selectedNoteIssue.attachments.length})` : `Attachments (${selectedNoteIssue.attachments.length})`}
                    </p>
                    <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                      {selectedNoteIssue.attachments.map((attachment) => (
                        <div key={attachment.id} className="px-3 py-2 text-sm">
                          <p className="truncate font-semibold text-slate-800">{attachment.fileName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {attachment.uploaderName || attachment.uploaderEmail} ·{" "}
                            <span title={formatFullDateTime(attachment.createdAt, locale)}>
                              {formatRelativeTime(attachment.createdAt, locale)}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
                <Link
                  href={getProjectPath(departmentId, selectedNoteIssue.projectId, "issues", selectedNoteIssue.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {locale === "zh" ? "打开问题" : "Open issue"}
                </Link>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      className={
        activeTab === "notes" && isNoteFullscreen
          ? "-m-6 h-screen"
          : `space-y-4 ${
              activeTab === "tasks"
                ? "[&_button[data-variant='outline']]:shadow-none [&_input[data-slot='input']]:shadow-none [&_textarea[data-slot='textarea']]:shadow-none [&_[data-slot='select-trigger']]:shadow-none"
                : ""
            }`
      }
    >
      {!(activeTab === "notes" && isNoteFullscreen) ? (
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-800">
              {activeTab === "tasks" ? t.tasks : activeTab === "schedule" ? t.schedule : t.notesTab}
            </h2>
          </div>
          <div className="flex items-center gap-2">
          {activeTab === "notes" ? (
            <>
              <div className="relative w-72 max-w-[42vw]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={noteQuery}
                  onChange={(event) => setNoteQuery(event.target.value)}
                  placeholder={t.searchNotes}
                  className="pl-9 pr-9"
                />
                {noteQuery ? (
                  <button
                    type="button"
                    onClick={() => setNoteQuery("")}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    title={t.clearSearch}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <Button
                type="button"
                onClick={openCreateNote}
                disabled={isPending}
              >
                <Plus size={16} />
                {locale === "zh" ? "笔记" : "Note"}
              </Button>
            </>
          ) : null}
          {activeTab === "schedule" ? (
            <>
              <div className="relative w-72 max-w-[42vw]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={scheduleSearch}
                  onChange={(event) => setScheduleSearch(event.target.value)}
                  placeholder={st.search}
                  className="pl-9 pr-9"
                />
                {scheduleSearch ? (
                  <button
                    type="button"
                    onClick={() => setScheduleSearch("")}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    title={t.clearSearch}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <Button
                type="button"
                onClick={() => openCreateScheduleModal()}
              >
                <Plus size={16} />
                {locale === "zh" ? "日程" : "Schedule"}
              </Button>
            </>
          ) : null}
          {activeTab === "tasks" ? (
            <>
              <div className="relative w-72 max-w-[42vw]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={taskQuery}
                  onChange={(event) => {
                    setTaskQuery(event.target.value);
                    setTaskPage(1);
                  }}
                  placeholder={t.searchTasks}
                  className="pl-9 pr-9"
                />
                {taskQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTaskQuery("");
                      setTaskPage(1);
                    }}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    title={t.clearSearch}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <Button
                type="button"
                onClick={openCreateModal}
              >
                <Plus size={16} />
                {locale === "zh" ? "任务" : "Task"}
              </Button>
            </>
          ) : null}
          </div>
        </div>
      ) : null}

      {error ? <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}

      {activeTab === "tasks" && taskFilterSummary.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-sm">
          {taskFilterSummary.map((filter) => (
            <div key={filter.key} className="inline-flex max-w-[360px] items-start rounded-md border bg-background text-foreground shadow-xs">
              <span className="flex min-w-0 items-center px-2.5 py-1">
                <span className="shrink-0 text-muted-foreground">{filter.label}：</span>
                <span className="min-w-0 truncate" title={filter.value || taskTableText.all}>{filter.value || taskTableText.all}</span>
              </span>
              <button
                type="button"
                className="m-0.5 ml-0 inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`${taskTableText.removeFilter}：${filter.label}`}
                title={`${taskTableText.removeFilter}：${filter.label}`}
                onClick={filter.clear}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === "schedule" ? (
        renderScheduleWorkspace()
      ) : activeTab === "notes" ? (
        renderNotesView()
      ) : (
        activeTab === "tasks" ? (
          <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
            <div className="relative overflow-x-auto flex-1">
              <table
                className="w-full text-left text-sm whitespace-nowrap"
                style={{ tableLayout: "fixed", minWidth: `${taskTableMinWidth}px` }}
              >
                <colgroup>
                  {displayedTaskDataColumns.map((column) => <col key={column.id} style={{ width: `${column.width}px` }} />)}
                  <col />
                  {displayedTaskActionColumn ? <col style={{ width: `${taskActionColumnWidth}px` }} /> : null}
                </colgroup>
                <thead className="border-b bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    {displayedTaskDataColumns.map((column, index) => {
                      const showLeftLine =
                        taskDragOverIndex === index && taskDragOverSide === "left" && taskDragSourceIndex !== index;
                      const showRightLine =
                        taskDragOverIndex === index && taskDragOverSide === "right" && taskDragSourceIndex !== index;
                      const isDragging = taskDragSourceIndex === index;

                      return (
                        <th
                          key={column.id}
                          className={`group/column relative h-12 cursor-move select-none overflow-hidden bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] px-5 py-0 align-middle transition-colors hover:bg-muted active:cursor-move ${isDragging ? "opacity-40" : ""}`}
                          style={{ width: `${column.width}px`, minWidth: `${column.minWidth}px` }}
                          draggable
                          onDragStart={(event) => handleTaskColumnDragStart(event, index)}
                          onDragOver={(event) => handleTaskColumnDragOver(event, index)}
                          onDrop={(event) => handleTaskColumnDrop(event, index)}
                          onDragEnd={handleTaskColumnDragEnd}
                          onDragLeave={() => {
                            if (taskDragOverIndex === index) {
                              setTaskDragOverIndex(null);
                              setTaskDragOverSide(null);
                            }
                          }}
                        >
                          {showLeftLine ? <div className="absolute left-0 top-0 bottom-0 z-10 w-0.5 bg-blue-500" /> : null}

                          {renderTaskHeaderLabel(column)}

                          {showRightLine ? <div className="absolute right-0 top-0 bottom-0 z-10 w-0.5 bg-blue-500" /> : null}

                          <div
                            className="group/resize absolute bottom-0 right-0 top-0 z-20 w-4 cursor-ew-resize"
                            onMouseDown={(event) => handleTaskColumnResizeStart(event, index)}
                            draggable={false}
                            title={locale === "zh" ? "拖拽调整列宽" : "Drag to resize column"}
                          >
                            <span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-border opacity-0 transition-[width,background-color,opacity] group-hover/column:opacity-100 group-hover/resize:w-0.5 group-hover/resize:bg-primary" />
                          </div>
                        </th>
                      );
                    })}
                    <th aria-hidden className="h-12 bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] p-0 hover:bg-muted" />
                    {displayedTaskActionColumn ? (
                      <th
                        className="group/column sticky right-0 z-20 h-12 select-none overflow-hidden bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] py-0 text-left align-middle whitespace-nowrap shadow-[-6px_0_8px_-8px_rgba(15,23,42,0.45)] hover:bg-muted"
                        style={{ width: taskActionColumnWidth, minWidth: taskActionColumnWidth, paddingInline: LIST_ACTION_COLUMN_PADDING_X }}
                      >
                        {renderTaskHeaderLabel(displayedTaskActionColumn)}
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedTaskItems.map(renderTaskRow)}
                </tbody>
              </table>
              {paginatedTaskItems.length === 0 ? (
                <div className="flex min-h-52 items-center justify-center px-5 py-16 text-center text-muted-foreground">
                  <p className="text-sm">{t.empty}</p>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3 text-sm">
              <div className="font-medium text-muted-foreground">
                {locale === "zh" ? (
                  <>
                    {taskTableText.showing}
                    <span className="font-bold text-foreground"> {taskRangeStart} </span>
                    {taskTableText.to}
                    <span className="font-bold text-foreground"> {taskRangeEnd} </span>
                    {taskTableText.of}
                    <span className="font-bold text-foreground"> {sortedTaskItems.length} </span>
                    {taskTableText.tasks}
                  </>
                ) : (
                  <>
                    {taskTableText.showing} <span className="font-bold text-foreground">{taskRangeStart}</span> {taskTableText.to}{" "}
                    <span className="font-bold text-foreground">{taskRangeEnd}</span> {taskTableText.of}{" "}
                    <span className="font-bold text-foreground">{sortedTaskItems.length}</span> {taskTableText.tasks}
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{taskTableText.perPage}</span>
                  <Select
                    value={String(taskPageSize)}
                    onValueChange={(value) => {
                      setTaskPageSize(Number(value));
                      setTaskPage(1);
                    }}
                  >
                    <SelectTrigger size="sm" className="w-20 bg-background shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end" className="shadow-none">
                      {TASK_PAGE_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setTaskPage(Math.max(1, currentTaskPage - 1))}
                    disabled={currentTaskPage === 1}
                  >
                    <ChevronLeft size={18} />
                  </Button>

                  <span className="min-w-24 px-2 text-center font-medium leading-none text-foreground">
                    {locale === "zh"
                      ? `${taskTableText.page} ${currentTaskPage} / ${taskTotalPages || 1} \u9875`
                      : `${taskTableText.page} ${currentTaskPage} of ${taskTotalPages || 1}`}
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setTaskPage(Math.min(taskTotalPages || 1, currentTaskPage + 1))}
                    disabled={currentTaskPage === taskTotalPages || taskTotalPages === 0}
                  >
                    <ChevronRight size={18} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">{visibleItems.length === 0 ? <p className="text-sm text-slate-500">{t.empty}</p> : visibleItems.map(renderItem)}</div>
        )
      )}

      {activeTab !== "notes" && selectedNoteIssue ? (
        <div className="fixed inset-0 z-[80] bg-[#091E42]/25" onClick={() => setSelectedNoteIssueId(null)}>
          <aside
            className={`absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-slate-200 bg-white ${activeTab === "tasks" ? "" : "shadow-2xl"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                    {selectedNoteIssue.key}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                    {selectedNoteIssue.projectKey}
                  </span>
                </div>
                <h3 className="mt-3 break-words text-lg font-semibold leading-6 text-slate-900">
                  {selectedNoteIssue.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNoteIssueId(null)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title={t.cancel}
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div className="relative pb-5">
                <div className="grid grid-cols-4 gap-x-3 text-sm">
                  {[
                    [issueText.status, getWorkflowStatusName(selectedNoteIssue.status, selectedNoteIssue.workflowStatuses, locale)],
                    [issueText.priority, priorityLabel(selectedNoteIssue.priority, locale)],
                    [issueText.assignee, selectedNoteIssue.assigneeName || selectedNoteIssue.assigneeEmail || t.unassigned],
                    [issueText.dueDate, selectedNoteIssue.dueDate ? formatDisplayDate(selectedNoteIssue.dueDate) : t.noDueDate],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">{label}</p>
                      <p className="mt-0.5 truncate font-medium text-slate-800" title={value}>{value}</p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setIsNoteIssuePropertiesExpanded((expanded) => !expanded)}
                  className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  title={locale === "zh" ? "\u5c55\u5f00/\u6536\u8d77\u5c5e\u6027" : "Expand/collapse properties"}
                >
                  <ChevronDown size={16} className={`transition-transform ${isNoteIssuePropertiesExpanded ? "rotate-180" : ""}`} />
                </button>
                {isNoteIssuePropertiesExpanded ? (
                  <div className="mt-3 grid grid-cols-4 gap-x-3 text-sm">
                  {[
                    [issueText.type, getIssueTypeLabel(selectedNoteIssue.type, locale)],
                    [issueText.sprint, selectedNoteIssue.iterationName || ""],
                    [issueText.created, formatRelativeTime(selectedNoteIssue.createdAt, locale)],
                    [issueText.updated, formatRelativeTime(selectedNoteIssue.updatedAt, locale)],
                  ].filter(([, value]) => Boolean(value)).map(([label, value]) => {
                    const fullTimeTitle =
                      label === issueText.created
                        ? formatFullDateTime(selectedNoteIssue.createdAt, locale)
                        : label === issueText.updated
                          ? formatFullDateTime(selectedNoteIssue.updatedAt, locale)
                          : undefined;
                    return (
                      <div key={label} className="min-w-0">
                        <p className="text-xs font-semibold text-slate-500">{label}</p>
                        <p className="mt-0.5 truncate font-medium text-slate-800" title={fullTimeTitle || value}>{value}</p>
                    </div>
                    );
                  })}
                  </div>
                ) : null}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{issueText.description}</p>
                <div className="min-h-32 rounded-md bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 [&_.neo-rich-text-editor__content]:text-sm [&_.neo-rich-text-editor__content_h1]:!text-sm [&_.neo-rich-text-editor__content_h2]:!text-sm [&_.neo-rich-text-editor__content_p]:text-sm">
                  {selectedNoteIssue.description ? (
                    <RichTextEditor value={selectedNoteIssue.description} onChange={() => {}} readOnly />
                  ) : (
                    <p className="text-sm text-slate-400">{locale === "zh" ? "\u6682\u65e0\u63cf\u8ff0" : "No description"}</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {locale === "zh" ? "\u6269\u5c55\u5b57\u6bb5" : "Custom fields"}
                </p>
                {selectedNoteIssue.issueFieldDefinitions.length > 0 ? (
                  <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                    {selectedNoteIssue.issueFieldDefinitions.map((field) => {
                      const value = selectedNoteIssue.issueFieldValues.find((item) => item.fieldDefinitionId === field.id);
                      const displayValue = formatIssueFieldValue(field, value);

                      return (
                        <div key={field.id} className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 px-3 py-2 text-sm">
                          <p className="text-xs font-semibold text-slate-500">{field.name}</p>
                          <p className="min-w-0 whitespace-pre-wrap break-words font-medium text-slate-800">
                            {displayValue || "-"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-400">
                    {locale === "zh" ? "\u6682\u65e0\u6269\u5c55\u5b57\u6bb5" : "No custom fields"}
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {locale === "zh" ? `\u56de\u590d (${selectedNoteIssue.comments.length})` : `Replies (${selectedNoteIssue.comments.length})`}
                </p>
                {selectedNoteIssue.comments.length > 0 ? (
                  <div className="space-y-3">
                    {selectedNoteIssue.comments.map((comment) => (
                      <div key={comment.id} className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                          <span className="truncate font-semibold text-slate-700">
                            {comment.authorName || comment.authorEmail}
                          </span>
                          <span className="shrink-0" title={formatFullDateTime(comment.createdAt, locale)}>
                            {formatRelativeTime(comment.createdAt, locale)}
                          </span>
                        </div>
                        <div className="text-sm [&_.neo-rich-text-editor__content]:text-sm [&_.neo-rich-text-editor__content_h1]:!text-sm [&_.neo-rich-text-editor__content_h2]:!text-sm [&_.neo-rich-text-editor__content_p]:text-sm">
                          <RichTextEditor value={comment.content} onChange={() => {}} readOnly />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-400">
                    {locale === "zh" ? "\u6682\u65e0\u56de\u590d" : "No replies"}
                  </p>
                )}
              </div>

              {selectedNoteIssue.attachments.length > 0 ? (
                <div>
                  <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Paperclip size={13} />
                    {locale === "zh" ? `\u9644\u4ef6 (${selectedNoteIssue.attachments.length})` : `Attachments (${selectedNoteIssue.attachments.length})`}
                  </p>
                  <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                    {selectedNoteIssue.attachments.map((attachment) => (
                      <div key={attachment.id} className="px-3 py-2 text-sm">
                        <p className="truncate font-semibold text-slate-800">{attachment.fileName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {attachment.uploaderName || attachment.uploaderEmail} 路{" "}
                          <span title={formatFullDateTime(attachment.createdAt, locale)}>
                            {formatRelativeTime(attachment.createdAt, locale)}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <Link
                href={getProjectPath(departmentId, selectedNoteIssue.projectId, "issues", selectedNoteIssue.id)}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {locale === "zh" ? "\u6253\u5f00\u95ee\u9898" : "Open issue"}
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

      <Dialog
        open={isCreateOpen && activeTab === "schedule"}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingScheduleItemId(null);
          }
        }}
      >
        {renderScheduleCreateDialog()}
      </Dialog>

      <Dialog
        open={isCreateOpen && activeTab !== "schedule"}
        onOpenChange={(open) => {
          if (!open) void closeCreateTaskDialog();
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b bg-muted/35 px-6 py-4">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl">{t.addTask}</DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setForm((current) => ({ ...current, isImportant: !current.isImportant }))}
                className={form.isImportant ? "text-amber-500 hover:bg-amber-50 hover:text-amber-600" : "text-muted-foreground hover:text-amber-500"}
                title={t.important}
                aria-pressed={form.isImportant}
                aria-label={t.important}
              >
                <Star className={form.isImportant ? "fill-amber-400 text-amber-400" : ""} />
              </Button>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="space-y-2">
                <Label htmlFor="task-title">
                  {t.titleField} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="task-title"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>{t.notes}</Label>
                <div className="min-h-0 rounded-lg border bg-background">
                  <RichTextEditor
                    ref={taskContentEditorRef}
                    departmentId={departmentId}
                    value={form.content}
                    onChange={(value) => setForm((current) => ({ ...current, content: value || "" }))}
                    height={220}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>{locale === "zh" ? `附件 (${taskAttachments.length})` : `Attachments (${taskAttachments.length})`}</Label>
                  <Button asChild type="button" variant="secondary" size="sm" disabled={isTaskAttachmentUploading || isPending}>
                    <label className="cursor-pointer">
                      {isTaskAttachmentUploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                      {isTaskAttachmentUploading ? (locale === "zh" ? "上传中" : "Uploading") : (locale === "zh" ? "添加附件" : "Add attachment")}
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleTaskAttachmentUpload}
                        disabled={isTaskAttachmentUploading || isPending}
                      />
                    </label>
                  </Button>
                </div>
                {taskAttachments.length > 0 ? (
                  <div className="overflow-hidden rounded-md border bg-card text-card-foreground shadow-xs">
                    {taskAttachments.map((attachment) => (
                      <div key={attachment.id} className="flex min-w-0 items-center justify-between gap-3 border-b px-3 py-2.5 text-sm last:border-b-0 hover:bg-accent/50">
                        <span className="inline-flex min-w-0 items-center gap-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                            {getTaskAttachmentIcon(attachment.fileName)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{attachment.fileName}</span>
                            {formatAttachmentSize(attachment.fileSize) ? (
                              <span className="block text-xs text-muted-foreground">{formatAttachmentSize(attachment.fileSize)}</span>
                            ) : null}
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => void removeTaskAttachment(attachment.id)}
                          disabled={isPending}
                          title={locale === "zh" ? "移除附件" : "Remove attachment"}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {activeTab === "tasks" || form.itemType === "TODO" ? (
                  <ShadcnDatePicker
                    id="taskDueDate"
                    label={t.dueDate}
                    locale={locale}
                    value={form.dueAt}
                    onChange={(dueAt) => setForm((current) => ({ ...current, dueAt }))}
                  />
                ) : null}
                {activeTab === "tasks" || form.itemType === "TODO" ? (
                  <div className="flex w-full flex-col gap-1.5">
                    <Label htmlFor="taskAssignee">{t.assignee}</Label>
                    <Select value={currentTaskAssigneeValue} onValueChange={applyTaskAssigneeChoice}>
                      <SelectTrigger id="taskAssignee" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {taskAssigneeChoices.map((choice) => (
                          <SelectItem key={choice.value} value={choice.value}>
                            {choice.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t bg-muted/35 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => void closeCreateTaskDialog()}
                disabled={isPending}
              >
                {t.cancel}
              </Button>
              <Button
                type="submit"
                disabled={isPending || isTaskAttachmentUploading || !form.title.trim()}
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                {t.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {selectedTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-background">
            <div className="flex items-center justify-between gap-3 border-b px-6 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-foreground">{selectedTask.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.openedBy}: {selectedTask.creatorName || selectedTask.creatorEmail || "-"} · {t.assignee}: {selectedTask.assigneeName || selectedTask.assigneeEmail || t.unassigned}
                  {selectedTask.dueDate ? ` · ${t.dueDate}: ${formatDisplayDate(selectedTask.dueDate)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedTask.canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isEditingTask) {
                        void cancelTaskEdit();
                      } else {
                        beginTaskEdit();
                      }
                    }}
                  >
                    {isEditingTask ? t.less : t.edit}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    if (isEditingTask) {
                      void cancelTaskEdit();
                    }
                    setSelectedTaskId(null);
                    setSelectedTaskSnapshot(null);
                  }}
                >
                  <X size={18} />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {detailError ? <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{detailError}</div> : null}

            {selectedTask.canEdit && isEditingTask ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.titleField}</Label>
                  <Input
                    value={editForm.title}
                    onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.notes}</Label>
                  <div className="h-64 min-h-0">
                    <RichTextEditor
                      ref={editTaskContentEditorRef}
                      departmentId={departmentId}
                      value={editForm.content}
                      onChange={(value) => setEditForm((current) => ({ ...current, content: value || "" }))}
                      height={190}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>{locale === "zh" ? `附件 (${editTaskAttachments.length})` : `Attachments (${editTaskAttachments.length})`}</Label>
                    <Button asChild type="button" variant="secondary" size="sm" disabled={isEditTaskAttachmentUploading || isPending}>
                      <label className="cursor-pointer">
                        {isEditTaskAttachmentUploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                        {isEditTaskAttachmentUploading ? (locale === "zh" ? "上传中" : "Uploading") : (locale === "zh" ? "添加附件" : "Add attachment")}
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleEditTaskAttachmentUpload}
                          disabled={isEditTaskAttachmentUploading || isPending}
                        />
                      </label>
                    </Button>
                  </div>
                  {editTaskAttachments.length > 0 ? (
                    <div className="overflow-hidden rounded-md border bg-card text-card-foreground shadow-xs">
                      {editTaskAttachments.map((attachment) => (
                        <div key={attachment.id} className="flex min-w-0 items-center justify-between gap-3 border-b px-3 py-2.5 text-sm last:border-b-0 hover:bg-accent/50">
                          <span className="inline-flex min-w-0 items-center gap-2.5">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                              {getTaskAttachmentIcon(attachment.fileName)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{attachment.fileName}</span>
                              {formatAttachmentSize(attachment.fileSize) ? (
                                <span className="block text-xs text-muted-foreground">{formatAttachmentSize(attachment.fileSize)}</span>
                              ) : null}
                            </span>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => void removeEditTaskAttachment(attachment.id)}
                            disabled={isPending}
                            title={locale === "zh" ? "移除附件" : "Remove attachment"}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
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
                    <Label>{t.dueDate}</Label>
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
              <div className="space-y-3">
                <div className="min-h-28 rounded-lg bg-muted/50 px-3 py-2">
                  {selectedTaskContent ? (
                    <div className="text-sm leading-6 text-foreground [&_.neo-rich-text-editor__content]:text-sm [&_.neo-rich-text-editor__content_p]:text-sm [&_img]:max-w-full [&_img]:rounded-md">
                      <RichTextEditor value={selectedTaskContent} onChange={() => {}} readOnly />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{t.noContent}</p>
                  )}
                </div>
                {selectedTaskAttachments.length > 0 ? (
                  <div className="space-y-2 pt-3">
                    <Label>{locale === "zh" ? `附件 (${selectedTaskAttachments.length})` : `Attachments (${selectedTaskAttachments.length})`}</Label>
                    <div className="overflow-hidden rounded-md border bg-card text-card-foreground shadow-xs">
                      {selectedTaskAttachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.fileUrl}
                          download={getAttachmentDownloadName(attachment.fileName)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-w-0 items-center gap-2.5 border-b px-3 py-2.5 text-sm text-foreground last:border-b-0 hover:bg-accent/50"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                            {getTaskAttachmentIcon(attachment.fileName)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{attachment.fileName}</span>
                            {formatAttachmentSize(attachment.fileSize) ? (
                              <span className="block text-xs text-muted-foreground">{formatAttachmentSize(attachment.fileSize)}</span>
                            ) : null}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="mt-5">
              <div className="space-y-2">
                {selectedTask.comments.length > 0 ? (
                  selectedTask.comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg bg-muted/50 px-3 py-2">
                      <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
                        <span className="min-w-0 truncate font-semibold text-foreground">{comment.authorName || comment.authorEmail}</span>
                        <span className="shrink-0" title={formatFullDateTime(comment.createdAt, locale)}>{formatRelativeTime(comment.createdAt, locale)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{comment.content}</p>
                    </div>
                  ))
                ) : null}
              </div>
              {selectedTask.canComment ? (
                <div className="mt-4 space-y-2">
                  <Textarea
                    value={replyContent}
                    onChange={(event) => setReplyContent(event.target.value)}
                    placeholder={t.reply}
                    rows={5}
                  />
                </div>
              ) : null}
            </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t bg-muted/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {selectedTask.completedAt ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending || !selectedTask.canComplete}
                    onClick={() => handleReopen(selectedTask)}
                  >
                    <RotateCcw size={14} />
                    {t.reopen}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending || !selectedTask.canComplete}
                    onClick={() => handleComplete(selectedTask)}
                    className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <Check size={14} />
                    {t.done}
                  </Button>
                )}
                {selectedTask.canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => requestDeleteTask(selectedTask)}
                    className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={14} />
                    {t.deleteTask}
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (isEditingTask) {
                      void cancelTaskEdit();
                    }
                    setSelectedTaskId(null);
                    setSelectedTaskSnapshot(null);
                  }}
                >
                  {t.cancel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending || isEditTaskAttachmentUploading || (isEditingTask && !editForm.title.trim()) || (!isEditingTask && !replyContent.trim())}
                  onClick={handleSaveTaskDialog}
                >
                  {t.save}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog
        open={Boolean(taskPendingDelete)}
        onOpenChange={(open) => {
          if (!open) setTaskPendingDelete(null);
        }}
      >
        <DialogContent className="max-w-md p-0 shadow-none">
          <DialogHeader className="border-b bg-destructive/10 px-6 py-4">
            <DialogTitle className="text-destructive">{t.deleteTask}</DialogTitle>
            <DialogDescription>{t.deleteConfirm}</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5">
            <div className="rounded-md border bg-muted/50 p-3 text-sm font-semibold text-foreground">
              {taskPendingDelete?.title}
            </div>
          </div>
          <DialogFooter className="border-t bg-muted/40 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setTaskPendingDelete(null)} disabled={isPending}>
              {t.cancel}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteTask} disabled={isPending || !taskPendingDelete}>
              {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              {t.deleteTask}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
