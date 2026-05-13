"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Loader2, Plus, Trash2, X } from "lucide-react";

import {
  createDepartmentProject,
  deleteDepartmentProject,
  setDepartmentMemberRole,
  updateDepartmentProject,
} from "@/app/actions/departments";
import {
  createAnnouncementNotification,
  markAnnouncementRead,
  resendAnnouncementNotification,
  revokeAnnouncementNotification,
} from "@/app/actions/announcements";
import DepartmentNotificationDetailDialog from "@/components/DepartmentNotificationDetailDialog";
import ProjectNavIcon from "@/components/ProjectNavIcon";
import type { RichTextEditorHandle } from "@/components/RichTextEditor";
import type { DepartmentWorkspaceData, DepartmentWorkspaceProject } from "@/lib/departmentWorkspace";
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

function InlineSelect({
  value,
  options,
  onChange,
  renderSummary,
  className = "relative",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  renderSummary: (label: string) => ReactNode;
  className?: string;
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
          className="fixed z-50 flex max-w-56 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
          style={{
            top: menuPosition.top,
            bottom: menuPosition.bottom,
            left: menuPosition.left,
            minWidth: menuPosition.width,
          }}
        >
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                option.value === value ? "bg-slate-100 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"
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
}: {
  department: DepartmentWorkspaceData;
  locale: Locale;
  currentUserId: string;
  isHead: boolean;
  canManageProjects: boolean;
  mode: "dashboard" | "members" | "projects";
  notifications?: DepartmentNotificationListItem[];
  notificationPermission?: DepartmentNotificationPermission;
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pageErrorMsg, setPageErrorMsg] = useState("");
  const [createProjectErrorMsg, setCreateProjectErrorMsg] = useState("");
  const [deleteErrorMsg, setDeleteErrorMsg] = useState("");
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateNotificationOpen, setIsCreateNotificationOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<DepartmentNotificationListItem | null>(null);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
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

  const completedIssues = department.projects.reduce((sum, project) => sum + project.completedIssuesCount, 0);
  const incompleteIssues = department.projects.reduce((sum, project) => sum + project.incompleteIssuesCount, 0);
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
  const summaryCards = useMemo(
    () => [
      { label: t.members, value: department.members.length },
      { label: t.projects, value: department.projects.length },
      { label: t.issues, value: `${completedIssues}/${incompleteIssues}` },
    ],
    [
      completedIssues,
      department.members.length,
      department.projects.length,
      incompleteIssues,
      t.issues,
      t.members,
      t.projects,
    ]
  );

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

  const openNotification = (notification: DepartmentNotificationListItem) => {
    setSelectedNotification(notification);
    setResendForm({
      title: notification.title,
      content: notification.content,
    });
    setNotificationErrorMsg("");
    if (!notification.read && notification.status === "SENT" && !readNotificationIds.has(notification.id)) {
      setReadNotificationIds((current) => new Set(current).add(notification.id));
      startTransition(async () => {
        await markAnnouncementRead(notification.id);
      });
    }
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
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="self-start rounded-xl border bg-white p-3 shadow-sm">
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
              <div className="min-w-0">
                <p className="line-clamp-2 text-base leading-6 text-slate-700">{department.description || t.noDescription}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {summaryCards.map((card) => (
                  <div
                    key={card.label}
                    className="flex aspect-square min-h-0 flex-col items-center justify-center rounded-lg bg-slate-50 p-2 text-center"
                  >
                    <span className="block max-w-full truncate text-xs font-medium text-slate-500">{card.label}</span>
                    <div className="mt-1 truncate text-lg font-bold leading-none text-slate-900">{card.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="self-start rounded-xl border bg-white p-3 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">{t.latestAnnouncements}</h3>
              <div className="flex items-center gap-2">
                <Link
                  href={`/departments/${department.id}/notifications`}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  {t.allNotifications}
                </Link>
              </div>
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">{t.noAnnouncements}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.receiptId}
                    className="grid w-full grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 px-1 py-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      {getNotificationLevelText(notification.level, t)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        notification.read || readNotificationIds.has(notification.id)
                          ? "bg-slate-100 text-slate-600"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {notification.read || readNotificationIds.has(notification.id) ? t.read : t.unread}
                    </span>
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      className={`min-w-0 truncate text-left text-sm font-semibold hover:text-blue-700 ${
                        notification.read || readNotificationIds.has(notification.id) ? "text-slate-700" : "text-blue-900"
                      }`}
                    >
                      {notification.title}
                    </button>
                    <span className="whitespace-nowrap text-xs font-medium text-slate-400">
                      {formatRelativeTime(notification.createdAt, locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                className="inline-flex h-9 items-center gap-2 rounded bg-[#0052CC] px-3 text-sm font-semibold text-white hover:bg-[#003D9B]"
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
