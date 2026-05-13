"use client";

import { useMemo, useRef, useState, useTransition, useEffect, useCallback, type ReactNode } from "react";

type FilterOption = {
  value: string;
  label: string;
};
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Eye,
  Loader2,
  ListFilter,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  createAnnouncementNotification,
  deleteAnnouncementNotification,
  markAnnouncementRead,
  markSystemNotificationRead,
  resendAnnouncementNotification,
  revokeAnnouncementNotification,
} from "@/app/actions/announcements";
import DepartmentNotificationDetailDialog from "@/components/DepartmentNotificationDetailDialog";
import { DropdownField } from "@/components/DropdownField";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/RichTextEditor";
import type {
  DepartmentNotificationListItem,
  DepartmentNotificationPermission,
} from "@/lib/departmentNotifications";
import type { Locale } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/timeFormat";
import LocalizedDateInput from "./LocalizedDateInput";

const TEXT = {
  en: {
    title: "Notifications",
    subtitle: "Search, filter, and manage department notifications.",
    all: "All",
    level: "Type",
    project: "Project",
    readState: "Read state",
    publishState: "Publish state",
    received: "Received",
    sentByMe: "Sent by me",
    announcementsTab: "Announcements",
    remindersTab: "Reminders",
    updatesTab: "Updates",
    from: "From",
    to: "To",
    allCreated: "All created",
    dateEquals: "Equals",
    dateOnOrAfter: "On or after",
    dateOnOrBefore: "On or before",
    filter: "Filter",
    reset: "Reset",
    department: "Department",
    projectLevel: "Project",
    system: "System",
    read: "Read",
    unread: "Unread",
    notApplicable: "-",
    noNotifications: "No notifications found.",
    newNotification: "New notification",
    titleField: "Title",
    content: "Content",
    selectProject: "Select project",
    create: "Create",
    cancel: "Cancel",
    revoke: "Revoke",
    delete: "Delete",
    resend: "Resend",
    revoked: "Revoked",
    sent: "Sent",
    showing: "Showing",
    rangeTo: "to",
    of: "of",
    page: "Page",
    perPage: "Per page",
    createdAt: "Created",
    createdBy: "Creator",
    status: "Status",
    columns: "Columns",
    resetColumns: "Reset columns",
    actions: "Actions",
    notificationsUnit: "notifications",
    revokeConfirm: "Revoke this notification?",
    deleteConfirm: "Delete this notification? This action cannot be undone.",
    searchPlaceholder: "Search notifications...",
    createFailed: "Failed to create notification.",
    manageFailed: "Failed to update notification.",
  },
  zh: {
    title: "通知",
    subtitle: "搜索、筛选和管理部门通知。",
    all: "全部",
    level: "类型",
    project: "项目",
    readState: "已读状态",
    publishState: "发布状态",
    received: "我收到的",
    sentByMe: "我发出的",
    announcementsTab: "公告",
    remindersTab: "提醒",
    updatesTab: "动态",
    from: "开始时间",
    to: "结束时间",
    allCreated: "全部创建时间",
    dateEquals: "等于",
    dateOnOrAfter: "晚于或等于",
    dateOnOrBefore: "早于或等于",
    filter: "筛选",
    reset: "重置",
    department: "部门",
    projectLevel: "项目",
    system: "系统",
    read: "已读",
    unread: "未读",
    notApplicable: "-",
    noNotifications: "暂无通知。",
    newNotification: "新建通知",
    titleField: "标题",
    content: "内容",
    selectProject: "选择项目",
    create: "创建",
    cancel: "取消",
    revoke: "撤回",
    delete: "删除",
    resend: "再次发出",
    revoked: "已撤回",
    sent: "已发出",
    showing: "显示",
    rangeTo: "至",
    of: "共",
    page: "第",
    perPage: "每页",
    createdAt: "创建时间",
    createdBy: "创建人",
    status: "状态",
    columns: "列",
    resetColumns: "重置列",
    actions: "操作",
    notificationsUnit: "条通知",
    revokeConfirm: "确认撤回这条通知？",
    deleteConfirm: "确认删除这条通知？此操作不可恢复。",
    searchPlaceholder: "搜索通知...",
    createFailed: "创建通知失败。",
    manageFailed: "更新通知失败。",
  },
} as const;

type ProjectOption = {
  id: string;
  name: string;
  key: string;
};

type ColumnId = "level" | "title" | "project" | "createdAt" | "author" | "read";
type ColumnConfig = {
  id: ColumnId;
  label: string;
  width: number;
  sortable?: boolean;
};

const DEFAULT_WIDTHS: Record<ColumnId, number> = {
  level: 110,
  title: 320,
  project: 160,
  createdAt: 130,
  author: 130,
  read: 90,
};

const DEFAULT_COLUMN_ORDER: ColumnId[] = ["level", "title", "project", "read", "author", "createdAt"];

function detailDialogLabels(t: typeof TEXT[Locale]) {
  return {
    level: {
      department: t.department,
      project: t.projectLevel,
      system: t.system,
    },
    revoked: t.revoked,
    sent: t.sent,
    title: t.titleField,
    content: t.content,
    project: t.project,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    status: t.status,
    resend: t.resend,
    revoke: t.revoke,
  };
}

function levelLabel(level: DepartmentNotificationListItem["level"], t: typeof TEXT[Locale]) {
  if (level === "DEPARTMENT") return t.department;
  if (level === "PROJECT") return t.projectLevel;
  return t.system;
}

function formatDateTime(value: string, locale: Locale) {
  return new Date(value).toLocaleString(locale === "zh" ? "zh-CN" : "en-US");
}

export default function DepartmentNotificationsClient({
  departmentId,
  locale,
  notifications,
  permission,
  projectOptions,
  filters,
  pagination,
}: {
  departmentId: string;
  locale: Locale;
  notifications: DepartmentNotificationListItem[];
  permission: DepartmentNotificationPermission;
  projectOptions: ProjectOption[];
  filters: Record<string, string>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<DepartmentNotificationListItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({
    level: permission.canCreateDepartment ? "DEPARTMENT" : "PROJECT",
    projectId: permission.manageableProjects[0]?.id || "",
    title: "",
    content: "",
  });
  const [resendForm, setResendForm] = useState({ title: "", content: "" });
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(DEFAULT_COLUMN_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_COLUMN_ORDER);
  const [columnWidths, setColumnWidths] = useState(DEFAULT_WIDTHS);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverSide, setDragOverSide] = useState<"left" | "right" | null>(null);
  const columnMenuRef = useRef<HTMLDetailsElement>(null);
  const createContentEditorRef = useRef<RichTextEditorHandle>(null);
  const resendContentEditorRef = useRef<RichTextEditorHandle>(null);
  const resizingRef = useRef<{
    colIndex: number;
    nextColIndex: number;
    startX: number;
    startWidth: number;
    nextStartWidth: number;
  } | null>(null);

  const columnsById = useMemo(
    () =>
      new Map<ColumnId, ColumnConfig>([
        ["level", { id: "level", label: t.level, width: DEFAULT_WIDTHS.level, sortable: true }],
        ["title", { id: "title", label: t.titleField, width: DEFAULT_WIDTHS.title, sortable: true }],
        ["project", { id: "project", label: t.project, width: DEFAULT_WIDTHS.project, sortable: true }],
        ["createdAt", { id: "createdAt", label: t.createdAt, width: DEFAULT_WIDTHS.createdAt, sortable: true }],
        ["author", { id: "author", label: t.createdBy, width: DEFAULT_WIDTHS.author, sortable: true }],
        ["read", { id: "read", label: t.status, width: DEFAULT_WIDTHS.read }],
      ]),
    [t.createdAt, t.createdBy, t.level, t.project, t.status, t.titleField],
  );
  const columns = columnOrder
    .filter((columnId) => visibleColumns.includes(columnId))
    .map((columnId) => columnsById.get(columnId))
    .filter((column): column is ColumnConfig => Boolean(column))
    .map((column) => ({ ...column, width: columnWidths[column.id] || column.width }));
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const rangeStart = pagination.total > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);
  const currentParams = useMemo(
    () => ({ ...filters, pageSize: String(pagination.pageSize) }),
    [filters, pagination.pageSize],
  );
  const createdFilter = filters.createdFilter || "ALL";
  const createdDate = filters.createdDate || "";
  const currentView = filters.view === "sent" && permission.canCreate ? "sent" : "received";
  const currentCategory = filters.category || "";
  const showActionColumn = currentView === "sent";
  const hasActiveCreatedFilter = createdFilter !== "ALL" || Boolean(createdDate || filters.from || filters.to);
  const createdFilterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "ALL", label: t.allCreated },
      { value: "EQ", label: t.dateEquals },
      { value: "GTE", label: t.dateOnOrAfter },
      { value: "LTE", label: t.dateOnOrBefore },
    ],
    [t.allCreated, t.dateEquals, t.dateOnOrAfter, t.dateOnOrBefore],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        columnMenuRef.current.open = false;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDragStart = (event: React.DragEvent, index: number) => {
    event.dataTransfer.setData("colIndex", index.toString());
    event.dataTransfer.effectAllowed = "move";
    setDragSourceIndex(index);
  };

  const handleDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOverIndex(index);
    setDragOverSide(event.clientX < rect.left + rect.width / 2 ? "left" : "right");
  };

  const handleDrop = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault();
    const sourceIndex = Number(event.dataTransfer.getData("colIndex"));
    if (Number.isFinite(sourceIndex) && sourceIndex !== targetIndex) {
      setColumnOrder((currentOrder) => {
        const visibleOrder = currentOrder.filter((columnId) => visibleColumns.includes(columnId));
        const sourceColumnId = visibleOrder[sourceIndex];
        const targetColumnId = visibleOrder[targetIndex];
        if (!sourceColumnId || !targetColumnId) return currentOrder;

        const nextVisibleOrder = [...visibleOrder];
        const [removed] = nextVisibleOrder.splice(sourceIndex, 1);
        const adjustedTarget =
          dragOverSide === "right"
            ? sourceIndex < targetIndex
              ? targetIndex
              : targetIndex + 1
            : sourceIndex < targetIndex
              ? targetIndex - 1
              : targetIndex;
        nextVisibleOrder.splice(Math.max(0, adjustedTarget), 0, removed);

        const hiddenOrder = currentOrder.filter((columnId) => !visibleColumns.includes(columnId));
        return [...nextVisibleOrder, ...hiddenOrder];
      });
    }
    setDragSourceIndex(null);
    setDragOverIndex(null);
    setDragOverSide(null);
  };

  const handleDragEnd = () => {
    setDragSourceIndex(null);
    setDragOverIndex(null);
    setDragOverSide(null);
  };

  const handleToggleColumnVisibility = (columnId: ColumnId) => {
    setVisibleColumns((current) => {
      if (current.includes(columnId)) {
        return current.length > 1 ? current.filter((id) => id !== columnId) : current;
      }

      return DEFAULT_COLUMN_ORDER.filter((id) => id === columnId || current.includes(id));
    });
  };

  const handleResetColumns = () => {
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    setVisibleColumns(DEFAULT_COLUMN_ORDER);
    setColumnWidths(DEFAULT_WIDTHS);
  };

  const openNotification = (notification: DepartmentNotificationListItem) => {
    if (notification.source === "NOTIFICATION") {
      startTransition(async () => {
        if (!notification.read) await markSystemNotificationRead(notification.id);
        router.refresh();
        if (notification.targetUrl) router.push(notification.targetUrl);
      });
      return;
    }

    setSelected({
      ...notification,
      canManage: currentView === "sent" && notification.canManage,
      canDelete: currentView === "sent" && notification.canDelete,
    });
    setResendForm({ title: notification.title, content: notification.content });
    setErrorMsg("");
    if (!notification.read && notification.status === "SENT") {
      startTransition(async () => {
        await markAnnouncementRead(notification.id);
        router.refresh();
      });
    }
  };

  const submitCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg("");
    startTransition(async () => {
      const result = await createAnnouncementNotification({
        departmentId,
        level: form.level as "DEPARTMENT" | "PROJECT",
        projectId: form.level === "PROJECT" ? form.projectId : null,
        title: form.title,
        content: form.content,
      });
      if (!result.success) {
        setErrorMsg(result.error || t.createFailed);
        return;
      }
      createContentEditorRef.current?.commitPendingUploads();
      setIsCreateOpen(false);
      setForm({
        level: permission.canCreateDepartment ? "DEPARTMENT" : "PROJECT",
        projectId: permission.manageableProjects[0]?.id || "",
        title: "",
        content: "",
      });
      router.refresh();
    });
  };

  const submitResend = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setErrorMsg("");
    startTransition(async () => {
      const result = await resendAnnouncementNotification(selected.id, resendForm);
      if (!result.success) {
        setErrorMsg(result.error || t.manageFailed);
        return;
      }
      resendContentEditorRef.current?.commitPendingUploads();
      setSelected(null);
      router.refresh();
    });
  };

  const closeCreateDialog = () => {
    void createContentEditorRef.current?.discardPendingUploads();
    setIsCreateOpen(false);
  };

  const closeDetailDialog = () => {
    void resendContentEditorRef.current?.discardPendingUploads();
    setSelected(null);
  };

  const manage = (kind: "revoke" | "delete", id: string) => {
    const confirmed = window.confirm(kind === "revoke" ? t.revokeConfirm : t.deleteConfirm);
    if (!confirmed) return;

    setErrorMsg("");
    startTransition(async () => {
      const result = kind === "revoke" ? await revokeAnnouncementNotification(id) : await deleteAnnouncementNotification(id);
      if (!result.success) {
        setErrorMsg(result.error || t.manageFailed);
        return;
      }
      setSelected(null);
      router.refresh();
    });
  };

  const handleResizeStart = useCallback((event: React.MouseEvent, colIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    const col = columns[colIndex];
    const nextCol = columns[colIndex + 1];
    if (!col || !nextCol) return;
    const startWidth = col.width || 150;
    const nextStartWidth = nextCol.width || 150;
    const minWidth = 60;
    resizingRef.current = {
      colIndex,
      nextColIndex: colIndex + 1,
      startX: event.clientX,
      startWidth,
      nextStartWidth,
    };
    const handleMove = (moveEvent: MouseEvent) => {
      const current = resizingRef.current;
      if (!current) return;
      const resizeColumnId = columns[current.colIndex]?.id;
      const nextResizeColumnId = columns[current.nextColIndex]?.id;
      if (!resizeColumnId || !nextResizeColumnId) return;

      const delta = moveEvent.clientX - current.startX;
      const boundedDelta = Math.min(
        current.nextStartWidth - minWidth,
        Math.max(minWidth - current.startWidth, delta),
      );

      setColumnWidths((widths) => ({
        ...widths,
        [resizeColumnId]: current.startWidth + boundedDelta,
        [nextResizeColumnId]: current.nextStartWidth - boundedDelta,
      }));
    };
    const handleUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, [columns]);

  const updateQueryParams = (patch: Record<string, string | number | null>) => {
    const params = new URLSearchParams(currentParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, String(value));
    }
    router.push(`/departments/${departmentId}/notifications?${params.toString()}`);
  };

  const toggleFilterValue = (value: string, filterKey: string, currentValues: string[]) => {
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    updateQueryParams({ [filterKey]: newValues.length > 0 ? newValues.join(",") : null, page: 1 });
  };

  const renderCell = (notification: DepartmentNotificationListItem, columnId: ColumnId) => {
    if (columnId === "level") {
      return (
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
          {notification.typeLabel || levelLabel(notification.level, t)}
        </span>
      );
    }
    if (columnId === "title") {
      return (
        <button
          type="button"
          onClick={() => openNotification(notification)}
          className="block max-w-full truncate text-left text-sm font-semibold text-slate-900 hover:text-blue-700"
        >
          {notification.title}
        </button>
      );
    }
    if (columnId === "project") return <span className="truncate text-sm text-slate-600">{notification.projectName || ""}</span>;
    if (columnId === "createdAt") {
      return (
        <span className="whitespace-nowrap text-sm text-slate-600" title={formatDateTime(notification.createdAt, locale)}>
          {formatRelativeTime(notification.createdAt, locale)}
        </span>
      );
    }
    if (columnId === "author") return <span className="truncate text-sm text-slate-600">{notification.authorName}</span>;
    if (currentView === "sent" && notification.status === "REVOKED") {
      return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{t.revoked}</span>;
    }
    if (currentView === "sent") {
      return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{t.sent}</span>;
    }
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          notification.read ? "bg-slate-100 text-slate-600" : "bg-blue-600 text-white"
        }`}
      >
        {notification.read ? t.read : t.unread}
      </span>
    );
  };

  return (
    <div className="flex flex-col min-h-0 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{t.title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {permission.canCreate ? (
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
              {[
                { value: "received", label: t.received },
                { value: "sent", label: t.sentByMe },
              ].map((option) => {
                const isActive = currentView === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      updateQueryParams({
                        view: option.value === "received" ? null : option.value,
                        category: null,
                        read: null,
                        publishStatus: null,
                        page: 1,
                      })
                    }
                    className={`h-7 rounded px-3 text-sm font-medium transition-colors ${
                      isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="relative w-72 max-w-[42vw]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#42526E]" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={filters.search || ""}
              onChange={(e) => {
                updateQueryParams({ search: e.target.value, page: 1 });
              }}
              className="h-9 w-full rounded border border-transparent bg-[#F4F5F7] pl-9 pr-9 text-sm text-[#172B4D] outline-none focus:border-[#0052CC] focus:bg-white focus:ring-1 focus:ring-[#0052CC]"
            />
            {filters.search ? (
              <button
                type="button"
                onClick={() => {
                  updateQueryParams({ search: null, page: 1 });
                }}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-[#42526E] hover:bg-[#EBECF0]"
                aria-label={locale === "zh" ? "清除搜索" : "Clear search"}
                title={locale === "zh" ? "清除搜索" : "Clear search"}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          {permission.canCreate ? (
            <button
              type="button"
              onClick={() => {
                setErrorMsg("");
                setIsCreateOpen(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded bg-[#0052CC] px-3 text-sm font-semibold text-white hover:bg-[#003D9B]"
            >
              <Plus size={16} />
              {t.newNotification}
            </button>
          ) : null}
        </div>
      </div>

      <div className="bg-white p-3 rounded-lg border shadow-sm">
        {currentView === "received" ? (
          <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-slate-100 pb-3">
            {[
              { value: "", label: t.all },
              { value: "ANNOUNCEMENT", label: t.announcementsTab },
              { value: "REMINDER", label: t.remindersTab },
              { value: "UPDATE", label: t.updatesTab },
            ].map((option) => (
              <button
                key={option.value || "ALL"}
                type="button"
                onClick={() => updateQueryParams({ category: option.value || null, page: 1 })}
                className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
                  currentCategory === option.value
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 w-full">
          <div className="h-9 px-2 inline-flex items-center text-slate-500">
            <ListFilter size={14} />
          </div>

          <MultiFilter
            label={t.project}
            options={projectOptions.map((project) => ({ value: project.id, label: `${project.name} (${project.key})` }))}
            selectedValues={filters.projectId ? filters.projectId.split(",") : []}
            onToggle={(value) => toggleFilterValue(value, "projectId", filters.projectId ? filters.projectId.split(",") : [])}
            onClear={() => updateQueryParams({ projectId: null, page: 1 })}
            clearText={t.reset}
          />

          {currentView === "sent" ? (
            <MultiFilter
              label={t.publishState}
              options={[
                { value: "SENT", label: t.sent },
                { value: "REVOKED", label: t.revoked },
              ]}
              selectedValues={filters.publishStatus ? filters.publishStatus.split(",") : []}
              onToggle={(value) =>
                toggleFilterValue(value, "publishStatus", filters.publishStatus ? filters.publishStatus.split(",") : [])
              }
              onClear={() => updateQueryParams({ publishStatus: null, page: 1 })}
              clearText={t.reset}
            />
          ) : (
            <MultiFilter
              label={t.readState}
              options={[
                { value: "unread", label: t.unread },
                { value: "read", label: t.read },
              ]}
              selectedValues={filters.read ? filters.read.split(",") : []}
              onToggle={(value) => toggleFilterValue(value, "read", filters.read ? filters.read.split(",") : [])}
              onClear={() => updateQueryParams({ read: null, page: 1 })}
              clearText={t.reset}
            />
          )}

          <SingleFilter
            value={createdFilter}
            options={createdFilterOptions}
            onChange={(value) => {
              updateQueryParams({
                createdFilter: value,
                createdDate: value === "ALL" ? null : createdDate,
                from: null,
                to: null,
                page: 1,
              });
            }}
            renderSummary={(label) => (
              <div className="h-9 px-3 inline-flex items-center gap-2 text-sm bg-slate-50 border border-slate-200 rounded-md">
                <span className="text-slate-500">{t.createdAt}</span>
                <span className="bg-transparent font-medium p-0 border-none text-slate-700">{label}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </div>
            )}
          />

          {createdFilter !== "ALL" ? (
            <LocalizedDateInput
              locale={locale}
              aria-label={t.createdAt}
              value={createdDate}
              onChange={(e) => updateQueryParams({ createdDate: e.target.value, from: null, to: null, page: 1 })}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : null}

          {(filters.category || filters.projectId || filters.read || filters.publishStatus || hasActiveCreatedFilter || filters.search) ? (
            <button
              type="button"
              onClick={() => updateQueryParams({ category: null, projectId: null, read: null, publishStatus: null, createdFilter: null, createdDate: null, from: null, to: null, search: null, page: 1 })}
              className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {t.reset}
            </button>
          ) : null}

          <details ref={columnMenuRef} className="relative">
            <summary
              className="list-none h-9 w-9 inline-flex items-center justify-center text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors cursor-pointer select-none"
              aria-label={t.columns}
              title={t.columns}
            >
              <Eye size={16} className="text-slate-500" />
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
              {DEFAULT_COLUMN_ORDER.map((columnId) => {
                const column = columnsById.get(columnId);
                if (!column) return null;
                const isChecked = visibleColumns.includes(column.id);
                const isDisabled = isChecked && visibleColumns.length === 1;

                return (
                  <label
                    key={column.id}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                      isDisabled ? "cursor-not-allowed text-slate-400" : "cursor-pointer hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => handleToggleColumnVisibility(column.id)}
                      className="h-4 w-4"
                    />
                    <span>{column.label}</span>
                  </label>
                );
              })}
              <button
                type="button"
                onClick={handleResetColumns}
                className="w-full text-left px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md border-t border-slate-100 mt-1 pt-2"
              >
                {t.resetColumns}
              </button>
            </div>
          </details>
        </div>
      </div>

      <div className="bg-white overflow-hidden rounded-xl border shadow-sm">
        <div className="relative overflow-hidden">
          <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold border-b">
              <tr>
                {columns.map((column, index) => {
                  const isSorted = filters.sort === column.id || (!filters.sort && column.id === "createdAt");
                  const nextDirection = isSorted && filters.direction === "asc" ? "desc" : "asc";
                  const showLeftLine =
                    dragOverIndex === index && dragOverSide === "left" && dragSourceIndex !== index;
                  const showRightLine =
                    dragOverIndex === index && dragOverSide === "right" && dragSourceIndex !== index;
                  const isDragging = dragSourceIndex === index;
                  return (
                    <th
                      key={column.id}
                      className={`group/column px-5 py-4 cursor-move active:cursor-move hover:bg-slate-100 transition-colors overflow-hidden relative select-none ${
                        isDragging ? "opacity-40" : ""
                      }`}
                      style={{ width: `${column.width}px` }}
                      draggable
                      onDragStart={(event) => handleDragStart(event, index)}
                      onDragOver={(event) => handleDragOver(event, index)}
                      onDrop={(event) => handleDrop(event, index)}
                      onDragEnd={handleDragEnd}
                      onDragLeave={() => {
                        if (dragOverIndex === index) {
                          setDragOverIndex(null);
                          setDragOverSide(null);
                        }
                      }}
                    >
                      {showLeftLine ? <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 z-10" /> : null}
                      {column.sortable ? (
                        <button
                          type="button"
                          onClick={() => updateQueryParams({ sort: column.id, direction: nextDirection, page: 1 })}
                          className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-800"
                          draggable={false}
                        >
                          {column.label}
                          {isSorted ? (
                            filters.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : null}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-500">{column.label}</span>
                      )}
                      {showRightLine ? <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-blue-500 z-10" /> : null}
                      {columns[index + 1] ? (
                        <div
                          className="absolute bottom-0 right-0 top-0 z-20 w-4 cursor-ew-resize"
                          onMouseDown={(event) => handleResizeStart(event, index)}
                          draggable={false}
                          title={locale === "zh" ? "拖拽调整列宽" : "Drag to resize column"}
                        />
                      ) : null}
                    </th>
                  );
                })}
                {showActionColumn ? (
                  <th className="w-36 px-5 py-4 text-right">
                    <span className="font-semibold text-slate-500">{t.actions}</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <tr>
                  <td
                    colSpan={(columns.length || 1) + (showActionColumn ? 1 : 0)}
                    className="px-5 py-16 text-center text-sm text-slate-500"
                  >
                    {t.noNotifications}
                  </td>
                </tr>
              ) : (
                notifications.map((notification) => (
                  <tr
                    key={notification.receiptId}
                    className={`${notification.read || currentView === "sent" ? "bg-white" : "bg-blue-50/40"} hover:bg-slate-50`}
                  >
                    {columns.map((column) => (
                      <td key={column.id} className="overflow-hidden px-5 py-3.5 align-middle">
                        {renderCell(notification, column.id)}
                      </td>
                    ))}
                    {showActionColumn ? (
                      <td className="px-5 py-3.5 text-right align-middle">
                        <div className="inline-flex items-center justify-end gap-2">
                          {notification.canManage && notification.status === "SENT" ? (
                            <button
                              type="button"
                              onClick={() => manage("revoke", notification.id)}
                              disabled={isPending}
                              className="rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            >
                              {t.revoke}
                            </button>
                          ) : null}
                          {notification.canDelete ? (
                            <button
                              type="button"
                              onClick={() => manage("delete", notification.id)}
                              disabled={isPending}
                              className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                              <Trash2 size={13} />
                              {t.delete}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 border-t px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-slate-500 font-medium">
            {locale === "zh" ? (
              <>
                {t.showing}
                <span className="text-slate-800 font-bold"> {rangeStart} </span>
                {t.rangeTo}
                <span className="text-slate-800 font-bold"> {rangeEnd} </span>
                {t.of}
                <span className="text-slate-800 font-bold"> {pagination.total} </span>
                {t.notificationsUnit}
              </>
            ) : (
              <>
                {t.showing} <span className="text-slate-800 font-bold">{rangeStart}</span> {t.rangeTo}{" "}
                <span className="text-slate-800 font-bold">{rangeEnd}</span> {t.of}{" "}
                <span className="text-slate-800 font-bold">{pagination.total}</span>{" "}
                {t.notificationsUnit}
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-500 [&>span:first-child]:hidden">
              <span>{locale === "zh" ? "每页" : "Per page"}</span>
              <span>{t.perPage}</span>
              <InlineSelect
                value={String(pagination.pageSize)}
                options={[
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "50", label: "50" },
                ]}
                onChange={(value) => {
                  updateQueryParams({ pageSize: value, page: 1 });
                }}
                renderSummary={(label) => (
                  <span className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    {label}
                  </span>
                )}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQueryParams({ page: Math.max(1, pagination.page - 1) })}
                disabled={pagination.page <= 1}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
              >
                <ArrowLeft size={18} />
              </button>

              <span className="font-medium text-slate-700 px-2 leading-none">
                {locale === "zh"
                  ? `${t.page}${pagination.page}/${totalPages || 1}页`
                  : `${t.page} ${pagination.page} of ${totalPages || 1}`}
              </span>

              <button
                onClick={() => updateQueryParams({ page: Math.min(totalPages || 1, pagination.page + 1) })}
                disabled={pagination.page >= totalPages || totalPages === 0}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isCreateOpen ? (
        <NotificationFormDialog
          t={t}
          isPending={isPending}
          errorMsg={errorMsg}
          form={form}
          setForm={setForm}
          permission={permission}
          editorRef={createContentEditorRef}
          onClose={closeCreateDialog}
          onSubmit={submitCreate}
        />
      ) : null}

      {selected ? (
        <DepartmentNotificationDetailDialog
          locale={locale}
          notification={selected}
          isPending={isPending}
          errorMsg={errorMsg}
          resendForm={resendForm}
          setResendForm={setResendForm}
          labels={detailDialogLabels(t)}
          resendEditorRef={resendContentEditorRef}
          onClose={closeDetailDialog}
          onSubmitResend={submitResend}
          onRevoke={() => manage("revoke", selected.id)}
        />
      ) : null}
    </div>
  );
}

function MultiFilter({
  label,
  options,
  selectedValues,
  onToggle,
  onClear,
  clearText,
}: {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  clearText: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);
  const buttonText =
    selectedLabels.length === 0
      ? label
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${label} (${selectedLabels.length})`;

  return (
    <details ref={detailsRef} className="relative">
      <summary className="list-none h-9 px-3 inline-flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors cursor-pointer select-none">
        <span className="truncate max-w-40">{buttonText}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </summary>
      <div className="absolute z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-xl p-2 space-y-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-slate-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedValues.includes(option.value)}
              onChange={() => onToggle(option.value)}
              className="h-4 w-4"
            />
            <span className="text-slate-700">{option.label}</span>
          </label>
        ))}
        {selectedValues.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="w-full text-left px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md border-t border-slate-100 mt-1 pt-2"
          >
            {clearText}
          </button>
        )}
      </div>
    </details>
  );
}

function SingleFilter({
  value,
  options,
  onChange,
  renderSummary,
}: {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  renderSummary: (label: string) => ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  return (
    <details ref={detailsRef} className="relative">
      <summary className="list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden">
        {renderSummary(selectedOption?.label || "")}
      </summary>
      <div className="absolute z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-xl p-2 space-y-1">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              option.value === value ? "bg-slate-100 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </details>
  );
}

function InlineSelect({
  value,
  options,
  onChange,
  renderSummary,
  className = "relative",
}: {
  value: string;
  options: FilterOption[];
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
      {isOpen && (
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
      )}
    </details>
  );
}

function NotificationFormDialog({
  t,
  isPending,
  errorMsg,
  form,
  setForm,
  permission,
  editorRef,
  onClose,
  onSubmit,
}: {
  t: typeof TEXT[Locale];
  isPending: boolean;
  errorMsg: string;
  form: { level: string; projectId: string; title: string; content: string };
  setForm: React.Dispatch<React.SetStateAction<{ level: string; projectId: string; title: string; content: string }>>;
  permission: DepartmentNotificationPermission;
  editorRef: React.RefObject<RichTextEditorHandle | null>;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const levelOptions = [
    ...(permission.canCreateDepartment ? [{ value: "DEPARTMENT", label: t.department }] : []),
    { value: "PROJECT", label: t.projectLevel },
  ];
  const projectOptions = [
    { value: "", label: t.selectProject },
    ...permission.manageableProjects.map((project) => ({ value: project.id, label: `${project.name} (${project.key})` })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-800">{t.newNotification}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            {errorMsg ? <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{errorMsg}</div> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">{t.level}</span>
                <div className="grid grid-cols-2 gap-2">
                  {levelOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex h-10 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors ${
                        form.level === option.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="notification-level"
                        value={option.value}
                        checked={form.level === option.value}
                        onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
              {form.level === "PROJECT" ? (
                <DropdownField
                  id="notification-project"
                  label={t.project}
                  value={form.projectId}
                  onChange={(value) => setForm((current) => ({ ...current, projectId: value }))}
                  options={projectOptions}
                />
              ) : null}
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">
                {t.titleField} <span className="text-red-500">*</span>
              </span>
              <input
                required
                autoFocus
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </label>
            <div className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">
                {t.content} <span className="text-red-500">*</span>
              </span>
              <RichTextEditor
                ref={editorRef}
                value={form.content}
                onChange={(value) => setForm((current) => ({ ...current, content: value || "" }))}
                height={220}
              />
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending || !form.title.trim() || !form.content.trim() || (form.level === "PROJECT" && !form.projectId)}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              {t.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
