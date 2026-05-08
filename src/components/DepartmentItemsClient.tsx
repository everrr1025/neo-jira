"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
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
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Folder,
  MapPin,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Star,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";

import { addReminderComment, createReminder, deleteReminderItem, deleteReminderTask, setReminderCompleted, updateReminderItem, updateReminderTask } from "@/app/actions/reminders";
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
import { getTranslations, getIssueTypeLabel } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { NoteFolderListItem, NoteListItem, NoteTaskOption } from "@/lib/notes";
import { getWorkflowStatusName } from "@/lib/workflows";
import { formatFullDateTime, formatRelativeTime } from "@/lib/timeFormat";

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
  return status === "DONE" ? t.completed : t.incomplete;
}

function formatDisplayDate(value: string | null, locale: Locale) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US");
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

function combineDateAsAllDay(dateValue: string) {
  return `${dateValue || format(new Date(), "yyyy-MM-dd")}T00:00`;
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
  if (type === "reminder") return "border-l-red-600 bg-red-50 text-red-700";
  if (type === "out") return "border-l-slate-500 bg-slate-100 text-slate-700";
  if (type === "memo") return "border-l-amber-500 bg-amber-50 text-amber-800";
  return "border-l-[#0052CC] bg-[#E9F2FF] text-[#0052CC]";
}

function scheduleDotClass(type: ScheduleType) {
  if (type === "reminder") return "bg-red-600";
  if (type === "out") return "bg-slate-500";
  if (type === "memo") return "bg-amber-500";
  return "bg-[#0052CC]";
}

function scheduleBadgeClass(type: ScheduleType) {
  if (type === "reminder") return "border border-red-200 bg-red-50 text-red-700";
  if (type === "out") return "border border-slate-200 bg-slate-100 text-slate-700";
  if (type === "memo") return "border border-amber-200 bg-amber-50 text-amber-800";
  return "border border-blue-200 bg-[#E9F2FF] text-[#0052CC]";
}

function scheduleTimeLabel(item: DepartmentItemCenterItem, locale: Locale, includeEnd = false) {
  const date = new Date(item.date);
  if (Number.isNaN(date.getTime())) return "";
  const hasSpecificTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  if (isAllDayScheduleItem(item) || !hasSpecificTime || item.kind === "ISSUE_DUE") {
    return item.kind === "ISSUE_DUE" ? (locale === "zh" ? "截止" : "Due") : "";
  }
  const start = date.toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (!includeEnd || !item.endDate) return start;
  const end = new Date(item.endDate);
  if (Number.isNaN(end.getTime())) return start;
  return `${start}-${end.toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

function isAllDayScheduleItem(item: DepartmentItemCenterItem) {
  if (item.kind === "ISSUE_DUE" || item.itemType === "TODO" || item.itemType === "REMINDER") return true;
  const start = new Date(item.date);
  if (Number.isNaN(start.getTime())) return true;
  if (!item.endDate) return true;
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
  return `/avatars/cartoon-${String((sum % 12) + 1).padStart(2, "0")}.svg`;
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

const TIME_POPOVER_HEIGHT = 280;
const TIME_POPOVER_GAP = 8;
const TIME_VIEWPORT_MARGIN = 12;
const timeHours = Array.from({ length: 24 }, (_, index) => `${index}`.padStart(2, "0"));
const timeMinutes = Array.from({ length: 12 }, (_, index) => `${index * 5}`.padStart(2, "0"));

function getTimePopoverPosition(element: HTMLButtonElement) {
  const rect = element.getBoundingClientRect();
  const left = Math.min(
    Math.max(TIME_VIEWPORT_MARGIN, rect.left),
    Math.max(TIME_VIEWPORT_MARGIN, window.innerWidth - rect.width - TIME_VIEWPORT_MARGIN)
  );
  const shouldOpenAbove =
    window.innerHeight - rect.bottom < TIME_POPOVER_HEIGHT + TIME_POPOVER_GAP &&
    rect.top > TIME_POPOVER_HEIGHT + TIME_POPOVER_GAP;
  const top = shouldOpenAbove
    ? Math.max(TIME_VIEWPORT_MARGIN, rect.top - TIME_POPOVER_HEIGHT - TIME_POPOVER_GAP)
    : Math.min(window.innerHeight - TIME_POPOVER_HEIGHT - TIME_VIEWPORT_MARGIN, rect.bottom + TIME_POPOVER_GAP);

  return {
    left,
    top,
    width: rect.width,
  };
}

function LocalizedTimeInput({
  id,
  label,
  value,
  onChange,
  locale,
  required = false,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  required?: boolean;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const [selectedHour = "09", selectedMinute = "00"] = value.split(":");

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedTrigger = buttonRef.current?.contains(target);
      const clickedPopover = popoverRef.current?.contains(target);
      if (!clickedTrigger && !clickedPopover) setIsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const handleReposition = () => {
      if (buttonRef.current) setPopoverPosition(getTimePopoverPosition(buttonRef.current));
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen]);

  const openPicker = () => {
    if (buttonRef.current) setPopoverPosition(getTimePopoverPosition(buttonRef.current));
    setIsOpen((current) => !current);
  };

  const updateTime = (hour: string, minute: string) => {
    onChange(`${hour}:${minute}`);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-700">{label}</label>
      <input
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={() => undefined}
        required={required}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      <button
        ref={buttonRef}
        id={inputId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={openPicker}
        className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      >
        <span>{value || (locale === "zh" ? "选择时间" : "Select time")}</span>
        <Clock size={16} className="shrink-0 text-slate-400" />
      </button>
      {isOpen && popoverPosition
        ? createPortal(
            <div
              ref={popoverRef}
              className="z-[90] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl"
              style={{ left: popoverPosition.left, top: popoverPosition.top, width: popoverPosition.width, position: "fixed" }}
            >
              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-sm font-semibold text-slate-800">{locale === "zh" ? "选择时间" : "Select time"}</span>
                <span className="rounded-md bg-blue-50 px-2 py-1 text-sm font-semibold text-blue-700">{value}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 px-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">{locale === "zh" ? "小时" : "Hour"}</div>
                  <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                    {timeHours.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => updateTime(hour, selectedMinute)}
                        className={`flex w-full items-center justify-center rounded-md px-2 py-1.5 text-sm transition-colors ${hour === selectedHour ? "bg-blue-600 font-semibold text-white" : "text-slate-700 hover:bg-slate-100"}`}
                      >
                        {hour}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 px-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">{locale === "zh" ? "分钟" : "Minute"}</div>
                  <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                    {timeMinutes.map((minute) => (
                      <button
                        key={minute}
                        type="button"
                        onClick={() => updateTime(selectedHour, minute)}
                        className={`flex w-full items-center justify-center rounded-md px-2 py-1.5 text-sm transition-colors ${minute === selectedMinute ? "bg-blue-600 font-semibold text-white" : "text-slate-700 hover:bg-slate-100"}`}
                      >
                        {minute}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

type TaskFilter = "all" | "created" | "assigned" | "incomplete" | "dueSoon";
type ItemTab = "tasks" | "schedule" | "notes";
type ScheduleView = "month" | "week" | "list";
type ScheduleType = "meeting" | "out" | "reminder" | "memo";
type ScheduleCreateKind = "meeting" | "out" | "memo";
type NoteFolderFilter = "all" | "pinned" | "trash" | `folder:${string}` | `pinned-folder:${string}`;
type NoteSaveStatus = "saved" | "pending" | "saving" | "error";
type SavedNoteSnapshot = {
  id: string;
  title: string;
  content: string;
};

const WEEK_START_HOUR = 7;
const WEEK_END_HOUR = 22;
const WEEK_HOUR_HEIGHT = 64;
const WEEK_GRID_TOP_PADDING = 18;
const WEEK_EVENT_INSET = 4;
const WEEK_HOURS = Array.from({ length: WEEK_END_HOUR - WEEK_START_HOUR + 1 }, (_, index) => WEEK_START_HOUR + index);

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
  const st = SCHEDULE_TEXT[locale];
  const issueText = getTranslations(locale).issueDetail;
  const router = useRouter();
  const noteEditorRef = useRef<RichTextEditorHandle>(null);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("month");
  const [visibleScheduleTypes, setVisibleScheduleTypes] = useState<Record<ScheduleType, boolean>>({
    meeting: true,
    out: true,
    reminder: true,
    memo: true,
  });
  const [scheduleCursor, setScheduleCursor] = useState(() => new Date());
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [selectedScheduleItemId, setSelectedScheduleItemId] = useState<string | null>(null);
  const activeTab = initialTab;
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [taskQuery, setTaskQuery] = useState("");
  const [noteFolderFilter, setNoteFolderFilter] = useState<NoteFolderFilter>("all");
  const [noteQuery, setNoteQuery] = useState("");
  const [pinnedNoteOverrides, setPinnedNoteOverrides] = useState<Record<string, boolean>>({});
  const [noteTitleOverrides, setNoteTitleOverrides] = useState<Record<string, string>>({});
  const [noteSaveStatus, setNoteSaveStatus] = useState<NoteSaveStatus>("saved");
  const [isNoteFullscreen, setIsNoteFullscreen] = useState(false);
  const [selectedNoteIssueId, setSelectedNoteIssueId] = useState<string | null>(null);
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
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    dueAt: "",
    scopeType: "PERSONAL" as "PERSONAL" | "DEPARTMENT" | "PROJECT",
    projectId: "",
    assigneeId: currentUserId,
  });

  useEffect(() => {
    if (!isNoteFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isNoteFullscreen]);

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
  const visibleItems = items.filter((item) => {
    if (activeTab === "tasks") return filteredTaskItems.some((task) => task.id === item.id);
    if (activeTab === "schedule") return item.itemType === "EVENT" || item.itemType === "REMINDER" || item.itemType === "TODO" || item.itemType === "ISSUE_DUE";
    return false;
  });
  const scheduleItems = items
    .filter((item) => item.itemType === "EVENT" || item.itemType === "REMINDER" || item.itemType === "TODO" || item.itemType === "ISSUE_DUE")
    .filter((item) => item.itemType !== "TODO" || Boolean(item.dueDate))
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
    if (noteFolderFilter.startsWith("pinned-folder:") && note.folderId !== noteFolderFilter.slice("pinned-folder:".length)) return false;
    if (noteFolderFilter.startsWith("folder:") && note.folderId !== noteFolderFilter.slice("folder:".length)) return false;

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
  const selectedTask = selectedTaskId ? items.find((item) => item.id === selectedTaskId) || null : null;
  const selectedScheduleItem = selectedScheduleItemId ? items.find((item) => item.id === selectedScheduleItemId) || null : null;
  const editingScheduleItem = editingScheduleItemId ? items.find((item) => item.id === editingScheduleItemId) || null : null;
  const selectedNoteIssue = selectedNoteIssueId
    ? noteIssueOptions.find((issue) => issue.id === selectedNoteIssueId) || null
    : null;

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
      setIsNoteFullscreen(false);
      setNoteSaveStatus("saved");
    }
  }, [selectedNoteId]);

  const calendarItems = scheduleItems.filter((item) => item.itemType !== "NOTE");
  const scheduleListItems = scheduleItems.filter((item) => {
    const itemDate = new Date(item.date);
    if (Number.isNaN(itemDate.getTime())) return false;
    return itemDate >= startOfMonth(scheduleCursor) && itemDate <= endOfMonth(scheduleCursor);
  });
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
  const visibleScheduleTypeCounts = (["meeting", "out", "reminder", "memo"] as ScheduleType[]).reduce((acc, type) => {
    acc[type] = calendarItems.filter((item) => getScheduleType(item) === type).length;
    return acc;
  }, {} as Record<ScheduleType, number>);

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
    setError("");
    setIsCreateMoreOpen(false);
    setIsCreateOpen(true);
  };

  const openCreateScheduleModal = (date = scheduleCursor, startTime = "09:00", endTime = "10:00") => {
    setEditingScheduleItemId(null);
    const scheduleDate = format(date, "yyyy-MM-dd");
    const [startHour = "09", startMinute = "00"] = startTime.split(":");
    const [endHour = "10", endMinute = "00"] = endTime.split(":");
    resetForm({
      itemType: "EVENT",
      hasTime: false,
      startAt: composeDateTime(date, Number(startHour), Number(startMinute)),
      endAt: composeDateTime(date, Number(endHour), Number(endMinute)),
      dueAt: "",
      scopeType: "DEPARTMENT",
      assigneeId: currentUserId,
      scheduleKind: "meeting",
      scheduleDate,
      startTime,
      endTime,
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
    const attendeeIds = details.participantNames
      .map((name) => {
        const normalizedName = name.toLowerCase();
        return assigneeOptions.find((assignee) =>
          assignee.name.toLowerCase() === normalizedName ||
          assignee.email.toLowerCase() === normalizedName
        )?.id;
      })
      .filter((id): id is string => Boolean(id));
    setEditingScheduleItemId(item.id);
    resetForm({
      title: item.title,
      itemType: scheduleKind === "memo" ? "REMINDER" : "EVENT",
      hasTime: false,
      startAt: item.date,
      endAt: item.endDate || "",
      dueAt: "",
      scopeType: item.scopeType === "PERSONAL" ? "PERSONAL" : "DEPARTMENT",
      assigneeId: item.assigneeId || currentUserId,
      scheduleKind,
      scheduleDate: format(new Date(item.date), "yyyy-MM-dd"),
      startTime: formatTimeLocalFromIso(item.date) || "09:00",
      endTime: formatTimeLocalFromIso(item.endDate) || formatTimeLocalFromIso(item.date) || "10:00",
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
    startTransition(async () => {
      const isScheduleCreate = activeTab === "schedule";
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
      const scheduleStartAt = form.scheduleKind === "memo"
        ? combineDateAsAllDay(form.scheduleDate)
        : combineDateAndTime(form.scheduleDate, form.startTime);
      const result =
        isScheduleCreate && editingScheduleItem
          ? await updateReminderItem(editingScheduleItem.id, {
              title: form.title,
              content: scheduleContent,
              itemType: scheduleItemType,
              startAt: scheduleStartAt,
              endAt: form.scheduleKind !== "memo" ? combineDateAndTime(form.scheduleDate, form.endTime) : undefined,
              scopeType: scheduleScopeType,
            })
          : await createReminder({
              departmentId,
              title: form.title,
              content: isScheduleCreate ? scheduleContent : form.content,
              itemType: isScheduleCreate ? scheduleItemType : form.itemType,
              startAt: isScheduleCreate ? scheduleStartAt : form.itemType === "TODO" ? undefined : form.startAt,
              endAt: isScheduleCreate && form.scheduleKind !== "memo" ? combineDateAndTime(form.scheduleDate, form.endTime) : undefined,
              dueAt: form.dueAt || undefined,
              priority: form.priority,
              isImportant: form.isImportant,
              scopeType: scheduleScopeType,
              projectId: isScheduleCreate ? undefined : form.scopeType === "PROJECT" ? form.projectId : undefined,
              issueId: form.issueId || undefined,
              assigneeId: form.assigneeId || undefined,
            });

      if (!result.success) {
        setError(result.error || "Failed");
        return;
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

  const openTaskEditor = (item: DepartmentItemCenterItem) => {
    openTaskDetail(item);
    setIsEditingTask(true);
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

  const handleDeleteTask = (targetTask = selectedTask) => {
    if (!targetTask || !targetTask.canEdit) return;
    if (!window.confirm(t.deleteConfirm)) return;
    if (targetTask.id !== selectedTask?.id) setSelectedTaskId(null);
    setDetailError("");
    startTransition(async () => {
      const result = await deleteReminderTask(targetTask.id);
      if (!result.success) {
        setDetailError(result.error || "Failed");
        return;
      }
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

    const hasChanges =
      splitContent.title !== savedSnapshot.title ||
      splitContent.content !== savedSnapshot.content;

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

  const openEditNote = (note: NoteListItem) => {
    void saveSelectedNoteNow();
    setSelectedNoteId(note.id);
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
    setNoteForm((current) => ({ ...current, content: value }));
    if (selectedNote) {
      const splitContent = splitNoteEditorContent(value, t.untitledNote);
      setNoteTitleOverrides((current) => ({ ...current, [selectedNote.id]: splitContent.title }));
    }
    setNoteSaveStatus("pending");
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

    const hasChanges =
      splitContent.title !== savedSnapshot.title ||
      splitContent.content !== savedSnapshot.content;

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

  const taskFilters: Array<{ id: TaskFilter; label: string }> = [
    { id: "all", label: t.allTasks },
    { id: "created", label: t.createdByMe },
    { id: "assigned", label: t.assignedToMe },
    { id: "incomplete", label: t.incompleteTasks },
    { id: "dueSoon", label: t.dueSoonTasks },
  ];

  const renderTaskRow = (item: DepartmentItemCenterItem) => (
    <tr key={item.id} className="group transition-colors hover:bg-slate-50/70">
      <td className="px-5 py-3.5">
        <button type="button" onClick={() => openTaskDetail(item)} className="block w-full min-w-0 text-left">
          <span className="flex min-w-0 items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${item.completedAt ? "bg-emerald-500" : item.isOverdue ? "bg-red-500" : "bg-blue-500"}`} />
            <span className={`truncate font-semibold hover:text-blue-600 ${item.completedAt ? "text-slate-400 line-through" : "text-slate-800"}`}>
              {item.title}
            </span>
            {item.isImportant ? <Star size={13} className="shrink-0 fill-amber-400 text-amber-400" /> : null}
          </span>
          {item.content ? <span className="ml-4 mt-0.5 block truncate text-xs font-normal text-slate-500">{item.content}</span> : null}
        </button>
      </td>
      <td className={`px-5 py-3.5 text-sm font-medium ${item.isOverdue ? "text-red-600" : "text-slate-700"}`}>
        {item.dueDate ? formatDisplayDate(item.dueDate, locale) : ""}
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-block rounded-full px-2 py-0.5 text-sm font-medium ${item.completedAt ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
          {taskStatusLabel(item.taskStatus, locale)}
        </span>
      </td>
      <td className="px-5 py-3.5 text-sm font-medium text-slate-700">
        <span className="block w-full truncate">{item.assigneeName || item.assigneeEmail || t.unassigned}</span>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-1">
          {item.canEdit ? (
            <>
              <button
                type="button"
                onClick={() => openTaskEditor(item)}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-[#42526E] hover:bg-[#F4F5F7] hover:text-[#0052CC]"
                title={t.edit}
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDeleteTask(item)}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-[#42526E] hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                title={t.deleteTask}
              >
                <Trash2 size={16} />
              </button>
            </>
          ) : null}
        </div>
      </td>
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

  const scheduleRangeStart = scheduleView === "week"
    ? startOfWeek(scheduleCursor, { weekStartsOn: 1 })
    : startOfWeek(startOfMonth(scheduleCursor), { weekStartsOn: 1 });
  const scheduleRangeEnd = scheduleView === "week"
    ? endOfWeek(scheduleCursor, { weekStartsOn: 1 })
    : endOfWeek(endOfMonth(scheduleCursor), { weekStartsOn: 1 });
  const scheduleDays = eachDayOfInterval({ start: scheduleRangeStart, end: scheduleRangeEnd });
  const scheduleTitle = scheduleView === "week"
    ? `${scheduleRangeStart.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" })} - ${scheduleRangeEnd.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : scheduleCursor.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "long", year: "numeric" });
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
    if (item.itemType === "TODO") {
      openTaskDetail(item);
      return;
    }
    setDetailError("");
    setSelectedScheduleItemId(item.id);
  };

  const renderScheduleChip = (item: DepartmentItemCenterItem, compact = false) => {
    const type = getScheduleType(item);
    const time = scheduleTimeLabel(item, locale, scheduleView === "week" || scheduleView === "month");
    const title = item.kind === "ISSUE_DUE" && item.issueKey ? `${item.issueKey} ${item.title}` : item.title;
    const content = (
      <>
        {type === "reminder" ? <Bell size={compact ? 10 : 12} className="shrink-0" /> : null}
        <span className="truncate">{time ? `${time} · ${title}` : title}</span>
      </>
    );

    if (item.link && item.kind === "ISSUE_DUE") {
      return (
        <Link
          key={`${item.kind}-${item.id}`}
          href={item.link}
          onClick={(event) => event.stopPropagation()}
          className={`flex min-h-6 w-full min-w-0 items-center gap-1 border-l-2 px-1.5 py-1 text-left text-[11px] font-semibold leading-3 hover:brightness-95 ${compact ? "" : "h-full"} ${scheduleChipClass(type)}`}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        key={`${item.kind}-${item.id}`}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          openScheduleItem(item);
        }}
        className={`flex min-h-6 w-full min-w-0 items-center gap-1 border-l-2 px-1.5 py-1 text-left text-[11px] font-semibold leading-3 hover:brightness-95 ${compact ? "" : "h-full"} ${scheduleChipClass(type)}`}
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
      scopeType: nextKind === "memo" && !canCreateDepartmentItem ? "PERSONAL" : "DEPARTMENT",
      attendeeIds: nextKind === "meeting" ? current.attendeeIds : [],
    }));
  };

  const selectedScheduleDetails = selectedScheduleItem ? parseScheduleDetails(selectedScheduleItem.content) : null;
  const selectedScheduleType = selectedScheduleItem ? getScheduleType(selectedScheduleItem) : null;
  const selectedScheduleIsMemo = selectedScheduleType === "memo";
  const selectedScheduleVisibilityLabel = selectedScheduleItem?.scopeType === "DEPARTMENT" ? st.publicMemo : st.privateMemo;
  const selectedScheduleParticipants = selectedScheduleItem
    ? [
        {
          id: selectedScheduleItem.creatorId || "creator",
          name: selectedScheduleItem.creatorName || selectedScheduleItem.creatorEmail || "-",
          email: selectedScheduleItem.creatorEmail || "",
          isCreator: true,
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
            };
          }),
      ]
    : [];

  const renderScheduleCreateDialog = () => (
    <div className="w-full max-w-[600px] overflow-hidden rounded-lg border border-[#C3C6D6] bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#DFE1E6] px-6 py-4">
        <h3 className="text-xl font-semibold text-[#051A3E]">{editingScheduleItem ? t.edit : st.create}</h3>
        <button
          type="button"
          onClick={() => {
            setIsCreateOpen(false);
            setEditingScheduleItemId(null);
          }}
          className="rounded p-1 text-[#42526E] hover:bg-[#EBECF0]"
          aria-label={t.cancel}
        >
          <X size={20} />
        </button>
      </div>
      <form onSubmit={handleCreate}>
        <div className="max-h-[calc(100vh-220px)] space-y-6 overflow-y-auto p-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">{t.titleField}</label>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={form.scheduleKind === "out" ? (locale === "zh" ? "添加外出标题" : "Add out-of-office title") : form.scheduleKind === "memo" ? (locale === "zh" ? "添加备忘标题" : "Add memo title") : st.addMeetingTitle}
              className="h-10 w-full rounded border border-[#C1C7D0] px-3 text-sm text-[#051A3E] outline-none focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/20"
              required
            />
          </div>

          <div className={`grid gap-4 ${form.scheduleKind === "memo" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <DropdownField
              id="scheduleKind"
              label={t.type}
              value={form.scheduleKind}
              onChange={handleScheduleKindChange}
              options={scheduleKindOptions}
            />
            {form.scheduleKind !== "memo" ? (
              <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">{st.location}</label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4F5F7B]" />
                <input
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder={locale === "zh" ? "会议室 / 地点" : "Room or location"}
                />
              </div>
            </div>
            ) : (
              <>
                <DropdownField
                  id="scheduleMemoVisibility"
                  label={st.visibility}
                  value={form.scopeType === "DEPARTMENT" ? "DEPARTMENT" : "PERSONAL"}
                  onChange={(value) => setForm((current) => ({ ...current, scopeType: value as "PERSONAL" | "DEPARTMENT" | "PROJECT" }))}
                  options={[
                    ...(canCreateDepartmentItem ? [{ value: "DEPARTMENT", label: st.publicMemo }] : []),
                    { value: "PERSONAL", label: st.privateMemo },
                  ]}
                />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="scheduleMemoDate" className="text-sm font-medium text-slate-700">{st.date}</label>
                  <LocalizedDateInput
                    id="scheduleMemoDate"
                    locale={locale}
                    value={form.scheduleDate}
                    onChange={(event) => setForm((current) => ({ ...current, scheduleDate: event.target.value }))}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                </div>
              </>
            )}
          </div>

          {form.scheduleKind !== "memo" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="scheduleDate" className="text-sm font-medium text-slate-700">{st.date}</label>
                <LocalizedDateInput
                  id="scheduleDate"
                  locale={locale}
                  value={form.scheduleDate}
                  onChange={(event) => setForm((current) => ({ ...current, scheduleDate: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>
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
                required
              />
          </div>
          ) : null}

          {form.scheduleKind === "meeting" ? <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">{st.participants}</label>
            <div className="rounded border border-[#C1C7D0] bg-white p-2">
              <div className="flex min-h-8 flex-wrap gap-2">
                {selectedAttendees.map((attendee) => (
                  <span key={attendee.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#EBECF0] px-2 py-1 text-xs text-[#051A3E]">
                    <img src={attendeeAvatarSrc(attendee.id)} alt="" className="h-4 w-4 rounded-full border border-[#DFE1E6]" />
                    {attendee.name || attendee.email}
                    <button type="button" onClick={() => removeAttendee(attendee.id)} className="text-[#42526E] hover:text-red-600">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  value={form.attendeeQuery}
                  onChange={(event) => setForm((current) => ({ ...current, attendeeQuery: event.target.value }))}
                  placeholder={st.addGuest}
                  className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none"
                />
              </div>
              {form.attendeeQuery.trim() && attendeeMatches.length > 0 ? (
                <div className="mt-2 border-t border-[#DFE1E6] pt-2">
                  {attendeeMatches.map((attendee) => (
                    <button
                      key={attendee.id}
                      type="button"
                      onClick={() => addAttendee(attendee.id)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-[#051A3E] hover:bg-[#F4F5F7]"
                    >
                      <img src={attendeeAvatarSrc(attendee.id)} alt="" className="h-6 w-6 rounded-full border border-[#DFE1E6]" />
                      <span className="min-w-0 truncate">{attendee.name || attendee.email}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div> : null}

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">{st.meetingMinutes}</label>
            <textarea
              value={form.meetingMinutes}
              onChange={(event) => setForm((current) => ({ ...current, meetingMinutes: event.target.value }))}
              placeholder={st.agendaPlaceholder}
              rows={form.scheduleKind === "memo" ? 6 : 5}
              className="w-full rounded border border-[#C1C7D0] px-3 py-2 text-sm leading-6 text-[#051A3E] outline-none focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/20"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[#DFE1E6] bg-[#F4F5F7] px-6 py-4">
          <button
            type="button"
            onClick={() => {
              setIsCreateOpen(false);
              setEditingScheduleItemId(null);
            }}
            className="rounded px-4 py-2 text-sm font-semibold text-[#42526E] hover:bg-[#EBECF0]"
          >
            {t.cancel}
          </button>
          <button type="submit" disabled={isPending} className="rounded bg-[#0052CC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003D9B] disabled:opacity-50">
            {editingScheduleItem ? t.save : st.create}
          </button>
        </div>
      </form>
    </div>
  );

  const renderScheduleWorkspace = () => (
    <div className="h-[calc(100vh-112px)] min-h-[640px] overflow-hidden border border-[#DFE1E6] bg-white lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col border-r border-[#DFE1E6] bg-[#FAF9FF] p-4 lg:flex">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#42526E]">{st.eventTypes}</h3>
          <div className="space-y-2">
            {scheduleTypes.map((type) => (
              <label key={type.id} className="flex cursor-pointer items-center gap-2 text-sm text-[#172B4D]">
                <input
                  type="checkbox"
                  checked={visibleScheduleTypes[type.id]}
                  onChange={(event) => setVisibleScheduleTypes((current) => ({ ...current, [type.id]: event.target.checked }))}
                  className="h-4 w-4 rounded border-[#C1C7D0] text-[#0052CC] focus:ring-[#0052CC]"
                />
                <span>{type.label}</span>
                <span className="ml-auto tabular-nums text-xs font-semibold text-[#42526E]">{visibleScheduleTypeCounts[type.id] || 0}</span>
                <span className={`h-3 w-3 rounded-full ${scheduleDotClass(type.id)}`} />
              </label>
            ))}
          </div>
        </div>
        <div className="mt-6 border-t border-[#DFE1E6] pt-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#42526E]">{st.visibleSummary}</h3>
          <div className="space-y-2 text-sm text-[#172B4D]">
            <div className="flex items-center justify-between">
              <span>{st.todaySummary}</span>
              <span className="font-semibold tabular-nums">{todayScheduleCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{scheduleView === "month" ? st.month : scheduleView === "week" ? st.week : t.list}</span>
              <span className="font-semibold tabular-nums">{scheduleView === "list" ? scheduleListItems.length : calendarItems.length}</span>
            </div>
          </div>
        </div>
        <div className="mt-auto border-t border-[#DFE1E6] pt-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#42526E]">{st.quickCreate}</h3>
          <div className="grid grid-cols-3 gap-2">
            {scheduleKindOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  openCreateScheduleModal(scheduleCursor);
                  setForm((current) => ({
                    ...current,
                    scheduleKind: option.value as ScheduleCreateKind,
                    itemType: option.value === "memo" ? "REMINDER" : "EVENT",
                    scopeType: option.value === "memo" && !canCreateDepartmentItem ? "PERSONAL" : "DEPARTMENT",
                    attendeeIds: option.value === "meeting" ? current.attendeeIds : [],
                  }));
                }}
                className="flex h-16 flex-col items-center justify-center gap-2 rounded border border-[#DFE1E6] bg-white text-xs font-semibold text-[#172B4D] hover:border-[#0052CC] hover:text-[#0052CC]"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${option.indicatorClassName}`} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DFE1E6] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="text-xl font-semibold text-[#172B4D]">{scheduleTitle}</h2>
            <div className="flex overflow-hidden rounded border border-[#DFE1E6]">
              <button type="button" onClick={() => moveScheduleCursor("previous")} className="inline-flex h-8 w-8 items-center justify-center border-r border-[#DFE1E6] text-[#42526E] hover:bg-[#F4F5F7]">
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={() => moveScheduleCursor("next")} className="inline-flex h-8 w-8 items-center justify-center text-[#42526E] hover:bg-[#F4F5F7]">
                <ChevronRight size={16} />
              </button>
            </div>
            <button type="button" onClick={() => setScheduleCursor(new Date())} className="h-8 rounded border border-[#DFE1E6] bg-white px-3 text-sm font-medium text-[#172B4D] hover:bg-[#F4F5F7]">
              {st.today}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded border border-[#DFE1E6] bg-[#F4F5F7] p-1">
              {(["month", "week", "list"] as ScheduleView[]).map((nextView) => (
                <button
                  key={nextView}
                  type="button"
                  onClick={() => setScheduleView(nextView)}
                  className={`h-8 rounded px-4 text-sm font-medium ${scheduleView === nextView ? "bg-white text-[#0052CC] shadow-sm" : "text-[#42526E] hover:text-[#0052CC]"}`}
                >
                  {nextView === "month" ? st.month : nextView === "week" ? st.week : t.list}
                </button>
              ))}
            </div>
          </div>
        </div>

        {scheduleView === "list" ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4">
            <div className="divide-y divide-[#DFE1E6] border border-[#DFE1E6]">
              {scheduleListItems.length === 0 ? <p className="p-6 text-sm text-[#42526E]">{st.noEvents}</p> : scheduleListItems.map((item) => {
                const type = getScheduleType(item);
                return (
                  <button key={`${item.kind}-${item.id}`} type="button" onClick={() => openScheduleItem(item)} className="grid w-full grid-cols-[120px_minmax(0,1fr)_160px] items-center gap-4 bg-white px-4 py-3 text-left text-sm hover:bg-[#F4F5F7]">
                    <span className="text-xs font-semibold text-[#42526E]">{new Date(item.date).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", weekday: "short" })}</span>
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${scheduleDotClass(type)}`} />
                        <span className="truncate font-semibold text-[#172B4D]">{item.kind === "ISSUE_DUE" && item.issueKey ? `${item.issueKey} ${item.title}` : item.title}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[#42526E]">{item.projectKey || item.scopeLabel}</span>
                    </span>
                    <span className="justify-self-end rounded bg-[#F4F5F7] px-2 py-1 text-xs font-semibold text-[#42526E]">{scheduleTypeLabel(type, locale)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : scheduleView === "week" ? (
          <div className="shrink-0 bg-white">
            <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-[#DFE1E6]">
              <div className="border-r border-[#DFE1E6]" />
              {scheduleDays.map((date) => {
                const isCurrentDay = isSameDay(date, new Date());
                return (
                  <div key={date.toISOString()} className="border-r border-[#DFE1E6] px-3 py-3 text-center last:border-r-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#42526E]">
                      {date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { weekday: "short" })}
                    </div>
                    <div className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isCurrentDay ? "bg-[#D8E2FF] text-[#0052CC]" : "text-[#172B4D]"}`}>
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-[#DFE1E6] bg-[#FAFBFC]">
              <div className="border-r border-[#DFE1E6] px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[#6B778C]">
                {st.noTime}
              </div>
              {scheduleDays.map((date) => {
                const key = format(date, "yyyy-MM-dd");
                const allDayItems = [...(allDayGroupedByDay[key] || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const shownItems = allDayItems.slice(0, 3);
                return (
                  <div
                    key={`${key}-all-day`}
                    onClick={() => openCreateScheduleModal(date)}
                    className="min-h-[54px] border-r border-[#DFE1E6] bg-white px-2 py-2 text-left hover:bg-[#FAFBFC] last:border-r-0"
                  >
                    <div className="space-y-1">
                      {shownItems.map((item) => renderScheduleChip(item, true))}
                      {allDayItems.length > shownItems.length ? (
                        <span className="block px-1 text-[11px] font-medium text-[#42526E]">+{allDayItems.length - shownItems.length} {st.moreItems}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 border-b border-[#DFE1E6] bg-white">
            {scheduleDays.slice(0, 7).map((date) => (
              <div key={date.toISOString()} className="border-r border-[#DFE1E6] px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#172B4D] last:border-r-0">
                {date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { weekday: "short" })}
              </div>
            ))}
          </div>
        )}

        {scheduleView === "week" ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            <div
              className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]"
              style={{ height: (WEEK_END_HOUR - WEEK_START_HOUR) * WEEK_HOUR_HEIGHT + WEEK_GRID_TOP_PADDING, paddingTop: WEEK_GRID_TOP_PADDING }}
            >
              <div className="relative border-r border-[#DFE1E6] bg-[#FAFBFC]">
                {WEEK_HOURS.slice(0, -1).map((hour) => (
                  <div
                    key={hour}
                    className="absolute right-2 text-[11px] font-medium tabular-nums text-[#6B778C]"
                    style={{ top: (hour - WEEK_START_HOUR) * WEEK_HOUR_HEIGHT }}
                  >
                    {`${String(hour).padStart(2, "0")}:00`}
                  </div>
                ))}
              </div>
              {scheduleDays.map((date) => {
                const key = format(date, "yyyy-MM-dd");
                const dayItems = [...(timedGroupedByDay[key] || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                return (
                  <div
                    key={`${key}-time-grid`}
                    className="relative border-r border-[#DFE1E6] last:border-r-0"
                  >
                    {WEEK_HOURS.slice(0, -1).map((hour) => {
                      const startTime = `${String(hour).padStart(2, "0")}:00`;
                      const endTime = `${String(hour + 1).padStart(2, "0")}:00`;
                      return (
                        <button
                          key={hour}
                          type="button"
                          onClick={() => openCreateScheduleModal(date, startTime, endTime)}
                          className="block w-full border-b border-[#EBECF0] text-left hover:bg-[#F4F5F7]"
                          style={{ height: WEEK_HOUR_HEIGHT }}
                          aria-label={`${startTime}-${endTime}`}
                        />
                      );
                    })}
                    {dayItems.map((item) => {
                      const layout = getWeekTimedLayout(item);
                      if (!layout) return null;
                      return (
                        <div
                          key={`${item.kind}-${item.id}`}
                          className="absolute"
                          style={{
                            left: WEEK_EVENT_INSET,
                            right: WEEK_EVENT_INSET,
                            top: layout.top + WEEK_EVENT_INSET,
                            height: Math.max(24, layout.height - WEEK_EVENT_INSET * 2),
                          }}
                        >
                          {renderScheduleChip(item)}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ) : scheduleView === "month" ? (
          <div className="grid min-h-0 flex-1 grid-cols-7 auto-rows-[minmax(120px,1fr)] overflow-y-auto bg-white">
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
                  className={`group flex min-h-[120px] cursor-pointer flex-col border-r border-b border-[#DFE1E6] bg-white p-2 text-left hover:bg-[#FAFBFC] ${muted ? "text-[#A5ADBA]" : "text-[#172B4D]"}`}
                >
                  <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold ${isCurrentDay ? "bg-[#D8E2FF] text-[#0052CC]" : ""}`}>
                    {date.getDate()}
                  </div>
                  <div className="min-h-0 w-full space-y-1 overflow-hidden">
                    {shownItems.map((item) => renderScheduleChip(item, true))}
                    {dayItems.length > shownItems.length ? (
                      <span className="block px-1 text-[11px] font-medium text-[#42526E]">+{dayItems.length - shownItems.length} {st.moreItems}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

      </section>

      {selectedScheduleItem ? (
        <div className="fixed inset-0 z-50 bg-[#091E42]/30" onClick={() => setSelectedScheduleItemId(null)}>
        <div
          className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-[#DFE1E6] bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#DFE1E6] px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${scheduleBadgeClass(getScheduleType(selectedScheduleItem))}`}>
                  {scheduleTypeLabel(getScheduleType(selectedScheduleItem), locale)}
                </span>
                {selectedScheduleIsMemo ? (
                  <span className="inline-flex rounded border border-[#DFE1E6] bg-[#F4F5F7] px-2 py-1 text-xs font-semibold text-[#42526E]">
                    {selectedScheduleVisibilityLabel}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 break-words text-lg font-semibold text-[#172B4D]">{selectedScheduleItem.title}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {selectedScheduleItem.kind === "REMINDER" && selectedScheduleItem.canEdit ? (
                <>
                  <button
                    type="button"
                    onClick={() => openEditScheduleItem(selectedScheduleItem)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded text-[#42526E] hover:bg-[#F4F5F7] hover:text-[#0052CC]"
                    title={t.edit}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleDeleteScheduleItem}
                    className="inline-flex h-8 w-8 items-center justify-center rounded text-[#42526E] hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title={st.deleteSchedule}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              ) : null}
              <button type="button" onClick={() => setSelectedScheduleItemId(null)} className="inline-flex h-8 w-8 items-center justify-center rounded text-[#42526E] hover:bg-[#F4F5F7]" title={t.cancel}>
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm text-[#172B4D]">
            {detailError ? <div className="rounded border border-red-100 bg-red-50 p-3 text-sm text-red-600">{detailError}</div> : null}
            <div className="flex gap-3">
              <Clock size={17} className="mt-0.5 shrink-0 text-[#42526E]" />
              <div>
                <p className="font-semibold">{scheduleDateLabel(selectedScheduleItem, locale)}</p>
                <p className="mt-0.5 text-[#42526E]">{scheduleTimeLabel(selectedScheduleItem, locale, true) || st.noTime}</p>
                {selectedScheduleItem.dueDate ? <p className="text-xs text-[#42526E]">{t.dueDate}: {formatDisplayDate(selectedScheduleItem.dueDate, locale)}</p> : null}
              </div>
            </div>
            {!selectedScheduleIsMemo ? (
              <>
                <div className="flex gap-3">
                  <MapPin size={17} className="mt-0.5 shrink-0 text-[#42526E]" />
                  <p>{selectedScheduleDetails?.location || "-"}</p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#42526E]">{st.participants}</p>
                  <div className="min-w-0 space-y-2">
                    {selectedScheduleParticipants.map((participant) => (
                      <div key={`${participant.id}-${participant.name}`} className="flex min-w-0 items-center gap-2">
                        {participant.id.startsWith("guest:") ? (
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EBECF0] text-xs font-semibold text-[#42526E]">
                            {participant.name.slice(0, 1).toUpperCase()}
                          </span>
                        ) : (
                          <img src={attendeeAvatarSrc(participant.id)} alt="" className="h-7 w-7 shrink-0 rounded-full border border-[#DFE1E6]" />
                        )}
                        <span className="min-w-0 truncate font-medium">{participant.name}</span>
                        {participant.isCreator ? <span className="shrink-0 rounded bg-[#E9F2FF] px-1.5 py-0.5 text-[11px] font-semibold text-[#0052CC]">{t.openedBy}</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            {selectedScheduleDetails?.notes ? (
              <div className="rounded border border-[#DFE1E6] bg-[#FAFBFC] p-3 leading-6">
                {selectedScheduleDetails.notes}
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[#DFE1E6] bg-[#F4F5F7] px-5 py-4">
              {selectedScheduleItem.link ? (
                <Link href={selectedScheduleItem.link} className="rounded bg-[#0052CC] px-3 py-2 text-sm font-semibold text-white hover:bg-[#003D9B]">
                  {st.openTask}
                </Link>
              ) : null}
              <button type="button" onClick={() => setSelectedScheduleItemId(null)} className="rounded border border-[#DFE1E6] bg-white px-3 py-2 text-sm font-semibold text-[#172B4D] hover:bg-[#F4F5F7]">
                {t.cancel}
              </button>
          </div>
        </div>
        </div>
      ) : null}
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
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={(event) => {
                event.stopPropagation();
                handleToggleNotePinned(note);
              }}
              className={`h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-amber-50 disabled:opacity-50 ${
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
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover/note:flex"
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

    return (
      <div className="h-[calc(100vh-172px)] min-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-slate-50">
          <div className="space-y-1 px-3 pt-4">
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
            <button type="button" onClick={() => setNoteFolderFilter("pinned")} className={folderButtonClass(isPinnedFilter)}>
              <span className="inline-flex min-w-0 items-center gap-2"><Star size={15} />{t.pinnedNotes}</span>
              <span>{activeNotes.filter((note) => isNotePinned(note)).length}</span>
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
                  {visibleNoteFolders.map((folder) => {
                    const folderFilter = isPinnedFilter ? `pinned-folder:${folder.id}` as const : `folder:${folder.id}` as const;

                    return (
                    <div key={folder.id} className="group">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setNoteFolderFilter(folderFilter)}
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
                          className={folderButtonClass(noteFolderFilter === folderFilter, folder.id)}
                        >
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <Folder size={15} />
                            <span className="truncate">{folder.name}</span>
                          </span>
                          <span>{visibleFolderCounts[folder.id] || 0}</span>
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
            <div
              className={
                isNoteFullscreen
                  ? "fixed inset-4 z-50 min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
                  : "min-h-0 flex-1 overflow-hidden p-0"
              }
            >
                <RichTextEditor
                  key={selectedNote.id}
                  ref={noteEditorRef}
                  value={noteForm.content}
                  onChange={handleNoteContentChange}
                  readOnly={selectedIsDeleted}
                  height={560}
                  borderless
                  issueMentionOptions={noteIssueOptions}
                  issueMentionLabel={locale === "zh" ? "插入问题" : "Insert issue"}
                  onIssueLinkClick={(issueId) => setSelectedNoteIssueId(issueId)}
                  isFullscreen={isNoteFullscreen}
                  onToggleFullscreen={() => {
                    if (isNoteFullscreen) void saveSelectedNoteNow();
                    setIsNoteFullscreen((current) => !current);
                  }}
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
                <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
                  {[
                    [issueText.status, getWorkflowStatusName(selectedNoteIssue.status, selectedNoteIssue.workflowStatuses, locale)],
                    [issueText.priority, priorityLabel(selectedNoteIssue.priority, locale)],
                    [issueText.type, getIssueTypeLabel(selectedNoteIssue.type, locale)],
                    [issueText.assignee, selectedNoteIssue.assigneeName || selectedNoteIssue.assigneeEmail || t.unassigned],
                    [issueText.dueDate, selectedNoteIssue.dueDate ? formatDisplayDate(selectedNoteIssue.dueDate, locale) : t.noDueDate],
                    [locale === "zh" ? "计划" : "Plan", selectedNoteIssue.planName || ""],
                    [issueText.sprint, selectedNoteIssue.iterationName || ""],
                    [issueText.reporter, selectedNoteIssue.reporterName || selectedNoteIssue.reporterEmail || "-"],
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
                      <p className="mt-0.5 min-w-0 break-words font-medium text-slate-800" title={fullTimeTitle}>{value}</p>
                    </div>
                    );
                  })}
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
                    <MessageSquare size={13} />
                    {locale === "zh" ? `评论 (${selectedNoteIssue.comments.length})` : `Comments (${selectedNoteIssue.comments.length})`}
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
                      {locale === "zh" ? "暂无评论" : "No comments"}
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
                  href={`/issues/${selectedNoteIssue.id}`}
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">
            {activeTab === "tasks" ? t.tasks : activeTab === "schedule" ? t.schedule : t.notesTab}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "notes" ? (
            <>
              <div className="relative w-72 max-w-[42vw]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#42526E]" />
                <input
                  value={noteQuery}
                  onChange={(event) => setNoteQuery(event.target.value)}
                  placeholder={t.searchNotes}
                  className="h-10 w-full rounded border border-transparent bg-[#F4F5F7] pl-9 pr-9 text-sm text-[#172B4D] outline-none focus:border-[#0052CC] focus:bg-white focus:ring-1 focus:ring-[#0052CC]"
                />
                {noteQuery ? (
                  <button
                    type="button"
                    onClick={() => setNoteQuery("")}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-[#42526E] hover:bg-[#EBECF0]"
                    title={t.clearSearch}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={openCreateNote}
                disabled={isPending}
                className="inline-flex h-10 items-center gap-2 rounded bg-[#0052CC] px-4 text-sm font-semibold text-white hover:bg-[#003D9B] disabled:opacity-50"
              >
                <Plus size={16} />
                {t.addNote}
              </button>
            </>
          ) : null}
          {activeTab === "schedule" ? (
            <>
              <div className="relative w-72 max-w-[42vw]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#42526E]" />
                <input
                  value={scheduleSearch}
                  onChange={(event) => setScheduleSearch(event.target.value)}
                  placeholder={st.search}
                  className="h-10 w-full rounded border border-transparent bg-[#F4F5F7] pl-9 pr-9 text-sm text-[#172B4D] outline-none focus:border-[#0052CC] focus:bg-white focus:ring-1 focus:ring-[#0052CC]"
                />
                {scheduleSearch ? (
                  <button
                    type="button"
                    onClick={() => setScheduleSearch("")}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-[#42526E] hover:bg-[#EBECF0]"
                    title={t.clearSearch}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => openCreateScheduleModal()}
                className="inline-flex h-10 items-center gap-2 rounded bg-[#0052CC] px-4 text-sm font-semibold text-white hover:bg-[#003D9B]"
              >
                <Plus size={16} />
                {st.createMeeting}
              </button>
            </>
          ) : null}
          {activeTab === "tasks" ? (
            <>
              <div className="relative w-72 max-w-[42vw]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#42526E]" />
                <input
                  value={taskQuery}
                  onChange={(event) => setTaskQuery(event.target.value)}
                  placeholder={t.searchTasks}
                  className="h-10 w-full rounded border border-transparent bg-[#F4F5F7] pl-9 pr-9 text-sm text-[#172B4D] outline-none focus:border-[#0052CC] focus:bg-white focus:ring-1 focus:ring-[#0052CC]"
                />
                {taskQuery ? (
                  <button
                    type="button"
                    onClick={() => setTaskQuery("")}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-[#42526E] hover:bg-[#EBECF0]"
                    title={t.clearSearch}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-10 items-center gap-2 rounded bg-[#0052CC] px-4 text-sm font-semibold text-white hover:bg-[#003D9B]"
              >
                <Plus size={16} />
                {t.addTask}
              </button>
            </>
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

      {activeTab === "schedule" ? (
        renderScheduleWorkspace()
      ) : activeTab === "notes" ? (
        renderNotesView()
      ) : (
        activeTab === "tasks" ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-left">
                <colgroup>
                  <col />
                  <col className="w-36" />
                  <col className="w-36" />
                  <col className="w-48" />
                  <col className="w-24" />
                </colgroup>
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-4 font-semibold">{t.titleField}</th>
                    <th className="px-5 py-4 font-semibold">{t.dueDate}</th>
                    <th className="px-5 py-4 font-semibold">{t.status}</th>
                    <th className="px-5 py-4 font-semibold">{t.assignee}</th>
                    <th className="px-4 py-4 text-right font-semibold">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleItems.map(renderTaskRow)}
                </tbody>
              </table>
              {visibleItems.length === 0 ? (
                <div className="flex min-h-52 items-center justify-center px-5 py-16 text-center text-slate-500">
                  <p className="text-sm">{t.empty}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3">{visibleItems.length === 0 ? <p className="text-sm text-slate-500">{t.empty}</p> : visibleItems.map(renderItem)}</div>
        )
      )}

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          {activeTab === "schedule" ? (
            renderScheduleCreateDialog()
          ) : (
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
                  {activeTab === "tasks" || form.itemType === "TODO" ? <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">{t.dueDate}</label>
                    <LocalizedDateInput
                      locale={locale}
                      value={form.dueAt}
                      onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div> : null}
                  {(activeTab === "tasks" || form.itemType === "TODO") ? <DropdownField
                    id="taskAssignee"
                    label={t.assignee}
                    value={currentTaskAssigneeValue}
                    onChange={applyTaskAssigneeChoice}
                    options={taskAssigneeChoices.map((choice) => ({ value: choice.value, label: choice.label }))}
                    className="flex-1"
                  /> : null}
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
          )}
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
                {selectedTask.comments.length > 0 ? (
                  selectedTask.comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{comment.authorName || comment.authorEmail}</span>
                        <span>{new Date(comment.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{comment.content}</p>
                    </div>
                  ))
                ) : null}
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
                    onClick={() => handleDeleteTask()}
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
