"use client";

import { useMemo, useRef, useState, useTransition, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Eye,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Paperclip,
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DepartmentNotificationDetailDialog from "@/components/DepartmentNotificationDetailDialog";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/RichTextEditor";
import ShadcnDatePicker from "@/components/ShadcnDatePicker";
import type {
  DepartmentNotificationListItem,
  DepartmentNotificationPermission,
} from "@/lib/departmentNotifications";
import type { Locale } from "@/lib/i18n";
import {
  appendNotificationAttachmentsToContent,
  formatNotificationAttachmentSize,
  parseNotificationAttachmentsFromContent,
  stripNotificationAttachmentsFromContent,
  type NotificationAttachment,
} from "@/lib/notificationAttachments";
import { formatRelativeTime } from "@/lib/timeFormat";

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

const ACTION_COLUMN_MIN_WIDTH = 56;

function estimateNotificationActionButtonWidth(label: string, hasIcon = false) {
  const textWidth = Array.from(label).reduce((total, char) => total + (char.charCodeAt(0) > 255 ? 12 : 6), 0);
  return Math.max(32, textWidth + (hasIcon ? 16 : 0) + 16);
}

function estimateNotificationActionColumnWidth(
  buttons: Array<{ label: string; hasIcon?: boolean }>,
  headerLabel: string
) {
  const buttonGap = buttons.length > 1 ? (buttons.length - 1) * 8 : 0;
  const buttonsWidth = buttons.reduce((total, button) => total + estimateNotificationActionButtonWidth(button.label, button.hasIcon), 0);
  const headerWidth = estimateNotificationActionButtonWidth(headerLabel) + 16;
  return Math.ceil(Math.max(ACTION_COLUMN_MIN_WIDTH, headerWidth, buttonsWidth + buttonGap + 16));
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
  filters,
  selectedNotificationId = "",
  pagination,
}: {
  departmentId: string;
  locale: Locale;
  notifications: DepartmentNotificationListItem[];
  permission: DepartmentNotificationPermission;
  projectOptions: ProjectOption[];
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
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
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
  const createdFilter = filters.createdFilter || "ALL";
  const createdDate = filters.createdDate || "";
  const currentCategory = filters.category || "";
  const showActionColumn = currentView === "sent";
  const actionColumnWidth = useMemo(() => {
    let maxWidth = estimateNotificationActionColumnWidth([], t.actions);

    for (const notification of notifications) {
      const buttons = [
        ...(notification.canManage && notification.status === "SENT" ? [{ label: t.revoke }] : []),
        ...(notification.canDelete ? [{ label: t.delete, hasIcon: true }] : []),
      ];
      maxWidth = Math.max(maxWidth, estimateNotificationActionColumnWidth(buttons, t.actions));
    }

    return maxWidth;
  }, [notifications, t.actions, t.delete, t.revoke]);
  const hasActiveCreatedFilter = createdFilter !== "ALL" || Boolean(createdDate || filters.from || filters.to);
  const activeAdvancedFilterCount =
    (filters.projectId ? 1 : 0) +
    (filters.read || filters.publishStatus ? 1 : 0) +
    (hasActiveCreatedFilter ? 1 : 0);
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
        <span className="whitespace-nowrap text-sm text-muted-foreground" title={formatDateTime(notification.createdAt, locale)}>
          {formatRelativeTime(notification.createdAt, locale)}
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
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{t.title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {permission.canCreate ? (
            <div className="inline-flex rounded-md border bg-muted/45 p-1">
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
                      isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}
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

      <div className="rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1">
            {currentView === "received"
              ? [
                  { value: "", label: t.all },
                  { value: "ANNOUNCEMENT", label: t.announcementsTab },
                  { value: "REMINDER", label: t.remindersTab },
                  { value: "UPDATE", label: t.updatesTab },
                ].map((option) => (
                  <Button
                    key={option.value || "ALL"}
                    type="button"
                    size="sm"
                    variant={currentCategory === option.value ? "default" : "ghost"}
                    onClick={() => updateQueryParams({ category: option.value || null, page: 1 })}
                  >
                    {option.label}
                  </Button>
                ))
              : null}
            <Button
              type="button"
              size="sm"
              variant="link"
              className="gap-1 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsAdvancedFilterOpen((current) => !current)}
              aria-expanded={isAdvancedFilterOpen}
            >
              <span>{t.advanced}</span>
              {activeAdvancedFilterCount > 0 ? (
                <span className="rounded-sm bg-muted px-1.5 text-xs text-muted-foreground">
                  {activeAdvancedFilterCount}
                </span>
              ) : null}
              <ChevronDown className={`size-4 transition-transform ${isAdvancedFilterOpen ? "rotate-180" : ""}`} />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label={t.columns} title={t.columns}>
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
                const isDisabled = isChecked && visibleColumns.length === 1;

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
        </div>

        {isAdvancedFilterOpen ? (
          <div className="mt-3 flex w-full flex-wrap items-center gap-2">
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
            label={t.createdAt}
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
          />

          {createdFilter !== "ALL" ? (
            <div className="w-[180px] [&_label]:sr-only">
              <ShadcnDatePicker
                id="notificationCreatedDate"
                label={t.createdAt}
                locale={locale}
                value={createdDate}
                onChange={(createdDate) => updateQueryParams({ createdDate, from: null, to: null, page: 1 })}
              />
            </div>
          ) : null}

          {activeAdvancedFilterCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updateQueryParams({ projectId: null, read: null, publishStatus: null, createdFilter: null, createdDate: null, from: null, to: null, page: 1 })}
            >
              {t.reset}
            </Button>
          ) : null}

          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="relative overflow-hidden">
          <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
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
                      className={`group/column relative h-12 cursor-move select-none overflow-hidden px-5 py-0 align-middle transition-colors hover:bg-muted active:cursor-move ${
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
                          className="inline-flex max-w-full min-w-0 items-center gap-1 font-semibold text-muted-foreground hover:text-foreground"
                          draggable={false}
                        >
                          <span className="truncate">{column.label}</span>
                          {isSorted ? (
                            filters.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : null}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground">{column.label}</span>
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
                  <th className="h-12 px-2 py-0 text-left align-middle" style={{ width: `${actionColumnWidth}px` }}>
                    <span className="font-semibold text-muted-foreground">{t.actions}</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {notifications.length === 0 ? (
                <tr>
                  <td
                    colSpan={(columns.length || 1) + (showActionColumn ? 1 : 0)}
                    className="px-5 py-16 text-center text-sm text-muted-foreground"
                  >
                    {t.noNotifications}
                  </td>
                </tr>
              ) : (
                notifications.map((notification) => (
                  <tr
                    key={notification.receiptId}
                    className="hover:bg-muted/40"
                  >
                    {columns.map((column) => (
                      <td key={column.id} className="overflow-hidden px-5 py-3.5 align-middle">
                        {renderCell(notification, column.id)}
                      </td>
                    ))}
                    {showActionColumn ? (
                      <td className="px-2 py-3.5 text-left align-middle" style={{ width: `${actionColumnWidth}px` }}>
                        <div className="inline-flex items-center justify-start gap-2">
                          {notification.canManage && notification.status === "SENT" ? (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => manage("revoke", notification.id)}
                              disabled={isPending}
                              className="text-black hover:bg-amber-50 hover:text-black"
                            >
                              {t.revoke}
                            </Button>
                          ) : null}
                          {notification.canDelete ? (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => manage("delete", notification.id)}
                              disabled={isPending}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 size={12} />
                              {t.delete}
                            </Button>
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="max-w-56 justify-between">
          <span className="truncate">{buttonText}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between gap-3">
          <span>{label}</span>
          {selectedValues.length > 0 ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
              {selectedValues.length}
            </span>
          ) : null}
        </DropdownMenuLabel>
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
        {selectedValues.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="w-full justify-start text-primary hover:text-primary"
            >
              {clearText}
            </Button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SingleFilter({
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
  const selectedOption = options.find((option) => option.value === value) || options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="max-w-64 justify-between">
          <span className="text-muted-foreground">{label}</span>
          <span className="truncate font-medium text-foreground">{selectedOption?.label || ""}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-56">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onChange(option.value)}
            className={option.value === value ? "bg-accent font-medium text-accent-foreground" : undefined}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
  attachments,
  isAttachmentUploading,
  onUploadAttachment,
  onRemoveAttachment,
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
