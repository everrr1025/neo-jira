"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import {
  createDepartmentProject,
  deleteDepartmentProject,
  setDepartmentMemberRole,
  updateDepartmentProject,
} from "@/app/actions/departments";
import {
  createAnnouncementNotification,
  resendAnnouncementNotification,
  revokeAnnouncementNotification,
} from "@/app/actions/announcements";
import DepartmentNotificationDetailDialog from "@/components/DepartmentNotificationDetailDialog";
import ProjectNavIcon from "@/components/ProjectNavIcon";
import type { RichTextEditorHandle } from "@/components/RichTextEditor";
import type { DepartmentWorkspaceData, DepartmentWorkspaceProject } from "@/lib/departmentWorkspace";
import type { DepartmentItemCenterItem } from "@/lib/departmentReminders";
import type {
  DepartmentNotificationListItem,
  DepartmentNotificationPermission,
} from "@/lib/departmentNotifications";
import type { Locale } from "@/lib/i18n";

const TEXT = {
  en: {
    workspace: "Department Workspace",
    head: "Head",
    assistant: "Assistant",
    member: "Member",
    members: "Members",
    projects: "Projects",
    issues: "Issues",
    announcements: "Announcements",
    noDescription: "No description provided.",
    noAnnouncements: "No department announcements yet.",
    noMembers: "No department members.",
    noProjects: "No projects created for this department yet.",
    latestAnnouncements: "Latest announcements",
    allNotifications: "All notifications",
    allAnnouncements: "All announcements",
    newNotification: "New notification",
    notificationLevel: "Level",
    departmentNotification: "Department",
    projectNotification: "Project",
    systemNotification: "System",
    notificationTitle: "Title",
    notificationContent: "Content",
    notificationProject: "Project",
    selectProject: "Select project",
    notificationTitlePlaceholder: "Notification title",
    notificationContentPlaceholder: "Plain text content...",
    noProjectOptions: "No manageable projects.",
    notificationCreateFailed: "Failed to create notification.",
    notificationManageFailed: "Failed to update notification.",
    revokeNotification: "Revoke",
    deleteNotification: "Delete",
    resendNotification: "Resend",
    revoked: "Revoked",
    sent: "Sent",
    unread: "Unread",
    read: "Read",
    systemActor: "System",
    projectOverview: "Project overview",
    memberProjects: "Projects",
    role: "Role",
    email: "Email",
    name: "Name",
    actions: "Actions",
    setAssistant: "Set as Assistant",
    setMember: "Set as Member",
    createProject: "Create project",
    projectName: "Name",
    projectKey: "Key",
    projectDescription: "Description",
    projectNamePlaceholder: "e.g. Mobile App Upgrade",
    projectKeyPlaceholder: "e.g. APP",
    projectDescriptionPlaceholder: "Optional details...",
    deleteProject: "Delete",
    memberButton: "Members",
    create: "Create",
    cancel: "Cancel",
    memberListHint:
      "Department heads can only set assistants here. Adding or removing department members stays with system admins.",
    projectNameRequired: "Project name and key are required.",
    projectKeyExists: "Project key already exists.",
    projectMembersScope: "Project members must belong to this department.",
    projectOwnerRequired: "Project owner must be selected from project members.",
    projectNotFound: "Project not found.",
    projectDeleteFailed: "Failed to delete project.",
    projectCreateFailed: "Failed to create project.",
    memberRoleFailed: "Failed to update member role.",
    ownerLabel: "Owner",
    currentUser: "Current user",
    pinned: "Pinned",
    createdAt: "Created",
    key: "Key",
    description: "Description",
    viewProject: "View",
    page: "Page",
    previous: "Previous",
    next: "Next",
    departmentDescription: "Department description",
    deleteWarning: "Delete this project? All related project data will be removed.",
    typeToConfirm: "Please type the exact project name to confirm:",
    deleteNameMismatch: "Project name confirmation does not match.",
    unassignedOwner: "Unassigned",
    mySchedule: "My schedule",
    today: "Today",
    thisWeek: "This week",
    noSchedule: "No schedule items.",
    allSchedule: "All schedule",
    myProjects: "My projects",
    noMyProjects: "No projects assigned to you.",
    unresolved: "Unresolved",
    noPriorityIssues: "No urgent or high priority unresolved issues.",
    urgent: "Urgent",
    high: "High",
    assignee: "Assignee",
    dueDate: "Due",
    noDueDate: "No due date",
    welcome: "Welcome",
    participatingProjects: "Projects",
    position: "Position",
    progress: "Progress",
    ownerLabelShort: "Owner",
    projectMembers: "Project members",
    openProject: "Open project",
    due: "Due",
    allDay: "All day",
    activeIteration: "Current iteration",
    noActiveIteration: "No active iteration",
  },
  zh: {
    workspace: "部门工作台",
    head: "负责人",
    assistant: "助理",
    member: "成员",
    members: "成员",
    projects: "项目",
    issues: "问题",
    announcements: "通知",
    noDescription: "暂无描述",
    noAnnouncements: "暂无部门通知。",
    noMembers: "暂无部门成员。",
    noProjects: "该部门暂未创建项目。",
    latestAnnouncements: "最新公告",
    allNotifications: "全部通知",
    allAnnouncements: "全部公告",
    newNotification: "新建通知",
    notificationLevel: "通知级别",
    departmentNotification: "部门",
    projectNotification: "项目",
    systemNotification: "系统",
    notificationTitle: "通知标题",
    notificationContent: "通知内容",
    notificationProject: "项目",
    selectProject: "选择项目",
    notificationTitlePlaceholder: "请输入通知标题",
    notificationContentPlaceholder: "请输入纯文本内容...",
    noProjectOptions: "暂无可管理项目。",
    notificationCreateFailed: "创建通知失败。",
    notificationManageFailed: "更新通知失败。",
    revokeNotification: "撤回",
    deleteNotification: "删除",
    resendNotification: "再次发出",
    revoked: "已撤回",
    sent: "已发出",
    unread: "未读",
    read: "已读",
    systemActor: "系统",
    projectOverview: "项目概览",
    memberProjects: "所属项目",
    role: "角色",
    email: "邮箱",
    name: "姓名",
    actions: "操作",
    setAssistant: "设为助理",
    setMember: "设为成员",
    createProject: "新建项目",
    projectName: "名称",
    projectKey: "标识",
    projectDescription: "描述",
    projectNamePlaceholder: "例如：移动端升级",
    projectKeyPlaceholder: "例如：APP",
    projectDescriptionPlaceholder: "可选说明...",
    deleteProject: "删除",
    memberButton: "成员",
    create: "创建",
    cancel: "取消",
    memberListHint: "部门负责人在这里仅可设置助理。添加或移出部门成员仍由系统管理员负责。",
    projectNameRequired: "项目名称和标识不能为空。",
    projectKeyExists: "项目标识已存在。",
    projectMembersScope: "项目成员必须属于当前部门。",
    projectOwnerRequired: "项目负责人必须从项目成员中选择。",
    projectNotFound: "项目不存在。",
    projectDeleteFailed: "删除项目失败。",
    projectCreateFailed: "创建项目失败。",
    memberRoleFailed: "更新成员角色失败。",
    ownerLabel: "负责人",
    currentUser: "当前用户",
    pinned: "置顶",
    createdAt: "创建时间",
    key: "标识",
    description: "描述",
    viewProject: "查看",
    page: "第",
    previous: "上一页",
    next: "下一页",
    departmentDescription: "部门描述",
    deleteWarning: "确定删除该项目吗？该项目的所有关联数据都会被删除。",
    typeToConfirm: "请输入准确的项目名称以确认删除：",
    deleteNameMismatch: "输入的项目名称不正确。",
    unassignedOwner: "未指派",
    mySchedule: "我的日程",
    today: "今天",
    thisWeek: "本周",
    noSchedule: "暂无日程事项。",
    allSchedule: "全部日程",
    myProjects: "我的项目",
    noMyProjects: "暂无你参与的项目。",
    unresolved: "待解决",
    noPriorityIssues: "暂无紧急或高优先级待解决问题。",
    urgent: "紧急",
    high: "高",
    assignee: "经办人",
    dueDate: "截止",
    noDueDate: "无截止日期",
    welcome: "欢迎",
    participatingProjects: "参与项目",
    position: "岗位",
    progress: "进度",
    ownerLabelShort: "负责人",
    projectMembers: "项目成员",
    openProject: "打开项目",
    due: "截止",
    allDay: "全天",
    activeIteration: "当前迭代",
    noActiveIteration: "无活跃迭代",
  },
} as const;

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

type ProjectColumnId = "name" | "key" | "description" | "owner" | "members" | "createdAt" | "actions";
type ProjectSortField = Exclude<ProjectColumnId, "actions">;
type SortDirection = "asc" | "desc";
type ProjectColumnConfig = {
  id: ProjectColumnId;
  label: string;
  width: number;
};
type SelectOption = {
  value: string;
  label: string;
};

const PROJECT_DEFAULT_COLUMN_WIDTHS: Record<ProjectColumnId, number> = {
  name: 260,
  key: 110,
  description: 220,
  owner: 140,
  members: 120,
  createdAt: 150,
  actions: 260,
};

const ROLE_BADGE: Record<string, { bg: string; text: string }> = {
  HEAD: { bg: "bg-amber-100", text: "text-amber-800" },
  ASSISTANT: { bg: "bg-blue-100", text: "text-blue-800" },
  MEMBER: { bg: "bg-slate-100", text: "text-slate-600" },
};

function displayMember(member: { userName: string | null; userEmail: string }) {
  return member.userName || member.userEmail;
}
function getDepartmentRoleText(role: string | undefined, t: typeof TEXT[Locale]) {
  if (role === "HEAD") return t.head;
  if (role === "ASSISTANT") return t.assistant;
  return t.member;
}
function getNotificationLevelText(level: DepartmentNotificationListItem["level"], t: typeof TEXT[Locale]) {
  if (level === "DEPARTMENT") return t.departmentNotification;
  if (level === "PROJECT") return t.projectNotification;
  return t.systemNotification;
}
function detailDialogLabels(t: typeof TEXT[Locale], locale: Locale) {
  return {
    level: {
      department: t.departmentNotification,
      project: t.projectNotification,
      system: t.systemNotification,
    },
    revoked: t.revoked,
    sent: t.sent,
    title: t.notificationTitle,
    content: t.notificationContent,
    project: t.notificationProject,
    createdBy: locale === "zh" ? "创建人" : "Creator",
    createdAt: t.createdAt,
    status: locale === "zh" ? "状态" : "Status",
    resend: t.resendNotification,
    revoke: t.revokeNotification,
  };
}
function formatRelativeTime(value: string, locale: Locale) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return locale === "zh" ? "刚刚" : "Just now";
  if (diffMs < hour) {
    const count = Math.max(1, Math.floor(diffMs / minute));
    return locale === "zh" ? `${count}分钟前` : `${count}m ago`;
  }
  if (diffMs < day) {
    const count = Math.max(1, Math.floor(diffMs / hour));
    return locale === "zh" ? `${count}小时前` : `${count}h ago`;
  }
  const count = Math.max(1, Math.floor(diffMs / day));
  return locale === "zh" ? `${count}天前` : `${count}d ago`;
}
function compareText(left: string | null | undefined, right: string | null | undefined) {
  return (left || "").localeCompare(right || "", undefined, { numeric: true, sensitivity: "base" });
}
function startOfLocalDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}
function endOfLocalDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}
function startOfLocalWeek(date: Date) {
  const nextDate = startOfLocalDay(date);
  const day = nextDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  nextDate.setDate(nextDate.getDate() + diff);
  return nextDate;
}
function formatScheduleTime(item: DepartmentItemCenterItem, locale: Locale, t: typeof TEXT[Locale]) {
  const date = new Date(item.date);
  if (item.itemType === "TODO" || item.itemType === "ISSUE_DUE") return t.due;
  if (date.getHours() === 0 && date.getMinutes() === 0) return t.allDay;
  return date.toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" });
}
function formatScheduleDay(dateValue: string, locale: Locale) {
  const date = new Date(dateValue);
  return {
    weekday: date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { weekday: "short" }),
    day: date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { day: "2-digit" }),
  };
}
function scheduleAccentClass(item: DepartmentItemCenterItem) {
  if (item.isOverdue || item.priority === "URGENT") return "bg-red-600";
  if (item.itemType === "TODO" || item.itemType === "ISSUE_DUE") return "bg-amber-500";
  if (item.itemType === "EVENT") return "bg-zinc-950";
  return "bg-zinc-500";
}
function formatDateRange(startDate: string, endDate: string, locale: Locale) {
  const localeKey = locale === "zh" ? "zh-CN" : "en-US";
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.toLocaleDateString(localeKey, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(localeKey, { month: "short", day: "numeric" })}`;
}
function getDaysLeft(endDate: string, locale: Locale) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
  return locale === "zh" ? `剩余 ${days} 天` : `${days}d remaining`;
}
function formatIssueDueDate(dueDate: string | null, locale: Locale, fallback: string) {
  if (!dueDate) return fallback;
  return new Date(dueDate).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  });
}
function isScheduleItemRelatedToUser(item: DepartmentItemCenterItem, userId: string) {
  if (item.kind === "ISSUE_DUE") return item.assigneeId === userId;
  if (item.creatorId === userId || item.assigneeId === userId) return true;
  return item.attendees.some((attendee) => attendee.userId === userId);
}

function InlineSelect({
  value,
  options,
  onChange,
  renderSummary,
  className = "relative",
  matchTriggerWidth = true,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  renderSummary: (label: string) => ReactNode;
  className?: string;
  matchTriggerWidth?: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    openingUpward: boolean;
  }>({ left: 0, width: 0, openingUpward: false });

  const updateMenuPosition = useCallback(() => {
    const rect = summaryRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openingUpward = spaceBelow < 280;

    if (openingUpward) {
      setMenuPosition({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        width: rect.width,
        openingUpward: true,
      });
    } else {
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        openingUpward: false,
      });
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false;
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
    setIsOpen(false);
  };

  return (
    <details
      ref={detailsRef}
      className={className}
      onToggle={(event) => {
        const open = event.currentTarget.open;
        setIsOpen(open);
        if (open) updateMenuPosition();
      }}
    >
      <summary ref={summaryRef} className="list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden">
        {renderSummary(selectedOption?.label || "")}
      </summary>
      {isOpen ? (
        <div
          className="fixed z-50 flex max-w-80 flex-col gap-1 rounded-md border border-[#e2e8f0] bg-white p-1 shadow-md"
          style={{
            top: menuPosition.top,
            bottom: menuPosition.bottom,
            left: menuPosition.left,
            minWidth: matchTriggerWidth ? menuPosition.width : undefined,
            width: matchTriggerWidth ? menuPosition.width : undefined,
          }}
        >
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`block w-full rounded-sm px-2 py-1.5 text-left text-sm transition-colors ${
                option.value === value ? "bg-[#f4f4f5] font-medium text-[#09090b]" : "text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#09090b]"
              }`}
            >
              <span className="block truncate">{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </details>
  );
}

function PaginationFooter({
  locale,
  page,
  totalPages,
  totalItems,
  pageSize,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}: {
  locale: Locale;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const rangeStart = totalItems > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, totalItems);
  const showing = locale === "zh" ? "显示" : "Showing";
  const to = locale === "zh" ? "至" : "to";
  const of = locale === "zh" ? "共" : "of";
  const perPage = locale === "zh" ? "每页" : "Per page";
  const pageLabel = locale === "zh" ? "第" : "Page";
  const pageSizeOptions = PAGE_SIZE_OPTIONS.map((option) => ({ value: String(option), label: String(option) }));

  return (
    <div className="border-t bg-slate-50 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="font-medium text-slate-500">
        {showing}
        <span className="font-bold text-slate-800"> {rangeStart} </span>
        {to}
        <span className="font-bold text-slate-800"> {rangeEnd} </span>
        {of}
        <span className="font-bold text-slate-800"> {totalItems} </span>
        {itemLabel}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500 [&>span:first-child]:hidden">
          <span>{perPage}</span>
          <span>{perPage}</span>
          <InlineSelect
            value={String(pageSize)}
            options={pageSizeOptions}
            onChange={(value) => onPageSizeChange(Number(value))}
            renderSummary={(label) => (
              <span className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                {label}
              </span>
            )}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="px-2 font-medium leading-none text-slate-700">
            {locale === "zh" ? `${pageLabel} ${page} / ${totalPages || 1} 页` : `${pageLabel} ${page} of ${totalPages || 1}`}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages || 1, page + 1))}
            disabled={page === totalPages || totalPages === 0}
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
export default function DepartmentManageClient({
  department,
  locale,
  currentUserId,
  isHead,
  canManageProjects,
  mode,
  notifications = [],
  notificationPermission = {
    canCreate: false,
    canCreateDepartment: false,
    canManageDepartment: false,
    manageableProjects: [],
  },
  scheduleItems = [],
}: {
  department: DepartmentWorkspaceData;
  locale: Locale;
  currentUserId: string;
  isHead: boolean;
  canManageProjects: boolean;
  mode: "dashboard" | "members" | "projects";
  notifications?: DepartmentNotificationListItem[];
  notificationPermission?: DepartmentNotificationPermission;
  scheduleItems?: DepartmentItemCenterItem[];
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const myProjectStorageKey = `department:${department.id}:user:${currentUserId}:my-project`;
  const [isPending, startTransition] = useTransition();
  const [pageErrorMsg, setPageErrorMsg] = useState("");
  const [createProjectErrorMsg, setCreateProjectErrorMsg] = useState("");
  const [deleteErrorMsg, setDeleteErrorMsg] = useState("");
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateNotificationOpen, setIsCreateNotificationOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<DepartmentNotificationListItem | null>(null);
  const [notificationErrorMsg, setNotificationErrorMsg] = useState("");
  const [deletingProject, setDeletingProject] = useState<DepartmentWorkspaceProject | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [editingProject, setEditingProject] = useState<DepartmentWorkspaceProject | null>(null);
  const [memberPage, setMemberPage] = useState(1);
  const [memberPageSize, setMemberPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [projectPage, setProjectPage] = useState(1);
  const [projectPageSize, setProjectPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [projectSortField, setProjectSortField] = useState<ProjectSortField>("createdAt");
  const [projectSortDirection, setProjectSortDirection] = useState<SortDirection>("desc");
  const [projectColumnOrder, setProjectColumnOrder] = useState<ProjectColumnId[]>([
    "name",
    "key",
    "description",
    "owner",
    "members",
    "createdAt",
    "actions",
  ]);
  const [projectColumnWidths, setProjectColumnWidths] = useState(PROJECT_DEFAULT_COLUMN_WIDTHS);
  const [projectDragSourceIndex, setProjectDragSourceIndex] = useState<number | null>(null);
  const [projectDragOverIndex, setProjectDragOverIndex] = useState<number | null>(null);
  const [projectDragOverSide, setProjectDragOverSide] = useState<"left" | "right" | null>(null);
  const [scheduleView, setScheduleView] = useState<"today" | "week">("week");
  const [selectedMyProjectId, setSelectedMyProjectId] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem(myProjectStorageKey) || ""
  );
  const projectResizingRef = useRef<{
    colIndex: number;
    nextColIndex: number;
    startX: number;
    startWidth: number;
    nextStartWidth: number;
  } | null>(null);
  const resendContentEditorRef = useRef<RichTextEditorHandle>(null);
  const [newProject, setNewProject] = useState({
    name: "",
    key: "",
    description: "",
  });
  const [notificationForm, setNotificationForm] = useState({
    level: notificationPermission.canCreateDepartment ? "DEPARTMENT" : "PROJECT",
    projectId: notificationPermission.manageableProjects[0]?.id || "",
    title: "",
    content: "",
  });
  const [resendForm, setResendForm] = useState({
    title: "",
    content: "",
  });
  const [editProjectForm, setEditProjectForm] = useState({
    name: "",
    key: "",
    description: "",
  });

  const sortedMembers = [...department.members].sort((a, b) => {
    const order: Record<string, number> = { HEAD: 0, ASSISTANT: 1, MEMBER: 2 };
    return (order[a.role] ?? 3) - (order[b.role] ?? 3) || displayMember(a).localeCompare(displayMember(b));
  });
  const projectColumnsById = useMemo(
    () =>
      new Map<ProjectColumnId, ProjectColumnConfig>([
        ["name", { id: "name", label: t.projectName, width: PROJECT_DEFAULT_COLUMN_WIDTHS.name }],
        ["key", { id: "key", label: t.key, width: PROJECT_DEFAULT_COLUMN_WIDTHS.key }],
        ["description", { id: "description", label: t.description, width: PROJECT_DEFAULT_COLUMN_WIDTHS.description }],
        ["owner", { id: "owner", label: t.ownerLabel, width: PROJECT_DEFAULT_COLUMN_WIDTHS.owner }],
        ["members", { id: "members", label: t.members, width: PROJECT_DEFAULT_COLUMN_WIDTHS.members }],
        ["createdAt", { id: "createdAt", label: t.createdAt, width: PROJECT_DEFAULT_COLUMN_WIDTHS.createdAt }],
        ["actions", { id: "actions", label: t.actions, width: PROJECT_DEFAULT_COLUMN_WIDTHS.actions }],
      ]),
    [t.actions, t.createdAt, t.description, t.key, t.members, t.ownerLabel, t.projectName]
  );
  const projectColumns = useMemo(
    () =>
      projectColumnOrder
        .map((columnId) => {
          const column = projectColumnsById.get(columnId);
          if (!column) return null;
          return { ...column, width: projectColumnWidths[columnId] ?? column.width };
        })
        .filter((column): column is ProjectColumnConfig => Boolean(column)),
    [projectColumnOrder, projectColumnWidths, projectColumnsById]
  );
  const projectColumnsTotalWidth = useMemo(
    () => projectColumns.reduce((total, column) => total + column.width, 0),
    [projectColumns]
  );
  const sortedProjects = useMemo(() => {
    const getValue = (project: DepartmentWorkspaceProject, field: ProjectSortField) => {
      if (field === "name") return project.name;
      if (field === "key") return project.key;
      if (field === "description") return project.description || "";
      if (field === "owner") return project.ownerName || "";
      if (field === "members") return project.members.length;
      return new Date(project.createdAt).getTime();
    };

    return [...department.projects].sort((left, right) => {
      const leftValue = getValue(left, projectSortField);
      const rightValue = getValue(right, projectSortField);
      const result =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : compareText(String(leftValue), String(rightValue));
      return projectSortDirection === "asc" ? result : -result;
    });
  }, [department.projects, projectSortDirection, projectSortField]);
  const myProjects = useMemo(
    () => department.projects.filter((project) => project.members.some((member) => member.userId === currentUserId)),
    [currentUserId, department.projects]
  );
  const currentDepartmentMember = useMemo(
    () => department.members.find((member) => member.userId === currentUserId) || null,
    [currentUserId, department.members]
  );
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
        month: "long",
        day: "numeric",
        weekday: "long",
      }),
    [locale]
  );
  const selectedMyProject = useMemo(
    () => myProjects.find((project) => project.id === selectedMyProjectId) || myProjects[0] || null,
    [myProjects, selectedMyProjectId]
  );
  const handleMyProjectChange = (projectId: string) => {
    setSelectedMyProjectId(projectId);
    window.localStorage.setItem(myProjectStorageKey, projectId);
  };
  const dashboardScheduleItems = useMemo(() => {
    const todayStart = startOfLocalDay(new Date());
    const todayEnd = endOfLocalDay(todayStart);
    const weekStart = startOfLocalWeek(todayStart);
    const weekEnd = endOfLocalDay(new Date(weekStart));
    weekEnd.setDate(weekEnd.getDate() + 6);
    const rangeStart = scheduleView === "today" ? todayStart : weekStart;
    const rangeEnd = scheduleView === "today" ? todayEnd : weekEnd;

    return scheduleItems
      .filter((item) => !item.completedAt)
      .filter((item) => isScheduleItemRelatedToUser(item, currentUserId))
      .filter((item) => {
        const itemDate = new Date(item.date);
        return itemDate >= rangeStart && itemDate <= rangeEnd;
      })
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
  }, [currentUserId, scheduleItems, scheduleView]);

  const totalMemberPages = Math.max(1, Math.ceil(sortedMembers.length / memberPageSize));
  const currentMemberPage = Math.min(memberPage, totalMemberPages);
  const paginatedMembers = sortedMembers.slice(
    (currentMemberPage - 1) * memberPageSize,
    currentMemberPage * memberPageSize
  );
  const totalProjectPages = Math.max(1, Math.ceil(sortedProjects.length / projectPageSize));
  const currentProjectPage = Math.min(projectPage, totalProjectPages);
  const paginatedProjects = sortedProjects.slice(
    (currentProjectPage - 1) * projectPageSize,
    currentProjectPage * projectPageSize
  );
  const selectedMyProjectProgress = selectedMyProject && selectedMyProject.issuesCount > 0
    ? Math.round((selectedMyProject.completedIssuesCount / selectedMyProject.issuesCount) * 100)
    : 0;

  const translateError = (message: string | undefined, fallback: string) => {
    if (!message) return fallback;
    if (message.includes("Project name and key are required")) return t.projectNameRequired;
    if (message.includes("Project key already exists")) return t.projectKeyExists;
    if (message.includes("Selected project members must belong to this department")) return t.projectMembersScope;
    if (message.includes("Project owner must be selected from project members")) return t.projectOwnerRequired;
    if (message.includes("Project not found")) return t.projectNotFound;
    if (message.includes("Project name confirmation does not match")) return t.deleteNameMismatch;
    return message;
  };

  const resetNotificationForm = () => {
    setNotificationForm({
      level: notificationPermission.canCreateDepartment ? "DEPARTMENT" : "PROJECT",
      projectId: notificationPermission.manageableProjects[0]?.id || "",
      title: "",
      content: "",
    });
  };

  const handleCreateNotification = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotificationErrorMsg("");
    startTransition(async () => {
      const result = await createAnnouncementNotification({
        departmentId: department.id,
        level: notificationForm.level as "DEPARTMENT" | "PROJECT",
        projectId: notificationForm.level === "PROJECT" ? notificationForm.projectId : null,
        title: notificationForm.title,
        content: notificationForm.content,
      });
      if (!result.success) {
        setNotificationErrorMsg(translateError(result.error, t.notificationCreateFailed));
        return;
      }
      setIsCreateNotificationOpen(false);
      resetNotificationForm();
      router.refresh();
    });
  };

  const handleRevokeNotification = (notificationId: string) => {
    setNotificationErrorMsg("");
    startTransition(async () => {
      const result = await revokeAnnouncementNotification(notificationId);
      if (!result.success) {
        setNotificationErrorMsg(translateError(result.error, t.notificationManageFailed));
        return;
      }
      resendContentEditorRef.current?.commitPendingUploads();
      setSelectedNotification(null);
      router.refresh();
    });
  };

  const handleResendNotification = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedNotification) return;
    setNotificationErrorMsg("");
    startTransition(async () => {
      const result = await resendAnnouncementNotification(selectedNotification.id, resendForm);
      if (!result.success) {
        setNotificationErrorMsg(translateError(result.error, t.notificationManageFailed));
        return;
      }
      setSelectedNotification(null);
      router.refresh();
    });
  };

  const handleProjectSort = (field: ProjectSortField) => {
    if (projectSortField === field) {
      setProjectSortDirection((current) => current === "asc" ? "desc" : "asc");
    } else {
      setProjectSortField(field);
      setProjectSortDirection(field === "createdAt" ? "desc" : "asc");
    }
    setProjectPage(1);
  };

  const handleProjectColumnDragStart = (event: React.DragEvent, index: number) => {
    if (projectColumns[index]?.id === "actions") return;
    event.dataTransfer.setData("colIndex", String(index));
    event.dataTransfer.effectAllowed = "move";
    setProjectDragSourceIndex(index);
  };

  const handleProjectColumnDragOver = (event: React.DragEvent, index: number) => {
    if (projectColumns[index]?.id === "actions" || projectColumns[projectDragSourceIndex ?? -1]?.id === "actions") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setProjectDragOverIndex(index);
    setProjectDragOverSide(event.clientX < rect.left + rect.width / 2 ? "left" : "right");
  };

  const handleProjectColumnDrop = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault();
    if (projectColumns[targetIndex]?.id === "actions") return;
    const sourceIndex = Number(event.dataTransfer.getData("colIndex"));
    if (Number.isFinite(sourceIndex) && sourceIndex !== targetIndex && projectColumns[sourceIndex]?.id !== "actions") {
      const nextColumnOrder = [...projectColumnOrder];
      const [removed] = nextColumnOrder.splice(sourceIndex, 1);
      const adjustedTarget =
        projectDragOverSide === "right"
          ? sourceIndex < targetIndex
            ? targetIndex
            : targetIndex + 1
          : sourceIndex < targetIndex
            ? targetIndex - 1
            : targetIndex;
      nextColumnOrder.splice(Math.max(0, adjustedTarget), 0, removed);
      setProjectColumnOrder(nextColumnOrder);
    }
    setProjectDragSourceIndex(null);
    setProjectDragOverIndex(null);
    setProjectDragOverSide(null);
  };

  const handleProjectColumnDragEnd = () => {
    setProjectDragSourceIndex(null);
    setProjectDragOverIndex(null);
    setProjectDragOverSide(null);
  };

  const handleProjectColumnResizeStart = useCallback(
    (event: React.MouseEvent, colIndex: number) => {
      event.preventDefault();
      event.stopPropagation();
      const column = projectColumns[colIndex];
      const nextColumn = projectColumns[colIndex + 1];
      if (!column || !nextColumn || column.id === "actions" || nextColumn.id === "actions") return;
      projectResizingRef.current = {
        colIndex,
        nextColIndex: colIndex + 1,
        startX: event.clientX,
        startWidth: column.width,
        nextStartWidth: nextColumn.width,
      };

      const onMouseMove = (moveEvent: MouseEvent) => {
        const resizeState = projectResizingRef.current;
        if (!resizeState) return;
        const resizeColumnId = projectColumns[resizeState.colIndex]?.id;
        const nextResizeColumnId = projectColumns[resizeState.nextColIndex]?.id;
        if (!resizeColumnId || !nextResizeColumnId) return;

        const minWidth = 80;
        const delta = moveEvent.clientX - resizeState.startX;
        const boundedDelta = Math.min(
          resizeState.nextStartWidth - minWidth,
          Math.max(minWidth - resizeState.startWidth, delta)
        );
        setProjectColumnWidths((current) => ({
          ...current,
          [resizeColumnId]: resizeState.startWidth + boundedDelta,
          [nextResizeColumnId]: resizeState.nextStartWidth - boundedDelta,
        }));
      };

      const onMouseUp = () => {
        projectResizingRef.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    },
    [projectColumns]
  );

  const renderProjectHeaderLabel = (column: ProjectColumnConfig) => {
    const sortField = column.id === "actions" ? null : column.id;
    const isSorted = sortField === projectSortField;

    return (
      <button
        type="button"
        onClick={() => {
          if (sortField) handleProjectSort(sortField);
        }}
        disabled={!sortField}
        className={`inline-flex max-w-full min-w-0 items-center gap-1 font-semibold ${
          sortField ? "cursor-pointer text-slate-600 hover:text-slate-800" : "cursor-default text-slate-500"
        }`}
        draggable={false}
      >
        <span className="truncate">{column.label}</span>
        {sortField && isSorted ? projectSortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : null}
      </button>
    );
  };

  const renderProjectCell = (project: DepartmentWorkspaceProject, column: ProjectColumnConfig) => {
    if (column.id === "name") {
      return (
        <td key={column.id} className="overflow-hidden px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <ProjectNavIcon className="h-[18px] w-[18px]" />
            </div>
            <Link
              href={`/projects/select?projectId=${project.id}`}
              className="truncate font-semibold text-slate-800 transition-colors hover:text-emerald-700"
            >
              {project.name}
            </Link>
          </div>
        </td>
      );
    }

    if (column.id === "key") {
      return (
        <td key={column.id} className="overflow-hidden px-5 py-3.5">
          <span className="block truncate font-mono text-xs text-slate-500">{project.key}</span>
        </td>
      );
    }

    if (column.id === "description") {
      return (
        <td key={column.id} className="overflow-hidden px-5 py-3.5 text-slate-600">
          <div className="truncate">{project.description || t.noDescription}</div>
        </td>
      );
    }

    if (column.id === "owner") {
      return (
        <td key={column.id} className="overflow-hidden px-5 py-3.5">
          {project.ownerId ? (
            <span className="block truncate font-medium text-slate-700">{project.ownerName}</span>
          ) : (
            <span className="block truncate text-slate-400">{t.unassignedOwner}</span>
          )}
        </td>
      );
    }

    if (column.id === "members") {
      return (
        <td key={column.id} className="overflow-hidden px-5 py-3.5">
          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {project.members.length} {t.members}
          </span>
        </td>
      );
    }

    if (column.id === "createdAt") {
      return (
        <td key={column.id} className="overflow-hidden px-5 py-3.5 text-xs font-medium text-slate-500">
          <span className="block truncate">{new Date(project.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}</span>
        </td>
      );
    }

    return (
      <td key={column.id} className="overflow-hidden px-5 py-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <a
            href={`/projects/select?projectId=${project.id}`}
            className="inline-flex shrink-0 items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            <span className="whitespace-nowrap">{t.viewProject}</span>
          </a>
          <Link
            href={`/departments/${department.id}/projects/${project.id}/members`}
            className="inline-flex shrink-0 items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            <span className="whitespace-nowrap">{t.memberButton}</span>
          </Link>
          {canManageProjects ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingProject(project);
                  setEditProjectForm({
                    name: project.name,
                    key: project.key,
                    description: project.description || "",
                  });
                  setCreateProjectErrorMsg("");
                  setIsEditProjectOpen(true);
                }}
                disabled={isPending}
                className="inline-flex shrink-0 items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
              >
                <span className="whitespace-nowrap">{locale === "zh" ? "编辑" : "Edit"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteErrorMsg("");
                  setDeleteConfirmText("");
                  setDeletingProject(project);
                }}
                disabled={isPending}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 size={12} />
                <span className="whitespace-nowrap">{t.deleteProject}</span>
              </button>
            </>
          ) : null}
        </div>
      </td>
    );
  };

  useEffect(() => {
    if (mode !== "dashboard") return;

    window.dispatchEvent(new CustomEvent("department-header-title", { detail: { title: department.name } }));
    return () => {
      window.dispatchEvent(new CustomEvent("department-header-title", { detail: { title: "" } }));
    };
  }, [department.name, mode]);

  const handleSetRole = (userId: string, role: "ASSISTANT" | "MEMBER") => {
    setPageErrorMsg("");
    startTransition(async () => {
      const res = await setDepartmentMemberRole(department.id, userId, role);
      if (!res.success) {
        setPageErrorMsg(translateError(res.error, t.memberRoleFailed));
        return;
      }
      router.refresh();
    });
  };

  const handleCreateProject = (event: React.FormEvent) => {
    event.preventDefault();
    setCreateProjectErrorMsg("");
    startTransition(async () => {
      const res = await createDepartmentProject(department.id, newProject);
      if (!res.success) {
        setCreateProjectErrorMsg(translateError(res.error, t.projectCreateFailed));
        return;
      }
      setIsCreateProjectOpen(false);
      setCreateProjectErrorMsg("");
      setNewProject({ name: "", key: "", description: "" });
      router.refresh();
    });
  };

  const handleDeleteProject = () => {
    if (!deletingProject) return;
    setDeleteErrorMsg("");
    startTransition(async () => {
      const res = await deleteDepartmentProject(department.id, deletingProject.id, deleteConfirmText);
      if (!res.success) {
        setDeleteErrorMsg(translateError(res.error, t.projectDeleteFailed));
        return;
      }
      setDeletingProject(null);
      setDeleteConfirmText("");
      router.refresh();
    });
  };

  const handleEditProject = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingProject) return;
    setCreateProjectErrorMsg("");
    startTransition(async () => {
      const res = await updateDepartmentProject(department.id, editingProject.id, editProjectForm);
      if (!res.success) {
        setCreateProjectErrorMsg(translateError(res.error, t.projectCreateFailed));
        return;
      }
      setIsEditProjectOpen(false);
      setEditingProject(null);
      setCreateProjectErrorMsg("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {mode === "dashboard" ? (
        <div className="space-y-6 text-[#18181b]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-[#e2e8f0] bg-white p-5 md:col-span-2">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold leading-5 text-[#09090b]">{department.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#71717a]">{department.description || t.noDescription}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-[#e2e8f0] bg-white text-[#3f3f46]">
                  <Building2 size={24} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded bg-[#f4f4f5] px-2 py-0.5 text-xs font-medium text-[#18181b]">{department.key}</span>
                <span className="rounded bg-[#f4f4f5] px-2 py-0.5 text-xs font-medium text-[#18181b]">
                  {t.head}: {department.headName || t.unassignedOwner}
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-center rounded-lg border border-[#e2e8f0] bg-white p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#71717a]">{t.members} / {t.projects}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-3xl font-semibold leading-none tracking-[-0.02em] text-[#09090b]">{department.members.length}</div>
                  <div className="mt-1 text-xs font-medium text-[#71717a]">{t.members}</div>
                </div>
                <div>
                  <div className="text-3xl font-semibold leading-none tracking-[-0.02em] text-[#09090b]">{department.projects.length}</div>
                  <div className="mt-1 text-xs font-medium text-[#71717a]">{t.projects}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center rounded-lg border border-[#e2e8f0] bg-white p-5">
              <div className="text-sm font-semibold leading-5 text-[#09090b]">{todayLabel}</div>
              <div className="mt-4 flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 truncate text-lg font-semibold leading-6 text-[#09090b]">
                  {displayMember(currentDepartmentMember || { userName: null, userEmail: t.currentUser })}
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2 text-xs font-medium text-[#3f3f46]">
                  <span className="rounded-md bg-[#f4f4f5] px-2 py-1">
                    {getDepartmentRoleText(currentDepartmentMember?.role, t)}
                  </span>
                  <span className="rounded-md bg-[#f4f4f5] px-2 py-1">
                    {t.participatingProjects}: {myProjects.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-1">
              <div className="flex flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white px-4 py-3">
                  <h2 className="text-sm font-semibold text-[#18181b]">{t.mySchedule}</h2>
                  <div className="flex rounded-md bg-[#e2e8f0] p-0.5">
                    {(["today", "week"] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setScheduleView(view)}
                        className={`h-7 rounded-md px-3 text-xs font-medium transition-colors ${
                          scheduleView === view
                            ? "bg-white text-[#18181b] ring-1 ring-[#e2e8f0]"
                            : "text-[#71717a] hover:text-[#18181b]"
                        }`}
                      >
                        {view === "today" ? t.today : t.thisWeek}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={`min-h-0 flex-1 p-2 ${scheduleView === "week" ? "max-h-[280px] overflow-y-auto" : "overflow-y-auto"}`}>
                  {dashboardScheduleItems.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-[#71717a]">{t.noSchedule}</div>
                  ) : (
                    <div className="space-y-0.5">
                      {dashboardScheduleItems.map((item) => {
                        const scheduleDay = formatScheduleDay(item.date, locale);
                        const title = item.issueKey ? `${item.issueKey} ${item.title}` : item.title;
                        const isScheduleEvent = item.itemType === "EVENT" || item.itemType === "REMINDER";
                        const itemHref = isScheduleEvent
                          ? `/departments/${department.id}/items?tab=schedule&selected=${item.id}`
                          : item.link || `/departments/${department.id}/items?tab=schedule`;
                        return (
                          <Link
                            key={`${item.kind}-${item.id}`}
                            href={itemHref}
                            target={isScheduleEvent ? "_blank" : undefined}
                            rel={isScheduleEvent ? "noreferrer" : undefined}
                            className={`flex min-w-0 items-center gap-3 rounded px-2 py-2 transition-colors hover:bg-[#f4f4f5] ${
                              item.isOverdue && scheduleView === "today" ? "bg-[#fef2f2]/70" : ""
                            }`}
                          >
                            {scheduleView === "today" ? (
                              <span className={`h-2 w-2 shrink-0 rounded-full ${scheduleAccentClass(item)}`} />
                            ) : (
                              <span className="w-10 shrink-0 rounded-lg border border-[#e2e8f0] bg-[#f4f4f5] py-0.5 text-center">
                                <span className="block text-[10px] font-semibold uppercase leading-3 text-[#71717a]">{scheduleDay.weekday}</span>
                                <span className="block text-sm font-semibold leading-4 text-[#18181b]">{scheduleDay.day}</span>
                              </span>
                            )}
                            <span className={`w-14 shrink-0 text-xs font-medium ${item.isOverdue ? "text-[#ba1a1a]" : "text-[#71717a]"}`}>
                              {formatScheduleTime(item, locale, t)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#18181b]">{title}</span>
                            {item.projectKey ? (
                              <span className="hidden shrink-0 rounded bg-[#f4f4f5] px-2 py-0.5 text-[11px] font-semibold text-[#09090b] sm:inline">
                                {item.projectKey}
                              </span>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white px-4 py-3">
                  <h2 className="text-sm font-semibold text-[#18181b]">{t.latestAnnouncements}</h2>
                  <Link
                    href={`/departments/${department.id}/notifications?category=ANNOUNCEMENT`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-md px-2 py-1 text-xs font-semibold text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#09090b]"
                  >
                    {t.allAnnouncements}
                  </Link>
                </div>
                <div className="p-0">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-sm text-[#71717a]">{t.noAnnouncements}</div>
                  ) : (
                    <div>
                      {notifications.map((notification, index) => {
                        const isRead = notification.read;
                        return (
                          <Link
                            key={notification.receiptId}
                            href={`/departments/${department.id}/notifications?category=ANNOUNCEMENT&selected=${notification.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white ${
                              index < notifications.length - 1 ? "border-b border-[#f4f4f5]" : ""
                            }`}
                          >
                            <span
                              className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                isRead
                                  ? "border border-[#e2e8f0] bg-[#f4f4f5] text-[#3f3f46]"
                                  : "bg-[#09090b] text-white"
                              }`}
                            >
                              {getNotificationLevelText(notification.level, t)}
                            </span>
                            <span className="min-w-0 flex-1 text-sm leading-5 text-[#18181b]">{notification.title}</span>
                            <span className="shrink-0 whitespace-nowrap text-[10px] text-[#a1a1aa]">
                              {formatRelativeTime(notification.createdAt, locale)}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="flex h-[520px] flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white px-4 py-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-[#18181b]">{t.myProjects}</h2>
                    {myProjects.length > 0 ? (
                      <InlineSelect
                        value={selectedMyProject?.id || myProjects[0]?.id || ""}
                        options={myProjects.map((project) => ({ value: project.id, label: project.name }))}
                        onChange={handleMyProjectChange}
                        className="relative max-w-[240px]"
                        renderSummary={(label) => (
                          <span className="inline-flex h-8 max-w-[240px] items-center gap-1 rounded-md border border-[#e2e8f0] bg-white px-2 text-xs font-medium text-[#3f3f46] transition-colors hover:bg-[#f4f4f5]">
                            <span className="min-w-0 truncate">{label}</span>
                            <ChevronDown size={14} className="shrink-0 text-[#71717a]" />
                          </span>
                        )}
                        matchTriggerWidth={false}
                      />
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right text-xs text-[#71717a]">
                    <span className="font-medium text-[#18181b]">
                      {selectedMyProject?.activeIteration?.name || t.noActiveIteration}
                    </span>
                  </div>
                </div>
                {selectedMyProject ? (
                  <>
                    <div className="border-b border-[#e2e8f0] bg-white p-4">
                      <div className="mb-2 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#09090b]">{t.progress}</p>
                          <p className="mt-0.5 text-xs text-[#71717a]">
                            {selectedMyProject.activeIteration
                              ? `${formatDateRange(selectedMyProject.activeIteration.startDate, selectedMyProject.activeIteration.endDate, locale)} · ${getDaysLeft(selectedMyProject.activeIteration.endDate, locale)}`
                              : t.noActiveIteration}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-[#09090b]">{selectedMyProjectProgress}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#e4e4e7]">
                        <div className="h-full rounded-full bg-[#09090b]" style={{ width: `${selectedMyProjectProgress}%` }} />
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col space-y-3 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-[#18181b]">{t.unresolved}</h3>
                        <span className="text-xs font-medium text-[#71717a]">{selectedMyProject.priorityIssues.length}</span>
                      </div>
                      {selectedMyProject.priorityIssues.length > 0 ? (
                        <div className="min-h-0 max-h-[300px] space-y-2 overflow-y-auto pr-1">
                          {selectedMyProject.priorityIssues.map((issue) => (
                            <Link
                              key={issue.id}
                              href={`/issues/${issue.id}`}
                              className="flex items-center justify-between gap-3 rounded-md border border-[#e2e8f0] bg-white px-3 py-2 transition-colors hover:border-[#d4d4d8] hover:bg-[#fafafa]"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium leading-5 text-[#18181b]">{issue.title}</div>
                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-[#71717a]">
                                  <span>{issue.key}</span>
                                  <span className="truncate">{t.assignee}: {issue.assigneeName}</span>
                                  <span>{t.dueDate}: {formatIssueDueDate(issue.dueDate, locale, t.noDueDate)}</span>
                                </div>
                              </div>
                              <span
                                className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${
                                  issue.priority === "URGENT"
                                    ? "bg-[#fef2f2] text-[#ba1a1a]"
                                    : "bg-[#fff7ed] text-[#c2410c]"
                                }`}
                              >
                                {issue.priority === "URGENT" ? t.urgent : t.high}
                              </span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed border-[#e2e8f0] px-3 py-8 text-center text-sm text-[#71717a]">
                          {t.noPriorityIssues}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-sm text-[#71717a]">{t.noMyProjects}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pageErrorMsg ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {pageErrorMsg}
        </div>
      ) : null}

      {mode === "members" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">{t.members}</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="border-b px-5 py-4">{t.name}</th>
                  <th className="border-b px-5 py-4">{t.email}</th>
                  <th className="border-b px-5 py-4">{t.role}</th>
                  <th className="border-b px-5 py-4">{t.memberProjects}</th>
                  {isHead ? <th className="border-b px-5 py-4">{t.actions}</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedMembers.length === 0 ? (
                  <tr>
                    <td colSpan={isHead ? 5 : 4} className="px-5 py-8 text-center text-slate-500">
                      {t.noMembers}
                    </td>
                  </tr>
                ) : (
                  paginatedMembers.map((member) => {
                    const badge = ROLE_BADGE[member.role] || ROLE_BADGE.MEMBER;
                    const canToggleAssistant = isHead && member.role !== "HEAD" && member.userId !== currentUserId;
                    return (
                      <tr key={member.userId} className="align-top hover:bg-slate-50">
                        <td className="px-5 py-4 font-medium text-slate-800">
                          <span>{displayMember(member)}</span>
                        </td>
                        <td className="px-5 py-4 text-slate-500">{member.userEmail}</td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.bg} ${badge.text}`}>
                            {member.role === "HEAD" ? t.head : member.role === "ASSISTANT" ? t.assistant : t.member}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            {member.projects.length === 0 ? (
                              <span className="text-xs text-slate-400">-</span>
                            ) : (
                              member.projects.map((project) => (
                                <span
                                  key={project.id}
                                  className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                >
                                  <span>{project.name}</span>
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        {isHead ? (
                          <td className="px-5 py-4">
                            {canToggleAssistant ? (
                              member.role === "ASSISTANT" ? (
                                <button
                                  type="button"
                                  onClick={() => handleSetRole(member.userId, "MEMBER")}
                                  disabled={isPending}
                                  className="text-xs font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
                                >
                                  {t.setMember}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSetRole(member.userId, "ASSISTANT")}
                                  disabled={isPending}
                                  className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                >
                                  {t.setAssistant}
                                </button>
                              )
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {sortedMembers.length > 0 ? (
              <PaginationFooter
                locale={locale}
                page={currentMemberPage}
                totalPages={totalMemberPages}
                totalItems={sortedMembers.length}
                pageSize={memberPageSize}
                itemLabel={t.members}
                onPageChange={setMemberPage}
                onPageSizeChange={(nextPageSize) => {
                  setMemberPageSize(nextPageSize);
                  setMemberPage(1);
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {mode === "projects" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">{t.projects}</h2>
            {canManageProjects ? (
              <button
                type="button"
                onClick={() => {
                  setPageErrorMsg("");
                  setCreateProjectErrorMsg("");
                  setNewProject({ name: "", key: "", description: "" });
                  setIsCreateProjectOpen(true);
                }}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[#09090b] px-3 text-sm font-semibold text-white hover:bg-[#003D9B]"
              >
                <Plus size={16} />
                {t.createProject}
              </button>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    {projectColumns.map((column, index) => {
                      const showLeftLine =
                        projectDragOverIndex === index && projectDragOverSide === "left" && projectDragSourceIndex !== index;
                      const showRightLine =
                        projectDragOverIndex === index && projectDragOverSide === "right" && projectDragSourceIndex !== index;
                      const isDragging = projectDragSourceIndex === index;

                      return (
                        <th
                          key={column.id}
                          className={`group/column relative select-none overflow-hidden py-4 transition-colors ${
                            column.id === "actions" ? "px-5" : "cursor-move px-5 hover:bg-slate-100 active:cursor-move"
                          } ${isDragging ? "opacity-40" : ""}`}
                          style={{ width: `${(column.width / projectColumnsTotalWidth) * 100}%` }}
                          draggable={column.id !== "actions"}
                          onDragStart={(event) => handleProjectColumnDragStart(event, index)}
                          onDragOver={(event) => handleProjectColumnDragOver(event, index)}
                          onDrop={(event) => handleProjectColumnDrop(event, index)}
                          onDragEnd={handleProjectColumnDragEnd}
                          onDragLeave={() => {
                            if (projectDragOverIndex === index) {
                              setProjectDragOverIndex(null);
                              setProjectDragOverSide(null);
                            }
                          }}
                        >
                          {showLeftLine ? <div className="absolute bottom-0 left-0 top-0 z-10 w-0.5 bg-blue-500" /> : null}
                          {renderProjectHeaderLabel(column)}
                          {showRightLine ? <div className="absolute bottom-0 right-0 top-0 z-10 w-0.5 bg-blue-500" /> : null}
                          {column.id !== "actions" && projectColumns[index + 1]?.id !== "actions" ? (
                            <div
                              className="absolute bottom-0 right-0 top-0 z-20 w-4 cursor-ew-resize"
                              onMouseDown={(event) => handleProjectColumnResizeStart(event, index)}
                              draggable={false}
                              title={locale === "zh" ? "拖拽调整列宽" : "Drag to resize column"}
                            />
                          ) : null}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedProjects.map((project) => (
                    <tr key={project.id} className="transition-colors hover:bg-slate-50/70">
                      {projectColumns.map((column) => renderProjectCell(project, column))}
                    </tr>
                  ))}
                  {department.projects.length === 0 ? (
                    <tr>
                      <td colSpan={projectColumns.length} className="px-5 py-16 text-center text-slate-500">
                        {t.noProjects}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {sortedProjects.length > 0 ? (
              <PaginationFooter
                locale={locale}
                page={currentProjectPage}
                totalPages={totalProjectPages}
                totalItems={sortedProjects.length}
                pageSize={projectPageSize}
                itemLabel={t.projects}
                onPageChange={setProjectPage}
                onPageSizeChange={(nextPageSize) => {
                  setProjectPageSize(nextPageSize);
                  setProjectPage(1);
                }}
              />
            ) : null}
          </div>


          {isCreateProjectOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
              <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <h2 className="text-xl font-bold text-slate-800">{t.createProject}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateProjectOpen(false);
                      setCreateProjectErrorMsg("");
                    }}
                    className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreateProject} className="flex flex-1 flex-col overflow-hidden">
                  <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
                    {createProjectErrorMsg ? (
                      <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                        {createProjectErrorMsg}
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        {t.projectName} <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        autoFocus
                        value={newProject.name}
                        onChange={(event) => setNewProject((current) => ({ ...current, name: event.target.value }))}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder={t.projectNamePlaceholder}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        {t.projectKey} <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        maxLength={10}
                        value={newProject.key}
                        onChange={(event) =>
                          setNewProject((current) => ({ ...current, key: event.target.value.toUpperCase() }))
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder={t.projectKeyPlaceholder}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-700">{t.projectDescription}</label>
                      <textarea
                        rows={5}
                        value={newProject.description}
                        onChange={(event) =>
                          setNewProject((current) => ({ ...current, description: event.target.value }))
                        }
                        className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder={t.projectDescriptionPlaceholder}
                      />
                    </div>
                  </div>

                  <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateProjectOpen(false);
                        setCreateProjectErrorMsg("");
                      }}
                      disabled={isPending}
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isPending || !newProject.name.trim() || !newProject.key.trim()}
                      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                      {t.create}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {isEditProjectOpen && editingProject ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <h2 className="text-xl font-bold text-slate-900">{locale === "zh" ? "编辑项目" : "Edit project"}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditProjectOpen(false);
                      setEditingProject(null);
                      setCreateProjectErrorMsg("");
                    }}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleEditProject} className="space-y-4 px-6 py-5">
                  {createProjectErrorMsg ? (
                    <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                      {createProjectErrorMsg}
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">{t.projectName}</label>
                    <input
                      required
                      value={editProjectForm.name}
                      onChange={(event) => setEditProjectForm((current) => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">{t.projectKey}</label>
                    <input
                      required
                      maxLength={10}
                      value={editProjectForm.key}
                      onChange={(event) =>
                        setEditProjectForm((current) => ({ ...current, key: event.target.value.toUpperCase() }))
                      }
                      className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">{t.projectDescription}</label>
                    <textarea
                      rows={3}
                      value={editProjectForm.description}
                      onChange={(event) =>
                        setEditProjectForm((current) => ({ ...current, description: event.target.value }))
                      }
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditProjectOpen(false);
                        setEditingProject(null);
                        setCreateProjectErrorMsg("");
                      }}
                      disabled={isPending}
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                      {locale === "zh" ? "保存" : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {deletingProject ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="border-b border-rose-100 bg-rose-50/50 px-6 py-4">
                  <h2 className="text-xl font-bold text-rose-600">{t.deleteProject}</h2>
                </div>
                <div className="px-6 py-5">
                  {deleteErrorMsg ? (
                    <div className="mb-4 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                      {deleteErrorMsg}
                    </div>
                  ) : null}
                  <p className="text-sm font-medium text-slate-700">{t.deleteWarning}</p>
                  <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-800">
                    {deletingProject.name} ({deletingProject.key})
                  </div>
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium text-slate-700">{t.typeToConfirm}</label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(event) => setDeleteConfirmText(event.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                      placeholder={deletingProject.name}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteErrorMsg("");
                      setDeletingProject(null);
                      setDeleteConfirmText("");
                    }}
                    disabled={isPending}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={isPending || deleteConfirmText !== deletingProject.name}
                    onClick={handleDeleteProject}
                    className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                    {t.deleteProject}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {isCreateNotificationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">{t.newNotification}</h2>
              <button
                type="button"
                onClick={() => {
                  setIsCreateNotificationOpen(false);
                  setNotificationErrorMsg("");
                }}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateNotification} className="space-y-4 px-6 py-5">
              {notificationErrorMsg ? (
                <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                  {notificationErrorMsg}
                </div>
              ) : null}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">{t.notificationLevel}</label>
                <select
                  value={notificationForm.level}
                  onChange={(event) =>
                    setNotificationForm((current) => ({ ...current, level: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {notificationPermission.canCreateDepartment ? (
                    <option value="DEPARTMENT">{t.departmentNotification}</option>
                  ) : null}
                  <option value="PROJECT">{t.projectNotification}</option>
                </select>
              </div>
              {notificationForm.level === "PROJECT" ? (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">{t.notificationProject}</label>
                  <select
                    required
                    value={notificationForm.projectId}
                    onChange={(event) =>
                      setNotificationForm((current) => ({ ...current, projectId: event.target.value }))
                    }
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">{t.selectProject}</option>
                    {notificationPermission.manageableProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} ({project.key})
                      </option>
                    ))}
                  </select>
                  {notificationPermission.manageableProjects.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">{t.noProjectOptions}</p>
                  ) : null}
                </div>
              ) : null}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">{t.notificationTitle}</label>
                <input
                  required
                  value={notificationForm.title}
                  onChange={(event) =>
                    setNotificationForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder={t.notificationTitlePlaceholder}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">{t.notificationContent}</label>
                <textarea
                  required
                  rows={6}
                  value={notificationForm.content}
                  onChange={(event) =>
                    setNotificationForm((current) => ({ ...current, content: event.target.value }))
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder={t.notificationContentPlaceholder}
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateNotificationOpen(false);
                    setNotificationErrorMsg("");
                  }}
                  disabled={isPending}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending || (notificationForm.level === "PROJECT" && !notificationForm.projectId)}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                  {t.create}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedNotification ? (
        <DepartmentNotificationDetailDialog
          locale={locale}
          notification={selectedNotification}
          isPending={isPending}
          errorMsg={notificationErrorMsg}
          resendForm={resendForm}
          setResendForm={setResendForm}
          labels={detailDialogLabels(t, locale)}
          resendEditorRef={resendContentEditorRef}
          onClose={() => {
            void resendContentEditorRef.current?.discardPendingUploads();
            setSelectedNotification(null);
            setNotificationErrorMsg("");
          }}
          onSubmitResend={handleResendNotification}
          onRevoke={() => handleRevokeNotification(selectedNotification.id)}
        />
      ) : null}
    </div>
  );
}
