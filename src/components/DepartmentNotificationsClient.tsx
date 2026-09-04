"use client";

import { useMemo, useRef, useState, useTransition, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eye,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Inbox,
  Loader2,
  ListFilter,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Send,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import DepartmentNotificationDetailDialog from "@/components/DepartmentNotificationDetailDialog";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/RichTextEditor";
import type {
  DepartmentNotificationListItem,
  DepartmentNotificationPermission,
} from "@/lib/departmentNotifications";
import type { Locale } from "@/lib/i18n";
import {
  getListActionColumnWidth,
  LIST_ACTION_BUTTON_GAP,
  LIST_ACTION_COLUMN_PADDING_X,
} from "@/lib/listColumnSizing";
import {
  appendNotificationAttachmentsToContent,
  formatNotificationAttachmentSize,
  parseNotificationAttachmentsFromContent,
  stripNotificationAttachmentsFromContent,
  type NotificationAttachment,
} from "@/lib/notificationAttachments";
import { formatListDateTime } from "@/lib/timeFormat";

type FilterOption = {
  value: string;
  label: string;
};

type StoredNotificationColumnPreferences = {
  columnOrder?: ColumnId[];
  visibleColumns?: ColumnId[];
  columnWidths?: Partial<Record<ColumnId, number>>;
};

const NOTIFICATION_FILTER_KEYS = [
  "view",
  "category",
  "projectId",
  "read",
  "publishStatus",
  "authorId",
  "search",
  "sort",
  "direction",
  "createdFilter",
  "createdDate",
  "from",
  "to",
  "pageSize",
];

function buildStoredNotificationParams(params: URLSearchParams) {
  const stored = new URLSearchParams();
  NOTIFICATION_FILTER_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) stored.set(key, value);
  });
  return stored.toString();
}

function readStoredNotificationColumnPreferences(storageKey: string): StoredNotificationColumnPreferences | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredNotificationColumnPreferences;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

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
    switchToReceived: "Switch to received",
    switchToSent: "Switch to sent by me",
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
    advanced: "Advanced",
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
    attachments: "Attachments",
    addAttachment: "Add attachment",
    uploading: "Uploading",
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
    removeFilter: "Remove filter",
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
    switchToReceived: "切换到我收到的",
    switchToSent: "切换到我发出的",
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
    advanced: "高级",
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
    attachments: "附件",
    addAttachment: "添加附件",
    uploading: "上传中",
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
    columns: "显示列",
    resetColumns: "重置列",
    removeFilter: "取消筛选",
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

type AuthorOption = {
  id: string;
  name: string;
};

type ColumnId = "level" | "title" | "project" | "createdAt" | "author" | "read";
type ColumnConfig = {
  id: ColumnId;
  label: string;
  width: number;
  minWidth: number;
  sortable?: boolean;
};

const SYSTEM_AUTHOR_FILTER_VALUE = "__system";

function estimateNotificationHeaderTextWidth(label: string) {
  return Array.from(label).reduce((total, char) => total + (char.charCodeAt(0) > 255 ? 12.25 : 7), 0);
}

function estimateNotificationHeaderMinWidth(columnId: ColumnId, label: string, activeSingleFilterLabel?: string) {
  const horizontalPadding = 40;
  const sortWidth = columnId === "read" ? 0 : 16;
  const filterWidth = columnId === "title"
    ? 0
    : activeSingleFilterLabel
      ? Math.min(128, estimateNotificationHeaderTextWidth(activeSingleFilterLabel) + 14) + 4
      : 28;
  return Math.max(columnId === "createdAt" ? 160 : 60, horizontalPadding + estimateNotificationHeaderTextWidth(label) + sortWidth + filterWidth);
}

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
    attachments: t.attachments,
    addAttachment: t.addAttachment,
    uploading: t.uploading,
  };
}

function levelLabel(level: DepartmentNotificationListItem["level"], t: typeof TEXT[Locale]) {
  if (level === "DEPARTMENT") return t.department;
  if (level === "PROJECT") return t.projectLevel;
  return t.system;
}

function notificationAttachmentIcon(fileName: string) {
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

function NotificationAttachmentList({
  attachments,
  onRemove,
  isPending,
}: {
  attachments: NotificationAttachment[];
  onRemove: (attachmentId: string) => void;
  isPending: boolean;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-md border bg-card text-card-foreground shadow-xs">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex min-w-0 items-center justify-between gap-3 border-b px-3 py-2.5 text-sm last:border-b-0 hover:bg-accent/50">
          <a href={attachment.fileUrl} download={getAttachmentDownloadName(attachment.fileName)} target="_blank" rel="noreferrer" className="inline-flex min-w-0 flex-1 items-center gap-2.5 text-foreground">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              {notificationAttachmentIcon(attachment.fileName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{attachment.fileName}</span>
              {formatNotificationAttachmentSize(attachment.fileSize) ? (
                <span className="block text-xs text-muted-foreground">{formatNotificationAttachmentSize(attachment.fileSize)}</span>
              ) : null}
            </span>
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onRemove(attachment.id)}
            disabled={isPending}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
    </div>
  );
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
  authorOptions,
  filters,
  selectedNotificationId = "",
  pagination,
}: {
  departmentId: string;
  locale: Locale;
  notifications: DepartmentNotificationListItem[];
  permission: DepartmentNotificationPermission;
  projectOptions: ProjectOption[];
  authorOptions: AuthorOption[];
  filters: Record<string, string>;
  selectedNotificationId?: string;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const pathname = usePathname();
  const filterStorageKey = `neo-jira:notification-list-filters:${pathname}:v1`;
  const columnStorageKey = `neo-jira:notification-list-columns:${pathname}:v1`;
  const didAttemptFilterRestoreRef = useRef(false);
  const didRestoreStoredFiltersRef = useRef(false);
  const [isPending, startTransition] = useTransition();
  const currentView = filters.view === "sent" && permission.canCreate ? "sent" : "received";
  const initialSelectedNotification = selectedNotificationId
    ? notifications.find((notification) => notification.id === selectedNotificationId) || null
    : null;
  const [selected, setSelected] = useState<DepartmentNotificationListItem | null>(
    initialSelectedNotification
      ? {
          ...initialSelectedNotification,
          canManage: currentView === "sent" && initialSelectedNotification.canManage,
          canDelete: currentView === "sent" && initialSelectedNotification.canDelete,
        }
      : null,
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({
    level: permission.canCreateDepartment ? "DEPARTMENT" : "PROJECT",
    projectId: permission.manageableProjects[0]?.id || "",
    title: "",
    content: "",
  });
  const [resendForm, setResendForm] = useState({
    title: initialSelectedNotification?.title || "",
    content: stripNotificationAttachmentsFromContent(initialSelectedNotification?.content),
  });
  const [createAttachments, setCreateAttachments] = useState<NotificationAttachment[]>([]);
  const [isCreateAttachmentUploading, setIsCreateAttachmentUploading] = useState(false);
  const [resendAttachments, setResendAttachments] = useState<NotificationAttachment[]>(
    parseNotificationAttachmentsFromContent(initialSelectedNotification?.content)
  );
  const [resendOriginalAttachments, setResendOriginalAttachments] = useState<NotificationAttachment[]>(
    parseNotificationAttachmentsFromContent(initialSelectedNotification?.content)
  );
  const [isResendAttachmentUploading, setIsResendAttachmentUploading] = useState(false);
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(DEFAULT_COLUMN_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_COLUMN_ORDER);
  const [columnWidths, setColumnWidths] = useState(DEFAULT_WIDTHS);
  const [hasLoadedColumnPreferences, setHasLoadedColumnPreferences] = useState(false);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverSide, setDragOverSide] = useState<"left" | "right" | null>(null);
  const createdFilter = filters.createdFilter || "ALL";
  const createdDate = filters.createdDate || "";
  const createContentEditorRef = useRef<RichTextEditorHandle>(null);
  const resendContentEditorRef = useRef<RichTextEditorHandle>(null);
  const resizingRef = useRef<{
    colIndex: number;
    startX: number;
    startWidth: number;
    scrollContainer: HTMLElement | null;
    startScrollLeft: number;
  } | null>(null);

  const columnsById = useMemo(
    () => {
      const statusFilterValue = currentView === "sent" ? filters.publishStatus : filters.read;
      const statusFilterLabel = currentView === "sent"
        ? statusFilterValue === "SENT" ? t.sent : statusFilterValue === "REVOKED" ? t.revoked : ""
        : statusFilterValue === "read" ? t.read : statusFilterValue === "unread" ? t.unread : "";
      const createdFilterLabel = createdFilter !== "ALL"
        ? [
            createdFilter === "EQ" ? t.dateEquals : createdFilter === "GTE" ? t.dateOnOrAfter : t.dateOnOrBefore,
            createdDate,
          ].filter(Boolean).join(locale === "zh" ? "：" : ": ")
        : "";
      const column = (id: ColumnId, label: string, sortable = false): ColumnConfig => ({
        id,
        label,
        width: DEFAULT_WIDTHS[id],
        minWidth: estimateNotificationHeaderMinWidth(
          id,
          label,
          id === "read" ? statusFilterLabel : id === "createdAt" ? createdFilterLabel : undefined,
        ),
        sortable,
      });
      return new Map<ColumnId, ColumnConfig>([
        ["level", column("level", t.level, true)],
        ["title", column("title", t.titleField, true)],
        ["project", column("project", t.project, true)],
        ["createdAt", column("createdAt", t.createdAt, true)],
        ["author", column("author", t.createdBy, true)],
        ["read", column("read", t.status)],
      ]);
    },
    [createdDate, createdFilter, currentView, filters.publishStatus, filters.read, locale, t],
  );
  const columns = columnOrder
    .filter((columnId) => visibleColumns.includes(columnId))
    .map((columnId) => columnsById.get(columnId))
    .filter((column): column is ColumnConfig => Boolean(column))
    .map((column) => ({ ...column, width: Math.max(columnWidths[column.id] || column.width, column.minWidth) }));
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const rangeStart = pagination.total > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);
  const currentParams = useMemo(
    () => ({ ...filters, pageSize: String(pagination.pageSize) }),
    [filters, pagination.pageSize],
  );
  useEffect(() => {
    if (didAttemptFilterRestoreRef.current || typeof window === "undefined") return;
    didAttemptFilterRestoreRef.current = true;

    if (window.location.search) return;

    const stored = window.localStorage.getItem(filterStorageKey);
    if (stored) {
      didRestoreStoredFiltersRef.current = true;
      router.replace(`${pathname}?${stored}`);
    }
  }, [filterStorageKey, pathname, router]);

  useEffect(() => {
    if (!didAttemptFilterRestoreRef.current || typeof window === "undefined") return;
    if (didRestoreStoredFiltersRef.current && !window.location.search) return;
    didRestoreStoredFiltersRef.current = false;

    const params = new URLSearchParams(currentParams);
    params.delete("page");
    const stored = buildStoredNotificationParams(params);
    if (stored) {
      window.localStorage.setItem(filterStorageKey, stored);
    } else {
      window.localStorage.removeItem(filterStorageKey);
    }
  }, [currentParams, filterStorageKey]);
  const showActionColumn = currentView === "sent";
  const actionColumnWidth = getListActionColumnWidth(2);
  const notificationTableMinWidth = columns.reduce((total, column) => total + column.width, 0) +
    (showActionColumn ? actionColumnWidth : 0);
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
    const storedPreferences = readStoredNotificationColumnPreferences(columnStorageKey);
    const validOrder = storedPreferences?.columnOrder?.filter((columnId) => DEFAULT_COLUMN_ORDER.includes(columnId));
    const validVisibleColumns = storedPreferences?.visibleColumns?.filter((columnId) => DEFAULT_COLUMN_ORDER.includes(columnId));
    const validColumnWidths = Object.entries(storedPreferences?.columnWidths || {}).reduce(
      (acc, [columnId, width]) => {
        if (DEFAULT_COLUMN_ORDER.includes(columnId as ColumnId) && typeof width === "number" && width >= 60) {
          acc[columnId as ColumnId] = width;
        }
        return acc;
      },
      {} as Partial<Record<ColumnId, number>>
    );

    setColumnOrder(
      validOrder?.length
        ? [...validOrder, ...DEFAULT_COLUMN_ORDER.filter((columnId) => !validOrder.includes(columnId))]
        : DEFAULT_COLUMN_ORDER
    );
    setVisibleColumns(validVisibleColumns?.length ? validVisibleColumns : DEFAULT_COLUMN_ORDER);
    setColumnWidths({ ...DEFAULT_WIDTHS, ...validColumnWidths });
    setHasLoadedColumnPreferences(true);
  }, [columnStorageKey]);

  useEffect(() => {
    if (!hasLoadedColumnPreferences || typeof window === "undefined") return;

    window.localStorage.setItem(
      columnStorageKey,
      JSON.stringify({
        columnOrder,
        visibleColumns,
        columnWidths,
      } satisfies StoredNotificationColumnPreferences)
    );
  }, [columnOrder, columnStorageKey, columnWidths, hasLoadedColumnPreferences, visibleColumns]);

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
      if (notification.targetUrl) {
        window.open(notification.targetUrl, "_blank", "noreferrer");
      }
      startTransition(async () => {
        if (!notification.read) await markSystemNotificationRead(notification.id);
        router.refresh();
      });
      return;
    }

    if (notification.category === "REMINDER" && notification.targetUrl) {
      window.open(notification.targetUrl, "_blank", "noreferrer");
      if (!notification.read && notification.status === "SENT") {
        startTransition(async () => {
          await markAnnouncementRead(notification.id);
          router.refresh();
        });
      }
      return;
    }

    setSelected({
      ...notification,
      canManage: currentView === "sent" && notification.canManage,
      canDelete: currentView === "sent" && notification.canDelete,
    });
    const attachments = parseNotificationAttachmentsFromContent(notification.content);
    setResendForm({ title: notification.title, content: stripNotificationAttachmentsFromContent(notification.content) });
    setResendAttachments(attachments);
    setResendOriginalAttachments(attachments);
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
        content: appendNotificationAttachmentsToContent(form.content, createAttachments),
      });
      if (!result.success) {
        setErrorMsg(result.error || t.createFailed);
        return;
      }
      createContentEditorRef.current?.commitPendingUploads();
      setCreateAttachments([]);
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
      const result = await resendAnnouncementNotification(selected.id, {
        ...resendForm,
        content: appendNotificationAttachmentsToContent(resendForm.content, resendAttachments),
      });
      if (!result.success) {
        setErrorMsg(result.error || t.manageFailed);
        return;
      }
      resendContentEditorRef.current?.commitPendingUploads();
      setResendOriginalAttachments(resendAttachments);
      setSelected(null);
      router.refresh();
    });
  };

  const deleteUploadedAttachment = async (attachment: NotificationAttachment) => {
    try {
      await fetch("/api/upload", {
        method: "DELETE",
        body: JSON.stringify({ fileUrl: attachment.fileUrl }),
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Failed to delete notification attachment:", error);
    }
  };

  const handleNotificationAttachmentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    target: "create" | "resend"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg(locale === "zh" ? "附件大小不能超过 50 MB" : "File size cannot exceed 50 MB");
      event.target.value = "";
      return;
    }

    setErrorMsg("");
    const setUploading = target === "create" ? setIsCreateAttachmentUploading : setIsResendAttachmentUploading;
    const setAttachments = target === "create" ? setCreateAttachments : setResendAttachments;
    setUploading(true);

    const data = new FormData();
    data.append("file", file);
    data.append("departmentId", departmentId);

    try {
      const response = await fetch("/api/upload", { method: "POST", body: data });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        setErrorMsg(errorData?.error || (locale === "zh" ? "上传附件失败" : "Failed to upload attachment"));
        return;
      }

      const result = await response.json();
      setAttachments((current) => [
        ...current,
        { id: `${Date.now()}-${result.fileUrl}`, fileName: result.fileName, fileUrl: result.fileUrl, fileSize: file.size },
      ]);
    } catch (error) {
      console.error("Failed to upload notification attachment:", error);
      setErrorMsg(locale === "zh" ? "上传附件失败" : "Failed to upload attachment");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const removeCreateAttachment = (attachmentId: string) => {
    const attachment = createAttachments.find((item) => item.id === attachmentId);
    if (!attachment) return;
    setCreateAttachments((current) => current.filter((item) => item.id !== attachmentId));
    void deleteUploadedAttachment(attachment);
  };

  const removeResendAttachment = (attachmentId: string) => {
    const attachment = resendAttachments.find((item) => item.id === attachmentId);
    if (!attachment) return;
    setResendAttachments((current) => current.filter((item) => item.id !== attachmentId));
    if (!resendOriginalAttachments.some((item) => item.fileUrl === attachment.fileUrl)) {
      void deleteUploadedAttachment(attachment);
    }
  };

  const cleanupCreateAttachments = async () => {
    if (createAttachments.length === 0) return;
    await Promise.all(createAttachments.map((attachment) => deleteUploadedAttachment(attachment)));
    setCreateAttachments([]);
  };

  const cleanupPendingResendAttachments = async () => {
    const originalUrls = new Set(resendOriginalAttachments.map((attachment) => attachment.fileUrl));
    const uploadedDuringEdit = resendAttachments.filter((attachment) => !originalUrls.has(attachment.fileUrl));
    if (uploadedDuringEdit.length === 0) return;
    await Promise.all(uploadedDuringEdit.map((attachment) => deleteUploadedAttachment(attachment)));
    setResendAttachments(resendOriginalAttachments);
  };

  const closeCreateDialog = () => {
    void createContentEditorRef.current?.discardPendingUploads();
    void cleanupCreateAttachments();
    setIsCreateOpen(false);
  };

  const closeDetailDialog = () => {
    void resendContentEditorRef.current?.discardPendingUploads();
    void cleanupPendingResendAttachments();
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
    if (!col) return;
    const startWidth = col.width || 150;
    const scrollContainer = event.currentTarget.closest<HTMLElement>(".overflow-x-auto");
    resizingRef.current = {
      colIndex,
      startX: event.clientX,
      startWidth,
      scrollContainer,
      startScrollLeft: scrollContainer?.scrollLeft ?? 0,
    };
    const handleMove = (moveEvent: MouseEvent) => {
      const current = resizingRef.current;
      if (!current) return;
      const resizeColumnId = columns[current.colIndex]?.id;
      if (!resizeColumnId) return;
      const resizeMinWidth = columns[current.colIndex]?.minWidth || 60;

      const delta = moveEvent.clientX - current.startX;

      const newWidth = Math.max(resizeMinWidth, current.startWidth + delta);
      setColumnWidths((widths) => ({
        ...widths,
        [resizeColumnId]: newWidth,
      }));
      if (current.colIndex === columns.length - 1 && current.scrollContainer) {
        const nextScrollLeft = Math.max(0, current.startScrollLeft + newWidth - current.startWidth);
        window.requestAnimationFrame(() => current.scrollContainer?.scrollTo({ left: nextScrollLeft }));
      }
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

  const summarySeparator = locale === "zh" ? "、" : ", ";
  const categorySummaryOptions = [
    { value: "ANNOUNCEMENT", label: t.announcementsTab },
    { value: "REMINDER", label: t.remindersTab },
    { value: "UPDATE", label: t.updatesTab },
  ];
  const statusSummaryOptions = currentView === "sent"
    ? [
        { value: "SENT", label: t.sent },
        { value: "REVOKED", label: t.revoked },
      ]
    : [
        { value: "unread", label: t.unread },
        { value: "read", label: t.read },
      ];
  const authorSummaryOptions = [
    ...authorOptions.map((author) => ({ value: author.id, label: author.name })),
    ...(currentView === "received" ? [{ value: SYSTEM_AUTHOR_FILTER_VALUE, label: t.system }] : []),
  ];
  const projectSummaryOptions = projectOptions.map((project) => ({
    value: project.id,
    label: `${project.name} (${project.key})`,
  }));
  const summaryValue = (rawValue: string | undefined, options: FilterOption[]) =>
    (rawValue || "")
      .split(",")
      .filter(Boolean)
      .map((value) => options.find((option) => option.value === value)?.label || value)
      .join(summarySeparator);
  const createdSummaryValue = createdFilter !== "ALL"
    ? [createdFilterOptions.find((option) => option.value === createdFilter)?.label || createdFilter, createdDate]
        .filter(Boolean)
        .join(locale === "zh" ? "：" : ": ")
    : filters.from || filters.to
      ? `${filters.from || "…"} – ${filters.to || "…"}`
      : "";
  const notificationFilterSummary = [
    ...(filters.category ? [{
      key: "category",
      label: t.level,
      value: summaryValue(filters.category, categorySummaryOptions),
      clear: () => updateQueryParams({ category: null, page: 1 }),
    }] : []),
    ...(filters.projectId ? [{
      key: "project",
      label: t.project,
      value: summaryValue(filters.projectId, projectSummaryOptions),
      clear: () => updateQueryParams({ projectId: null, page: 1 }),
    }] : []),
    ...(currentView === "sent" && filters.publishStatus ? [{
      key: "status",
      label: t.status,
      value: summaryValue(filters.publishStatus, statusSummaryOptions),
      clear: () => updateQueryParams({ publishStatus: null, page: 1 }),
    }] : []),
    ...(currentView === "received" && filters.read ? [{
      key: "status",
      label: t.status,
      value: summaryValue(filters.read, statusSummaryOptions),
      clear: () => updateQueryParams({ read: null, page: 1 }),
    }] : []),
    ...(filters.authorId ? [{
      key: "author",
      label: t.createdBy,
      value: summaryValue(filters.authorId, authorSummaryOptions),
      clear: () => updateQueryParams({ authorId: null, page: 1 }),
    }] : []),
    ...(createdSummaryValue ? [{
      key: "createdAt",
      label: t.createdAt,
      value: createdSummaryValue,
      clear: () => updateQueryParams({ createdFilter: null, createdDate: null, from: null, to: null, page: 1 }),
    }] : []),
  ];

  const isColumnFilterActive = (columnId: ColumnId) => {
    if (columnId === "level") return Boolean(filters.category);
    if (columnId === "project") return Boolean(filters.projectId);
    if (columnId === "read") return Boolean(currentView === "sent" ? filters.publishStatus : filters.read);
    if (columnId === "author") return Boolean(filters.authorId);
    if (columnId === "createdAt") return createdFilter !== "ALL" || Boolean(createdDate || filters.from || filters.to);
    return false;
  };

  const renderColumnMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="pointer-events-auto border-0 bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] text-muted-foreground shadow-none hover:bg-muted hover:text-foreground group-hover/column:bg-muted"
          aria-label={t.columns}
          title={t.columns}
        >
          <Eye className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between gap-3">
          <span>{t.columns}</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            {visibleColumns.length}/{DEFAULT_COLUMN_ORDER.length}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DEFAULT_COLUMN_ORDER.map((columnId) => {
          const column = columnsById.get(columnId);
          if (!column) return null;
          const isChecked = visibleColumns.includes(column.id);
          const isDisabled = isChecked && (visibleColumns.length === 1 || isColumnFilterActive(column.id));

          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={isChecked}
              disabled={isDisabled}
              onCheckedChange={() => handleToggleColumnVisibility(column.id)}
              onSelect={(event) => event.preventDefault()}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator />
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={handleResetColumns}
          className="w-full justify-start text-primary hover:text-primary"
        >
          {t.resetColumns}
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderHeaderFilter = (columnId: ColumnId) => {
    if (columnId === "level") {
      const options = [
        { value: "ANNOUNCEMENT", label: t.announcementsTab },
        { value: "REMINDER", label: t.remindersTab },
        { value: "UPDATE", label: t.updatesTab },
      ];
      const selectedValues = filters.category ? filters.category.split(",") : [];
      return (
        <HeaderMultiFilter
          label={t.level}
          options={options}
          selectedValues={selectedValues}
          onToggle={(value) => toggleFilterValue(value, "category", selectedValues)}
          onClear={() => updateQueryParams({ category: null, page: 1 })}
          allLabel={t.all}
        />
      );
    }

    if (columnId === "project") {
      const options = projectOptions.map((project) => ({ value: project.id, label: `${project.name} (${project.key})` }));
      const selectedValues = filters.projectId ? filters.projectId.split(",") : [];
      return (
        <HeaderMultiFilter
          label={t.project}
          options={options}
          selectedValues={selectedValues}
          onToggle={(value) => toggleFilterValue(value, "projectId", selectedValues)}
          onClear={() => updateQueryParams({ projectId: null, page: 1 })}
          allLabel={t.all}
        />
      );
    }

    if (columnId === "read") {
      const filterKey = currentView === "sent" ? "publishStatus" : "read";
      const options = currentView === "sent"
        ? [
            { value: "SENT", label: t.sent },
            { value: "REVOKED", label: t.revoked },
          ]
        : [
            { value: "unread", label: t.unread },
            { value: "read", label: t.read },
          ];
      const selectedValue = filters[filterKey] || "all";
      return (
        <HeaderSingleFilter
          label={t.status}
          value={selectedValue}
          options={[{ value: "all", label: t.all }, ...options]}
          onChange={(value) => updateQueryParams({ [filterKey]: value === "all" ? null : value, page: 1 })}
        />
      );
    }

    if (columnId === "author") {
      const options = [
        ...authorOptions.map((author) => ({ value: author.id, label: author.name })),
        ...(currentView === "received" ? [{ value: SYSTEM_AUTHOR_FILTER_VALUE, label: t.system }] : []),
      ];
      const selectedValues = filters.authorId ? filters.authorId.split(",") : [];
      return (
        <HeaderMultiFilter
          label={t.createdBy}
          options={options}
          selectedValues={selectedValues}
          onToggle={(value) => toggleFilterValue(value, "authorId", selectedValues)}
          onClear={() => updateQueryParams({ authorId: null, page: 1 })}
          allLabel={t.all}
        />
      );
    }

    if (columnId === "createdAt") {
      return (
        <HeaderCreatedFilter
          label={t.createdAt}
          value={createdFilter}
          date={createdDate}
          options={createdFilterOptions}
          onChange={(value) => updateQueryParams({
            createdFilter: value,
            createdDate: value === "ALL" ? null : createdDate,
            from: null,
            to: null,
            page: 1,
          })}
          onDateChange={(value) => updateQueryParams({ createdDate: value, from: null, to: null, page: 1 })}
        />
      );
    }

    return null;
  };

  const renderCell = (notification: DepartmentNotificationListItem, columnId: ColumnId) => {
    if (columnId === "level") {
      return (
        <Badge variant="secondary" className="max-w-full">
          {notification.typeLabel || levelLabel(notification.level, t)}
        </Badge>
      );
    }
    if (columnId === "title") {
      return (
        <button
          type="button"
          onClick={() => openNotification(notification)}
          className="block max-w-full truncate text-left text-sm font-semibold text-foreground hover:text-primary"
        >
          {notification.title}
        </button>
      );
    }
    if (columnId === "project") return <span className="truncate text-sm text-muted-foreground">{notification.projectName || ""}</span>;
    if (columnId === "createdAt") {
      return (
        <span className="whitespace-nowrap text-xs font-medium text-muted-foreground" title={formatDateTime(notification.createdAt, locale)}>
          {formatListDateTime(notification.createdAt)}
        </span>
      );
    }
    if (columnId === "author") return <span className="truncate text-sm text-muted-foreground">{notification.authorName}</span>;
    if (currentView === "sent" && notification.status === "REVOKED") {
      return <Badge variant="secondary" className="bg-rose-50 text-rose-700">{t.revoked}</Badge>;
    }
    if (currentView === "sent") {
      return <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">{t.sent}</Badge>;
    }
    return (
      <Badge variant={notification.read ? "secondary" : "default"}>
        {notification.read ? t.read : t.unread}
      </Badge>
    );
  };

  return (
    <div className="flex min-h-0 flex-col space-y-4">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{t.title}</h2>
          {permission.canCreate ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                updateQueryParams({
                  view: currentView === "received" ? "sent" : null,
                  category: null,
                  read: null,
                  publishStatus: null,
                  authorId: null,
                  page: 1,
                })
              }
              className="text-muted-foreground hover:text-foreground"
              aria-label={currentView === "received" ? t.switchToSent : t.switchToReceived}
              title={currentView === "received" ? t.switchToSent : t.switchToReceived}
            >
              {currentView === "received" ? <Inbox /> : <Send />}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72 max-w-[42vw]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t.searchPlaceholder}
              value={filters.search || ""}
              onChange={(e) => {
                updateQueryParams({ search: e.target.value, page: 1 });
              }}
              className="pl-9 pr-9"
            />
            {filters.search ? (
              <button
                type="button"
                onClick={() => {
                  updateQueryParams({ search: null, page: 1 });
                }}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label={locale === "zh" ? "清除搜索" : "Clear search"}
                title={locale === "zh" ? "清除搜索" : "Clear search"}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          {permission.canCreate ? (
            <Button
              type="button"
              onClick={() => {
                setErrorMsg("");
                setIsCreateOpen(true);
              }}
            >
              <Plus size={16} />
              {locale === "zh" ? "通知" : "Notification"}
            </Button>
          ) : null}
        </div>
      </div>

      {notificationFilterSummary.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-sm">
          {notificationFilterSummary.map((filter) => (
            <div key={filter.key} className="inline-flex max-w-[360px] items-start rounded-md border bg-background text-foreground shadow-xs">
              <span className="flex min-w-0 items-center px-2.5 py-1">
                <span className="shrink-0 text-muted-foreground">{filter.label}：</span>
                <span className="min-w-0 truncate" title={filter.value}>{filter.value}</span>
              </span>
              <button
                type="button"
                className="m-0.5 ml-0 inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`${t.removeFilter}：${filter.label}`}
                title={`${t.removeFilter}：${filter.label}`}
                onClick={filter.clear}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="relative overflow-x-auto">
          <table
            className="text-left text-sm"
            style={{ tableLayout: "fixed", width: `max(100%, ${notificationTableMinWidth}px)` }}
          >
            <colgroup>
              {columns.map((column) => <col key={column.id} style={{ width: `${column.width}px` }} />)}
              {showActionColumn ? <col /> : null}
              {showActionColumn ? <col style={{ width: `${actionColumnWidth}px` }} /> : null}
            </colgroup>
            <thead className="border-b bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
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
                      className={`group/column relative h-12 cursor-move select-none overflow-hidden bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] px-5 py-0 align-middle transition-colors hover:bg-muted active:cursor-move ${
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
                      <div className="flex max-w-full min-w-0 items-center gap-1">
                        {column.sortable ? (
                          <button
                            type="button"
                            onClick={() => updateQueryParams({ sort: column.id, direction: nextDirection, page: 1 })}
                            className="inline-flex min-w-0 items-center gap-1 font-semibold text-muted-foreground hover:text-foreground"
                            draggable={false}
                          >
                            <span className="truncate">{column.label}</span>
                            {isSorted ? (
                              filters.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : null}
                          </button>
                        ) : (
                          <span className="inline-flex min-w-0 items-center gap-1 font-semibold text-muted-foreground">
                            <span className="truncate">{column.label}</span>
                          </span>
                        )}
                        {renderHeaderFilter(column.id)}
                      </div>
                      {showRightLine ? <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-blue-500 z-10" /> : null}
                      <div
                        className="group/resize absolute bottom-0 right-0 top-0 z-20 w-4 cursor-ew-resize"
                        onMouseDown={(event) => handleResizeStart(event, index)}
                        draggable={false}
                        title={locale === "zh" ? "拖拽调整列宽" : "Drag to resize column"}
                      >
                        <span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-border opacity-0 transition-[width,background-color,opacity] group-hover/column:opacity-100 group-hover/resize:w-0.5 group-hover/resize:bg-primary" />
                      </div>
                      {!showActionColumn && index === columns.length - 1 ? (
                        <div className="pointer-events-none absolute right-2 top-3 z-30">
                          {renderColumnMenu()}
                        </div>
                      ) : null}
                    </th>
                  );
                })}
                {showActionColumn ? (
                  <>
                    <th aria-hidden className="h-12 bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] p-0 hover:bg-muted" />
                    <th
                      className="group/column sticky right-0 z-20 h-12 select-none overflow-hidden bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] py-0 text-left align-middle whitespace-nowrap shadow-[-6px_0_8px_-8px_rgba(15,23,42,0.45)] hover:bg-muted"
                      style={{ width: actionColumnWidth, minWidth: actionColumnWidth, paddingInline: LIST_ACTION_COLUMN_PADDING_X }}
                    >
                      <span className="font-semibold text-muted-foreground">{t.actions}</span>
                      <div className="pointer-events-none absolute right-2 top-3 z-30">
                        {renderColumnMenu()}
                      </div>
                    </th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {notifications.length === 0 ? (
                <tr>
                  <td
                    colSpan={(columns.length || 1) + (showActionColumn ? 2 : 0)}
                    className="px-5 py-16 text-center text-sm text-muted-foreground"
                  >
                    {t.noNotifications}
                  </td>
                </tr>
              ) : (
                notifications.map((notification) => (
                  <tr
                    key={notification.receiptId}
                    className="group hover:bg-muted/40"
                  >
                    {columns.map((column) => (
                      <td key={column.id} className="overflow-hidden px-5 py-3.5 align-middle">
                        {renderCell(notification, column.id)}
                      </td>
                    ))}
                    {showActionColumn ? (
                      <>
                        <td aria-hidden className="p-0" />
                        <td
                          className="sticky right-0 z-10 overflow-hidden bg-card py-3.5 text-left align-middle whitespace-nowrap shadow-[-6px_0_8px_-8px_rgba(15,23,42,0.45)] group-hover:bg-muted/40"
                          style={{ width: actionColumnWidth, minWidth: actionColumnWidth, paddingInline: LIST_ACTION_COLUMN_PADDING_X }}
                        >
                          <div className="inline-flex items-center" style={{ gap: LIST_ACTION_BUTTON_GAP }}>
                          {notification.canManage && notification.status === "SENT" ? (
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="outline"
                              onClick={() => manage("revoke", notification.id)}
                              disabled={isPending}
                              className="text-amber-700 hover:bg-amber-50 hover:text-amber-700"
                              aria-label={t.revoke}
                              title={t.revoke}
                            >
                              <RotateCcw />
                            </Button>
                          ) : null}
                          {notification.canDelete ? (
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="outline"
                              onClick={() => manage("delete", notification.id)}
                              disabled={isPending}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              aria-label={t.delete}
                              title={t.delete}
                            >
                              <Trash2 />
                            </Button>
                          ) : null}
                          </div>
                        </td>
                      </>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3 text-sm">
          <div className="font-medium text-muted-foreground">
            {locale === "zh" ? (
              <>
                {t.showing}
                <span className="font-bold text-foreground"> {rangeStart} </span>
                {t.rangeTo}
                <span className="font-bold text-foreground"> {rangeEnd} </span>
                {t.of}
                <span className="font-bold text-foreground"> {pagination.total} </span>
                {t.notificationsUnit}
              </>
            ) : (
              <>
                {t.showing} <span className="font-bold text-foreground">{rangeStart}</span> {t.rangeTo}{" "}
                <span className="font-bold text-foreground">{rangeEnd}</span> {t.of}{" "}
                <span className="font-bold text-foreground">{pagination.total}</span>{" "}
                {t.notificationsUnit}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{t.perPage}</span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) => {
                  updateQueryParams({ pageSize: value, page: 1 });
                }}
              >
                <SelectTrigger size="sm" className="w-20 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {[10, 20, 50].map((option) => (
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
                onClick={() => updateQueryParams({ page: Math.max(1, pagination.page - 1) })}
                disabled={pagination.page <= 1}
              >
                <ArrowLeft size={18} />
              </Button>

              <span className="min-w-24 px-2 text-center font-medium leading-none text-foreground">
                {locale === "zh"
                  ? `${t.page}${pagination.page}/${totalPages || 1}页`
                  : `${t.page} ${pagination.page} of ${totalPages || 1}`}
              </span>

              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => updateQueryParams({ page: Math.min(totalPages || 1, pagination.page + 1) })}
                disabled={pagination.page >= totalPages || totalPages === 0}
              >
                <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {isCreateOpen ? (
        <NotificationFormDialog
          departmentId={departmentId}
          t={t}
          isPending={isPending}
          errorMsg={errorMsg}
          form={form}
          setForm={setForm}
          permission={permission}
          editorRef={createContentEditorRef}
          attachments={createAttachments}
          isAttachmentUploading={isCreateAttachmentUploading}
          onUploadAttachment={(event) => void handleNotificationAttachmentUpload(event, "create")}
          onRemoveAttachment={removeCreateAttachment}
          onClose={closeCreateDialog}
          onSubmit={submitCreate}
        />
      ) : null}

      {selected ? (
        <DepartmentNotificationDetailDialog
          departmentId={departmentId}
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
          resendAttachments={resendAttachments}
          isResendAttachmentUploading={isResendAttachmentUploading}
          onUploadResendAttachment={(event) => void handleNotificationAttachmentUpload(event, "resend")}
          onRemoveResendAttachment={removeResendAttachment}
        />
      ) : null}
    </div>
  );
}

function headerFilterButton({
  label,
  active,
  summary,
  accessibleSummary = summary,
}: {
  label: string;
  active: boolean;
  summary: string;
  accessibleSummary?: string;
}) {
  const accessibleLabel = `${label}: ${active ? accessibleSummary : summary}`;

  return (
    <Button
      type="button"
      variant={active ? "outline" : "ghost"}
      size={active ? "sm" : "icon-xs"}
      className={active
        ? "h-5 min-w-0 max-w-32 shrink-0 bg-background px-1.5 text-xs font-normal normal-case"
        : "shrink-0 text-muted-foreground"}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      draggable={false}
    >
      {active ? <span className="truncate">{summary}</span> : <ListFilter />}
    </Button>
  );
}

function HeaderMultiFilter({
  label,
  options,
  selectedValues,
  onToggle,
  onClear,
  allLabel,
}: {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  allLabel: string;
}) {
  const selectedLabels = options.filter((option) => selectedValues.includes(option.value)).map((option) => option.label);
  const selectionLabel = selectedLabels.join(", ") || allLabel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {headerFilterButton({
          label,
          active: selectedValues.length > 0,
          summary: selectedValues.length > 0 ? String(selectedValues.length) : allLabel,
          accessibleSummary: selectionLabel,
        })}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 normal-case">
        <DropdownMenuCheckboxItem
          checked={selectedValues.length === 0}
          onCheckedChange={onClear}
          onSelect={(event) => event.preventDefault()}
        >
          {allLabel}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={() => onToggle(option.value)}
            onSelect={(event) => event.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HeaderSingleFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label || options[0]?.label || value;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {headerFilterButton({ label, active: value !== options[0]?.value, summary: selectedLabel })}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48 normal-case">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options[0] ? <DropdownMenuRadioItem value={options[0].value}>{options[0].label}</DropdownMenuRadioItem> : null}
          {options.length > 1 ? <DropdownMenuSeparator /> : null}
          {options.slice(1).map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HeaderCreatedFilter({
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
  options: FilterOption[];
  onChange: (value: string) => void;
  onDateChange: (value: string) => void;
}) {
  const selectedOption = options.find((option) => option.value === value) || options[0];
  const isActive = value !== "ALL" || Boolean(date);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {headerFilterButton({
          label,
          active: isActive,
          summary: isActive ? [selectedOption?.label, date].filter(Boolean).join(" ") : selectedOption?.label || value,
        })}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 normal-case">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options[0] ? <DropdownMenuRadioItem value={options[0].value}>{options[0].label}</DropdownMenuRadioItem> : null}
          {options.length > 1 ? <DropdownMenuSeparator /> : null}
          {options.slice(1).map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {value !== "ALL" ? (
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

function NotificationFormDialog({
  departmentId,
  t,
  isPending,
  errorMsg,
  form,
  setForm,
  permission,
  editorRef,
  attachments,
  isAttachmentUploading,
  onUploadAttachment,
  onRemoveAttachment,
  onClose,
  onSubmit,
}: {
  departmentId: string;
  t: typeof TEXT[Locale];
  isPending: boolean;
  errorMsg: string;
  form: { level: string; projectId: string; title: string; content: string };
  setForm: React.Dispatch<React.SetStateAction<{ level: string; projectId: string; title: string; content: string }>>;
  permission: DepartmentNotificationPermission;
  editorRef: React.RefObject<RichTextEditorHandle | null>;
  attachments: NotificationAttachment[];
  isAttachmentUploading: boolean;
  onUploadAttachment: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (attachmentId: string) => void;
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
    <Dialog open onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b bg-muted/35 px-6 py-4 pr-12">
            <DialogTitle>{t.newNotification}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {errorMsg ? <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{errorMsg}</div> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t.level}</Label>
                <div className="grid gap-1 rounded-md border bg-muted p-1 sm:grid-cols-2">
                  {levelOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex h-8 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors ${
                        form.level === option.value
                          ? "border-primary/30 bg-background text-foreground shadow-sm"
                          : "border-transparent bg-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground"
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
                <div className="space-y-1.5">
                  <Label htmlFor="notification-project">{t.project}</Label>
                  <Select
                    value={form.projectId || undefined}
                    onValueChange={(value) => setForm((current) => ({ ...current, projectId: value }))}
                  >
                    <SelectTrigger id="notification-project" className="w-full">
                      <SelectValue placeholder={t.selectProject} />
                    </SelectTrigger>
                    <SelectContent>
                      {projectOptions
                        .filter((option) => option.value)
                        .map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notification-title">
                {t.titleField} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="notification-title"
                required
                autoFocus
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>
                {t.content} <span className="text-destructive">*</span>
              </Label>
              <div className="h-72 min-h-0 rounded-lg border bg-background">
                <RichTextEditor
                  ref={editorRef}
                  departmentId={departmentId}
                  value={form.content}
                  onChange={(value) => setForm((current) => ({ ...current, content: value || "" }))}
                  height={220}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>{`${t.attachments} (${attachments.length})`}</Label>
                <Button asChild type="button" variant="secondary" size="sm" disabled={isAttachmentUploading || isPending}>
                  <label className="cursor-pointer">
                    {isAttachmentUploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                    {isAttachmentUploading ? t.uploading : t.addAttachment}
                    <input type="file" className="hidden" onChange={onUploadAttachment} disabled={isAttachmentUploading || isPending} />
                  </label>
                </Button>
              </div>
              <NotificationAttachmentList attachments={attachments} onRemove={onRemoveAttachment} isPending={isPending} />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-muted/35 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              {t.cancel}
            </Button>
            <Button
              type="submit"
              disabled={isPending || isAttachmentUploading || !form.title.trim() || !form.content.trim() || (form.level === "PROJECT" && !form.projectId)}
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              {t.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
