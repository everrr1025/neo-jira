"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ListFilter,
  Loader2,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

import {
  createAnnouncementNotification,
  deleteAnnouncementNotification,
  markAnnouncementRead,
  resendAnnouncementNotification,
  revokeAnnouncementNotification,
} from "@/app/actions/announcements";
import type {
  DepartmentNotificationListItem,
  DepartmentNotificationPermission,
} from "@/lib/departmentNotifications";
import type { Locale } from "@/lib/i18n";

const TEXT = {
  en: {
    title: "Notifications",
    subtitle: "Search, filter, and manage department notifications.",
    all: "All",
    level: "Level",
    project: "Project",
    readState: "Read state",
    from: "From",
    to: "To",
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
    resend: "Edit and resend",
    revoked: "Revoked",
    showing: "Showing",
    rangeTo: "to",
    of: "of",
    page: "Page",
    perPage: "Per page",
    createdAt: "Created",
    createdBy: "Creator",
    status: "Status",
    columns: "Columns",
    searchPlaceholder: "Search notifications...",
    createFailed: "Failed to create notification.",
    manageFailed: "Failed to update notification.",
  },
  zh: {
    title: "通知",
    subtitle: "搜索、筛选和管理部门通知。",
    all: "全部",
    level: "通知级别",
    project: "项目",
    readState: "已读状态",
    from: "开始时间",
    to: "结束时间",
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
    titleField: "通知标题",
    content: "通知内容",
    selectProject: "选择项目",
    create: "创建",
    cancel: "取消",
    revoke: "撤回",
    delete: "删除",
    resend: "编辑后再次发出",
    revoked: "已撤回",
    showing: "显示",
    rangeTo: "至",
    of: "共",
    page: "第",
    perPage: "每页",
    createdAt: "创建时间",
    createdBy: "创建人",
    status: "状态",
    columns: "列",
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
  level: 120,
  title: 360,
  project: 220,
  createdAt: 170,
  author: 150,
  read: 110,
};

function levelLabel(level: DepartmentNotificationListItem["level"], t: typeof TEXT[Locale]) {
  if (level === "DEPARTMENT") return t.department;
  if (level === "PROJECT") return t.projectLevel;
  return t.system;
}

function buildHref(departmentId: string, currentParams: Record<string, string>, patch: Record<string, string | number>) {
  const params = new URLSearchParams(currentParams);
  for (const [key, value] of Object.entries(patch)) {
    if (value === "") params.delete(key);
    else params.set(key, String(value));
  }
  return `/departments/${departmentId}/notifications?${params.toString()}`;
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
  currentUserId,
  filters,
  pagination,
}: {
  departmentId: string;
  locale: Locale;
  notifications: DepartmentNotificationListItem[];
  permission: DepartmentNotificationPermission;
  projectOptions: ProjectOption[];
  currentUserId: string;
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
  const [isSearchOpen, setIsSearchOpen] = useState(Boolean(filters.search));
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>([
    "level",
    "title",
    "project",
    "createdAt",
    "author",
    "read",
  ]);
  const [columnWidths, setColumnWidths] = useState(DEFAULT_WIDTHS);
  const resizingRef = useRef<{ columnId: ColumnId; startX: number; startWidth: number } | null>(null);

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
  const columns = visibleColumns
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

  const openNotification = (notification: DepartmentNotificationListItem) => {
    setSelected(notification);
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
      setSelected(null);
      router.refresh();
    });
  };

  const manage = (kind: "revoke" | "delete", id: string) => {
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

  const beginResize = (event: React.MouseEvent, columnId: ColumnId) => {
    event.preventDefault();
    resizingRef.current = {
      columnId,
      startX: event.clientX,
      startWidth: columnWidths[columnId],
    };
    const handleMove = (moveEvent: MouseEvent) => {
      const current = resizingRef.current;
      if (!current) return;
      const nextWidth = Math.max(90, current.startWidth + moveEvent.clientX - current.startX);
      setColumnWidths((widths) => ({ ...widths, [current.columnId]: nextWidth }));
    };
    const handleUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  const updateQueryParams = (patch: Record<string, string | number | null>) => {
    const params = new URLSearchParams(currentParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, String(value));
    }
    router.push(`/departments/${departmentId}/notifications?${params.toString()}`);
  };

  const renderCell = (notification: DepartmentNotificationListItem, columnId: ColumnId) => {
    if (columnId === "level") {
      return (
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
          {levelLabel(notification.level, t)}
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
    if (columnId === "project") return <span className="truncate text-sm text-slate-600">{notification.projectName || "-"}</span>;
    if (columnId === "createdAt") return <span className="whitespace-nowrap text-sm text-slate-600">{formatDateTime(notification.createdAt, locale)}</span>;
    if (columnId === "author") return <span className="truncate text-sm text-slate-600">{notification.authorName}</span>;
    if (notification.authorId === currentUserId) return <span className="text-sm text-slate-400">{t.notApplicable}</span>;
    if (notification.status === "REVOKED") {
      return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{t.revoked}</span>;
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
    <div className="flex flex-col h-full min-h-0 space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-white p-3">
          <div className={`relative flex items-center gap-2 ${isSearchOpen ? "w-full lg:w-80" : "w-auto"}`}>
            {isSearchOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (filters.search) updateQueryParams({ search: null, page: 1 });
                    setIsSearchOpen(false);
                  }}
                  className="absolute left-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={t.searchPlaceholder}
                  title={t.searchPlaceholder}
                >
                  <Search size={14} />
                </button>
                <input
                  name="search"
                  defaultValue={filters.search || ""}
                  autoFocus
                  placeholder={t.searchPlaceholder}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && !filters.search) setIsSearchOpen(false);
                  }}
                  className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {filters.search ? (
                  <button
                    type="button"
                    onClick={() => updateQueryParams({ search: null, page: 1 })}
                    className="absolute right-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label={locale === "zh" ? "清除搜索" : "Clear search"}
                    title={locale === "zh" ? "清除搜索" : "Clear search"}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label={t.searchPlaceholder}
                title={t.searchPlaceholder}
              >
                <Search size={16} />
              </button>
            )}
          </div>

          <div className="inline-flex h-9 items-center px-2 text-slate-500">
            <ListFilter size={14} />
          </div>

          <ToolbarSelect name="level" label={t.level} value={filters.level} options={[
            { value: "", label: t.level },
            { value: "DEPARTMENT", label: t.department },
            { value: "PROJECT", label: t.projectLevel },
            { value: "SYSTEM", label: t.system },
          ]} />
          <ToolbarSelect name="projectId" label={t.project} value={filters.projectId} options={[
            { value: "", label: t.project },
            ...projectOptions.map((project) => ({ value: project.id, label: `${project.name} (${project.key})` })),
          ]} />
          <ToolbarSelect name="read" label={t.readState} value={filters.read} options={[
            { value: "", label: t.readState },
            { value: "unread", label: t.unread },
            { value: "read", label: t.read },
          ]} />
          <input type="date" name="from" defaultValue={filters.from || ""} title={t.from} className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2 text-sm text-slate-700" />
          <input type="date" name="to" defaultValue={filters.to || ""} title={t.to} className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2 text-sm text-slate-700" />
          <button type="submit" className="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700">
            {t.filter}
          </button>
          <Link href={`/departments/${departmentId}/notifications`} className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
            {t.reset}
          </Link>
          <details className="relative ml-auto">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Settings2 size={15} />
              {t.columns}
              <ChevronDown size={14} className="text-slate-400" />
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
              {Array.from(columnsById.values()).map((column) => (
                <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(column.id)}
                    onChange={() => {
                      setVisibleColumns((current) =>
                        current.includes(column.id)
                          ? current.filter((id) => id !== column.id)
                          : [...current, column.id],
                      );
                    }}
                    className="h-4 w-4"
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          </details>
          {permission.canCreate ? (
            <button
              type="button"
              onClick={() => {
                setErrorMsg("");
                setIsCreateOpen(true);
              }}
              className="flex h-9 items-center justify-center gap-1 whitespace-nowrap rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus size={16} />
              {t.newNotification}
            </button>
          ) : null}
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-max table-fixed divide-y divide-slate-200">
            <colgroup>
              {columns.map((column) => (
                <col key={column.id} style={{ width: column.width }} />
              ))}
            </colgroup>
            <thead className="bg-slate-50">
              <tr>
                {columns.map((column) => {
                  const isSorted = filters.sort === column.id || (!filters.sort && column.id === "createdAt");
                  const nextDirection = isSorted && filters.direction === "asc" ? "desc" : "asc";
                  return (
                    <th key={column.id} className="relative px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      {column.sortable ? (
                        <Link
                          href={buildHref(departmentId, currentParams, {
                            sort: column.id,
                            direction: nextDirection,
                            page: 1,
                          })}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          {column.label}
                          {isSorted ? (
                            filters.direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                          ) : null}
                        </Link>
                      ) : (
                        column.label
                      )}
                      <span
                        role="separator"
                        onMouseDown={(event) => beginResize(event, column.id)}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-300"
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={columns.length || 1} className="px-5 py-16 text-center text-sm text-slate-500">
                    {t.noNotifications}
                  </td>
                </tr>
              ) : (
                notifications.map((notification) => (
                  <tr
                    key={notification.receiptId}
                    className={`${notification.read || notification.authorId === currentUserId ? "bg-white" : "bg-blue-50/40"} hover:bg-slate-50`}
                  >
                    {columns.map((column) => (
                      <td key={column.id} className="overflow-hidden px-5 py-3.5 align-middle">
                        {renderCell(notification, column.id)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 border-t px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-slate-500 font-medium">
            {t.showing}
            <span className="text-slate-800 font-bold"> {rangeStart} </span>
            {t.rangeTo}
            <span className="text-slate-800 font-bold"> {rangeEnd} </span>
            {t.of}
            <span className="text-slate-800 font-bold"> {pagination.total} </span>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-slate-500">
              <span>{t.perPage}</span>
              <select
                value={pagination.pageSize}
                onChange={(event) => router.push(buildHref(departmentId, currentParams, { pageSize: event.target.value, page: 1 }))}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700"
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <Link
                href={buildHref(departmentId, currentParams, { page: Math.max(1, pagination.page - 1) })}
                className={`rounded-md p-1 text-slate-500 hover:bg-slate-200 ${pagination.page === 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                <ArrowLeft size={18} />
              </Link>
              <span className="font-medium text-slate-700 px-2 leading-none">
                {t.page} {pagination.page} / {totalPages}
              </span>
              <Link
                href={buildHref(departmentId, currentParams, { page: Math.min(totalPages, pagination.page + 1) })}
                className={`rounded-md p-1 text-slate-500 hover:bg-slate-200 ${pagination.page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
              >
                <ArrowRight size={18} />
              </Link>
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
          onClose={() => setIsCreateOpen(false)}
          onSubmit={submitCreate}
        />
      ) : null}

      {selected ? (
        <NotificationDetailDialog
          t={t}
          locale={locale}
          notification={selected}
          isPending={isPending}
          errorMsg={errorMsg}
          resendForm={resendForm}
          setResendForm={setResendForm}
          onClose={() => setSelected(null)}
          onSubmitResend={submitResend}
          onRevoke={() => manage("revoke", selected.id)}
          onDelete={() => manage("delete", selected.id)}
        />
      ) : null}
    </div>
  );
}

function ToolbarSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value || ""} className="h-9 min-w-36 rounded-md border border-slate-200 bg-slate-50 px-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NotificationFormDialog({
  t,
  isPending,
  errorMsg,
  form,
  setForm,
  permission,
  onClose,
  onSubmit,
}: {
  t: typeof TEXT[Locale];
  isPending: boolean;
  errorMsg: string;
  form: { level: string; projectId: string; title: string; content: string };
  setForm: React.Dispatch<React.SetStateAction<{ level: string; projectId: string; title: string; content: string }>>;
  permission: DepartmentNotificationPermission;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{t.newNotification}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-5 px-6 py-5">
          {errorMsg ? <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{errorMsg}</div> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-600">{t.level}</span>
              <select
                value={form.level}
                onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                {permission.canCreateDepartment ? <option value="DEPARTMENT">{t.department}</option> : null}
                <option value="PROJECT">{t.projectLevel}</option>
              </select>
            </label>
            {form.level === "PROJECT" ? (
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-600">{t.project}</span>
                <select
                  required
                  value={form.projectId}
                  onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">{t.selectProject}</option>
                  {permission.manageableProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({project.key})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-600">{t.titleField}</span>
            <input
              required
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-600">{t.content}</span>
            <textarea
              required
              rows={7}
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm leading-6"
            />
          </label>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} disabled={isPending} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">
              {t.cancel}
            </button>
            <button type="submit" disabled={isPending || (form.level === "PROJECT" && !form.projectId)} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              {t.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NotificationDetailDialog({
  t,
  locale,
  notification,
  isPending,
  errorMsg,
  resendForm,
  setResendForm,
  onClose,
  onSubmitResend,
  onRevoke,
  onDelete,
}: {
  t: typeof TEXT[Locale];
  locale: Locale;
  notification: DepartmentNotificationListItem;
  isPending: boolean;
  errorMsg: string;
  resendForm: { title: string; content: string };
  setResendForm: React.Dispatch<React.SetStateAction<{ title: string; content: string }>>;
  onClose: () => void;
  onSubmitResend: (event: React.FormEvent<HTMLFormElement>) => void;
  onRevoke: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
                {levelLabel(notification.level, t)}
              </span>
              {notification.status === "REVOKED" ? (
                <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{t.revoked}</span>
              ) : null}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{notification.title}</h2>
            <p className="mt-1 text-xs text-slate-400">
              {formatDateTime(notification.createdAt, locale)} · {notification.authorName}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="overflow-y-auto px-6 py-5">
            {errorMsg ? <div className="mb-4 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{errorMsg}</div> : null}
            {notification.status === "REVOKED" && notification.canManage ? (
              <form onSubmit={onSubmitResend} className="space-y-4">
                <input
                  required
                  value={resendForm.title}
                  onChange={(event) => setResendForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
                <textarea
                  required
                  rows={10}
                  value={resendForm.content}
                  onChange={(event) => setResendForm((current) => ({ ...current, content: event.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm leading-6"
                />
                <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                  {t.resend}
                </button>
              </form>
            ) : (
              <div>
                <h3 className="mb-3 text-lg font-bold text-slate-800">{t.content}</h3>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{notification.content}</p>
              </div>
            )}
          </div>
          <aside className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0">
            <h3 className="text-sm font-bold text-slate-800">{t.status}</h3>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500">{t.project}</p>
                <p className="mt-1 text-slate-800">{notification.projectName || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">{t.createdBy}</p>
                <p className="mt-1 text-slate-800">{notification.authorName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">{t.createdAt}</p>
                <p className="mt-1 text-slate-800">{formatDateTime(notification.createdAt, locale)}</p>
              </div>
            </div>
          </aside>
        </div>
        {notification.canManage || notification.canDelete ? (
          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            {notification.canManage && notification.status === "SENT" ? (
              <button type="button" onClick={onRevoke} disabled={isPending} className="rounded-md border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                {t.revoke}
              </button>
            ) : null}
            {notification.canDelete ? (
              <button type="button" onClick={onDelete} disabled={isPending} className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">
                <Trash2 size={15} />
                {t.delete}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
