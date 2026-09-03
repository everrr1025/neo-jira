"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eye,
  EyeOff,
  KeyRound,
  ListFilter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldUser,
  Trash2,
  UserCheck,
  UserRound,
  UserX,
  X,
} from "lucide-react";

import { createAdmin, createUser, deleteUser, resetUserPassword, setUserDisabled } from "@/app/actions/admin";
import ListDateFilterMenu from "@/components/ListDateFilterMenu";
import LogNavIcon from "@/components/LogNavIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/i18n";
import type { ListDateFilter } from "@/lib/listDateFilter";
import { formatFullDateTime, formatListDateTime } from "@/lib/timeFormat";

type DepartmentOption = {
  id: string;
  name: string;
};

type UserRecord = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  lastActiveAt: string | null;
  lastLoginAt: string | null;
  disabledAt: string | null;
  departments: DepartmentOption[];
  headDepartmentsCount: number;
};

type Props = {
  currentUserId: string;
  users: UserRecord[];
  departments: DepartmentOption[];
  totalUsers: number;
  page: number;
  pageSize: number;
  search: string;
  departmentIds: string[];
  sortBy: UserSortField;
  sortDirection: SortDirection;
  activityStatus: "all" | "inactive30" | "inactive90" | "unknown";
  accountType: "user" | "admin";
  status: "all" | "active" | "disabled";
  activityDateFilter: ListDateFilter;
  activityDate: string;
  createdDateFilter: ListDateFilter;
  createdDate: string;
  locale: Locale;
};

type UserSortField = "name" | "email" | "department" | "createdAt" | "lastActiveAt";
type SortDirection = "asc" | "desc";
type UserColumnId = "name" | "email" | "status" | "department" | "activity" | "createdAt";

const USER_ACTION_COLUMN_WIDTH = 152;
const USER_COLUMN_WIDTHS: Record<UserColumnId, number> = {
  name: 200,
  email: 220,
  status: 120,
  department: 180,
  activity: 220,
  createdAt: 220,
};
const USER_COLUMN_MIN_WIDTHS: Record<UserColumnId, number> = {
  name: 150,
  email: 180,
  status: 105,
  department: 145,
  activity: 220,
  createdAt: 220,
};

const SPECIAL_CHARS = "!@#$%^&*()-_=+[]{};:,.?/|";
const PASSWORD_POOLS = ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz", "0123456789", SPECIAL_CHARS];

const TEXT = {
  en: {
    title: "Users",
    addUser: "User",
    search: "Search name or email",
    searchFilter: "Search",
    allDepartments: "All departments",
    unknownDepartment: "Unknown department",
    name: "Name",
    email: "Email",
    departments: "Departments",
    createdAt: "Created",
    lastActive: "Last active",
    lastLogin: "Last login",
    activity: "Activity",
    allActivity: "All activity",
    inactive30: "Inactive 30+ days",
    inactive90: "Inactive 90+ days",
    unknownActivity: "No activity record",
    actions: "Actions",
    viewLogs: "Logs",
    createTitle: "Create user",
    fullName: "Full name",
    password: "Password",
    passwordRule: "At least 8 chars, and include at least 3 of uppercase/lowercase/number/special.",
    create: "Create user",
    cancel: "Cancel",
    generate: "Generate",
    show: "Show password",
    hide: "Hide password",
    resetPassword: "Reset",
    delete: "Delete",
    deleteWarning: "Delete this user? Assigned issues will become unassigned, and comments/attachments will be reassigned to you.",
    cannotDeleteHead: "Department admin. Remove the admin role before deleting.",
    noUsers: "No users match the current filters.",
    showing: "Showing",
    to: "to",
    of: "of",
    users: "users",
    perPage: "Per page",
    page: "Page",
    createFailed: "Failed to create user",
    emailPasswordRequired: "Email and password are required.",
    invalidPassword: "Password does not meet the security requirements.",
    emailInUse: "Email is already in use.",
    adminRequired: "Administrator access is required. Please sign in again.",
    deleteFailed: "Failed to delete user",
    resetFailed: "Failed to reset password",
    sortAscending: "Sort ascending",
    sortDescending: "Sort descending",
    removeFilter: "Remove filter",
    all: "All", dateEquals: "Equals", dateOnOrAfter: "On or after", dateOnOrBefore: "On or before",
    normalUsers: "Users", systemAdmins: "System administrators", statusLabel: "Status", allStatuses: "All statuses", active: "Active", disabled: "Disabled",
    createAdminTitle: "Create administrator", createAdmin: "Create administrator", temporaryPassword: "Temporary password", temporaryPasswordHint: "Save this password now. The administrator must change it after signing in.",
    disable: "Disable", restore: "Restore", disableFailed: "Failed to update account status", mustDisableBeforeDelete: "Disable this account before deleting it.",
    deleteConfirmation: "Enter the account email to confirm permanent deletion", confirmationMismatch: "The confirmation email does not match.", selfProtected: "You cannot perform this action on your own account.", lastAdminProtected: "At least one active administrator must remain.",
  },
  zh: {
    title: "用户",
    addUser: "用户",
    search: "搜索姓名或邮箱",
    searchFilter: "搜索",
    allDepartments: "全部部门",
    unknownDepartment: "未知部门",
    name: "姓名",
    email: "邮箱",
    departments: "部门",
    createdAt: "创建时间",
    lastActive: "最后活跃",
    lastLogin: "最后登录",
    activity: "活跃状态",
    allActivity: "全部活跃状态",
    inactive30: "超过 30 天未活跃",
    inactive90: "超过 90 天未活跃",
    unknownActivity: "暂无活动记录",
    actions: "操作",
    viewLogs: "日志",
    createTitle: "创建用户",
    fullName: "姓名",
    password: "密码",
    passwordRule: "至少 8 位，并包含大写/小写/数字/特殊字符中的至少 3 项。",
    create: "创建用户",
    cancel: "取消",
    generate: "重新生成",
    show: "显示密码",
    hide: "隐藏密码",
    resetPassword: "重置",
    delete: "删除",
    deleteWarning: "确定删除该用户吗？经办的问题会变为未分配，评论和附件会转交给你。",
    cannotDeleteHead: "部门管理员，需先取消管理员身份后才能删除。",
    noUsers: "当前筛选下没有用户。",
    showing: "显示",
    to: "到",
    of: "共",
    users: "个用户",
    perPage: "每页",
    page: "第",
    createFailed: "创建用户失败",
    emailPasswordRequired: "邮箱和密码不能为空。",
    invalidPassword: "密码不符合安全要求。",
    emailInUse: "该邮箱已被使用。",
    adminRequired: "需要管理员权限，请重新登录后再试。",
    deleteFailed: "删除用户失败",
    resetFailed: "重置密码失败",
    sortAscending: "升序排列",
    sortDescending: "降序排列",
    removeFilter: "取消筛选",
    all: "全部", dateEquals: "等于", dateOnOrAfter: "晚于或等于", dateOnOrBefore: "早于或等于",
    normalUsers: "普通用户", systemAdmins: "系统管理员", statusLabel: "状态", allStatuses: "全部状态", active: "启用", disabled: "已停用",
    createAdminTitle: "创建系统管理员", createAdmin: "创建管理员", temporaryPassword: "临时密码", temporaryPasswordHint: "请立即保存该密码。管理员首次登录后必须修改密码。",
    disable: "停用", restore: "恢复", disableFailed: "更新账号状态失败", mustDisableBeforeDelete: "请先停用该账号，再执行永久删除。",
    deleteConfirmation: "请输入该账号邮箱以确认永久删除", confirmationMismatch: "确认邮箱不匹配。", selfProtected: "不能对当前登录账号执行此操作。", lastAdminProtected: "系统至少需要保留一个启用状态的管理员。",
  },
} as const;

function pickChar(pool: string) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function shuffle(text: string) {
  const arr = text.split("");
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

function generateDefaultPassword(length = 12) {
  let password = PASSWORD_POOLS.slice(0, 3).map((pool) => pickChar(pool)).join("");
  const all = PASSWORD_POOLS.join("");
  while (password.length < Math.max(8, length)) {
    password += pickChar(all);
  }
  return shuffle(password);
}

function getDisplayName(user: UserRecord) {
  return user.name || user.email;
}

export default function AdminUsersClient({
  currentUserId,
  users,
  departments,
  totalUsers,
  page,
  pageSize,
  search,
  departmentIds,
  sortBy,
  sortDirection,
  activityStatus,
  accountType,
  status,
  activityDateFilter,
  activityDate,
  createdDateFilter,
  createdDate,
  locale,
}: Props) {
  const t = TEXT[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");
  const [query, setQuery] = useState(search);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [createdAdminPassword, setCreatedAdminPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [statusChangingUserId, setStatusChangingUserId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState(USER_COLUMN_WIDTHS);
  const resizingRef = useRef<{ index: number; nextIndex: number | null; startX: number; startWidth: number; nextWidth: number | null } | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
  });

  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const rangeStart = totalUsers > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, totalUsers);
  const departmentNamesById = new Map(departments.map((department) => [department.id, department.name]));
  const selectedDepartmentNames = departmentIds.map((departmentId) => departmentNamesById.get(departmentId) || t.unknownDepartment);
  const activityStatusLabel = {
    all: t.allActivity,
    inactive30: t.inactive30,
    inactive90: t.inactive90,
    unknown: t.unknownActivity,
  }[activityStatus];
  const pageSizeOptions = [10, 20, 50].map((size) => ({ value: String(size), label: String(size) }));
  const statusOptions = [
    { value: "all", label: t.allStatuses },
    { value: "active", label: t.active },
    { value: "disabled", label: t.disabled },
  ];
  const userColumnIds: UserColumnId[] = accountType === "admin"
    ? ["name", "email", "status", "activity", "createdAt"]
    : ["name", "email", "status", "department", "activity", "createdAt"];
  const displayedColumnWidths = userColumnIds.map((id) => Math.max(columnWidths[id], USER_COLUMN_MIN_WIDTHS[id]));
  const tableMinWidth = displayedColumnWidths.reduce((total, width) => total + width, USER_ACTION_COLUMN_WIDTH);

  useEffect(() => {
    setQuery(search);
  }, [search]);

  useEffect(() => {
    const nextSearch = query.trim();
    if (nextSearch === search) return;

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (nextSearch) params.set("search", nextSearch);
      if (departmentIds.length > 0) params.set("departmentIds", departmentIds.join(","));
      if (activityStatus !== "all") params.set("activityStatus", activityStatus);
      if (accountType === "admin") params.set("accountType", "admin");
      if (status !== "all") params.set("status", status);
      if (activityDateFilter !== "ALL") params.set("activityDateFilter", activityDateFilter);
      if (activityDate) params.set("activityDate", activityDate);
      if (createdDateFilter !== "ALL") params.set("createdDateFilter", createdDateFilter);
      if (createdDate) params.set("createdDate", createdDate);
      params.set("sortBy", sortBy);
      params.set("sortDirection", sortDirection);
      params.set("page", "1");
      params.set("pageSize", String(pageSize));
      router.replace(`/admin/users?${params.toString()}`);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [accountType, activityDate, activityDateFilter, activityStatus, createdDate, createdDateFilter, departmentIds, pageSize, query, router, search, sortBy, sortDirection, status]);

  const updateParams = (next: Record<string, string | null>) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (departmentIds.length > 0) params.set("departmentIds", departmentIds.join(","));
    if (activityStatus !== "all") params.set("activityStatus", activityStatus);
    if (accountType === "admin") params.set("accountType", "admin");
    if (status !== "all") params.set("status", status);
    if (activityDateFilter !== "ALL") params.set("activityDateFilter", activityDateFilter);
    if (activityDate) params.set("activityDate", activityDate);
    if (createdDateFilter !== "ALL") params.set("createdDateFilter", createdDateFilter);
    if (createdDate) params.set("createdDate", createdDate);
    params.set("sortBy", sortBy);
    params.set("sortDirection", sortDirection);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    router.push(`/admin/users?${params.toString()}`);
  };

  const updateDepartmentFilter = (departmentId: string, checked: boolean) => {
    const nextDepartmentIds = checked
      ? [...departmentIds, departmentId]
      : departmentIds.filter((id) => id !== departmentId);
    updateParams({
      departmentIds: nextDepartmentIds.length > 0 ? nextDepartmentIds.join(",") : null,
      departmentId: null,
      page: "1",
    });
  };
  const filterSummary = [
    ...(search ? [{ key: "search", label: t.searchFilter, value: search, clear: () => {
      setQuery("");
      updateParams({ search: null, page: "1" });
    } }] : []),
    ...(departmentIds.length > 0 ? [{ key: "departmentIds", label: t.departments, value: selectedDepartmentNames.join(locale === "zh" ? "、" : ", "), clear: () => updateParams({ departmentIds: null, departmentId: null, page: "1" }) }] : []),
    ...(activityStatus !== "all" ? [{ key: "activityStatus", label: t.activity, value: activityStatusLabel, clear: () => updateParams({ activityStatus: null, page: "1" }) }] : []),
    ...(status !== "all" ? [{ key: "status", label: t.statusLabel, value: status === "active" ? t.active : t.disabled, clear: () => updateParams({ status: null, page: "1" }) }] : []),
    ...(activityDateFilter !== "ALL" && activityDate ? [{
      key: "activityDate",
      label: accountType === "admin" ? t.lastLogin : t.lastActive,
      value: [{ EQ: t.dateEquals, GTE: t.dateOnOrAfter, LTE: t.dateOnOrBefore }[activityDateFilter], activityDate].filter(Boolean).join(locale === "zh" ? "：" : ": "),
      clear: () => updateParams({ activityDateFilter: null, activityDate: null, page: "1" }),
    }] : []),
    ...(createdDateFilter !== "ALL" && createdDate ? [{
      key: "createdDate",
      label: t.createdAt,
      value: [{ EQ: t.dateEquals, GTE: t.dateOnOrAfter, LTE: t.dateOnOrBefore }[createdDateFilter], createdDate].filter(Boolean).join(locale === "zh" ? "：" : ": "),
      clear: () => updateParams({ createdDateFilter: null, createdDate: null, page: "1" }),
    }] : []),
  ];

  const translateCreateUserError = (message: string | undefined) => {
    if (!message) return t.createFailed;
    if (message.includes("Email and password are required")) return t.emailPasswordRequired;
    if (message.includes("Password must be at least")) return t.invalidPassword;
    if (message.includes("Email is already in use") || message.includes("Unique constraint failed")) {
      return t.emailInUse;
    }
    if (message.includes("Unauthorized")) return t.adminRequired;
    if (message === "ADMIN_NAME_EMAIL_REQUIRED") return t.emailPasswordRequired;
    if (message === "EMAIL_IN_USE") return t.emailInUse;
    return locale === "zh" ? t.createFailed : message;
  };

  const renderSortableHeader = (label: string, field: UserSortField) => {
    const isSorted = sortBy === field;
    const nextDirection: SortDirection = isSorted
      ? sortDirection === "asc" ? "desc" : "asc"
      : field === "createdAt" || field === "lastActiveAt" ? "desc" : "asc";

    return (
      <button
        type="button"
        onClick={() => updateParams({ sortBy: field, sortDirection: nextDirection, page: "1" })}
        className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
        aria-label={`${label}: ${nextDirection === "asc" ? t.sortAscending : t.sortDescending}`}
        title={`${label}: ${nextDirection === "asc" ? t.sortAscending : t.sortDescending}`}
      >
        <span>{label}</span>
        {isSorted ? sortDirection === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
      </button>
    );
  };

  const renderFilterTrigger = (active: boolean, label: string, value: string) => (
    <Button
      type="button"
      variant={active ? "outline" : "ghost"}
      size={active ? "sm" : "icon-xs"}
      className={active
        ? "h-5 max-w-24 bg-background px-1.5 text-xs font-normal"
        : "text-muted-foreground"}
      aria-label={label}
      title={label}
    >
      {active ? <span className="truncate">{value}</span> : <ListFilter />}
    </Button>
  );

  const handleColumnResizeStart = (event: React.MouseEvent, index: number, independently = false) => {
    event.preventDefault();
    event.stopPropagation();
    const columnId = userColumnIds[index];
    const nextColumnId = independently ? undefined : userColumnIds[index + 1];
    if (!columnId) return;
    resizingRef.current = {
      index,
      nextIndex: nextColumnId ? index + 1 : null,
      startX: event.clientX,
      startWidth: displayedColumnWidths[index],
      nextWidth: nextColumnId ? displayedColumnWidths[index + 1] : null,
    };

    const handleMove = (moveEvent: MouseEvent) => {
      const current = resizingRef.current;
      if (!current) return;
      const currentId = userColumnIds[current.index];
      if (!currentId) return;
      const delta = moveEvent.clientX - current.startX;
      if (current.nextIndex === null || current.nextWidth === null) {
        setColumnWidths((widths) => ({ ...widths, [currentId]: Math.max(USER_COLUMN_MIN_WIDTHS[currentId], current.startWidth + delta) }));
        return;
      }
      const nextId = userColumnIds[current.nextIndex];
      if (!nextId) return;
      const boundedDelta = Math.min(
        current.nextWidth - USER_COLUMN_MIN_WIDTHS[nextId],
        Math.max(USER_COLUMN_MIN_WIDTHS[currentId] - current.startWidth, delta),
      );
      setColumnWidths((widths) => ({
        ...widths,
        [currentId]: current.startWidth + boundedDelta,
        [nextId]: current.nextWidth! - boundedDelta,
      }));
    };
    const handleUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  const resizeHandle = (index: number, side: "left" | "right" = "right", independently = false) => (
    <div
      className={`absolute bottom-0 top-0 z-30 w-4 cursor-ew-resize ${side === "left" ? "left-0" : "right-0"}`}
      onMouseDown={(event) => handleColumnResizeStart(event, index, independently)}
      title={locale === "zh" ? "拖拽调整列宽" : "Drag to resize column"}
    />
  );

  const renderResizableHeader = (columnId: UserColumnId, content: React.ReactNode, className = "") => {
    const index = userColumnIds.indexOf(columnId);
    return (
      <TableHead className={`relative overflow-hidden ${className}`} style={{ width: displayedColumnWidths[index] }}>
        {content}
        {resizeHandle(index)}
      </TableHead>
    );
  };

  const closeCreateDialog = () => {
    setErrorMsg("");
    setCreatedAdminPassword("");
    setNewUser({ name: "", email: "", password: "" });
    setIsCreateOpen(false);
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg("");
    startTransition(async () => {
      const res = accountType === "admin"
        ? await createAdmin({ name: newUser.name, email: newUser.email })
        : await createUser(newUser);
      if (!res.success) {
        setErrorMsg(translateCreateUserError(res.error));
        return;
      }

      if (accountType === "admin" && "password" in res && res.password) {
        setCreatedAdminPassword(res.password);
        router.refresh();
        return;
      }
      setNewUser({ name: "", email: "", password: "" });
      setShowPassword(true);
      setIsCreateOpen(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!deletingUser) return;
    setErrorMsg("");
    startTransition(async () => {
      const res = await deleteUser(deletingUser.id, deleteConfirmation);
      if (!res.success) {
        setErrorMsg(translateAccountError(res.error) || t.deleteFailed);
        return;
      }
      setDeletingUser(null);
      setDeleteConfirmation("");
      router.refresh();
    });
  };

  const handleResetPassword = (userId: string) => {
    setErrorMsg("");
    setResettingUserId(userId);
    startResetTransition(async () => {
      const res = await resetUserPassword(userId);
      if (res.success && res.password) {
        setRevealedPasswords((current) => ({ ...current, [userId]: res.password }));
      } else {
        setErrorMsg(translateAccountError(res.error) || t.resetFailed);
      }
      setResettingUserId(null);
    });
  };

  const translateAccountError = (error?: string) => {
    if (error === "ACCOUNT_MUST_BE_DISABLED") return t.mustDisableBeforeDelete;
    if (error === "DELETE_CONFIRMATION_MISMATCH") return t.confirmationMismatch;
    if (error === "CANNOT_CHANGE_OWN_STATUS" || error === "CANNOT_RESET_OWN_PASSWORD" || error?.includes("own account")) return t.selfProtected;
    if (error === "LAST_ACTIVE_ADMIN") return t.lastAdminProtected;
    if (error?.startsWith("DEPARTMENT_ADMIN:")) return t.cannotDeleteHead;
    return error || t.disableFailed;
  };

  const handleAccountStatus = (user: UserRecord) => {
    setErrorMsg("");
    setStatusChangingUserId(user.id);
    startTransition(async () => {
      const res = await setUserDisabled({ userId: user.id, disabled: !user.disabledAt });
      if (!res.success) setErrorMsg(translateAccountError(res.error));
      setStatusChangingUserId(null);
      router.refresh();
    });
  };

  const switchAccountType = (nextType: "user" | "admin") => {
    const params = new URLSearchParams();
    if (nextType === "admin") params.set("accountType", "admin");
    params.set("page", "1");
    params.set("pageSize", String(pageSize));
    router.push(`/admin/users?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>
          <Button
            type="button"
            size="icon-sm"
            variant={accountType === "admin" ? "secondary" : "ghost"}
            aria-label={accountType === "admin" ? t.systemAdmins : t.normalUsers}
            title={accountType === "admin" ? t.systemAdmins : t.normalUsers}
            aria-pressed={accountType === "admin"}
            onClick={() => switchAccountType(accountType === "admin" ? "user" : "admin")}
          >
            {accountType === "admin" ? <ShieldUser /> : <UserRound />}
          </Button>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.search}
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            onClick={() => {
              setErrorMsg("");
              setShowPassword(true);
              setIsCreateOpen(true);
            }}
          >
            <Plus />
            {accountType === "admin" ? t.createAdmin : t.addUser}
          </Button>
        </div>
      </div>

      {errorMsg && !isCreateOpen && !deletingUser ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {errorMsg}
        </div>
      ) : null}

      {filterSummary.length > 0 ? <div className="flex flex-wrap gap-2 text-sm">
        {filterSummary.map((filter) => (
          <div key={filter.key} className="inline-flex max-w-full items-start rounded-md border bg-background text-foreground shadow-xs">
            <span className="min-w-0 break-words px-2.5 py-1">
              <span className="text-muted-foreground">{filter.label}：</span>{filter.value}
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
      </div> : null}

      <Card className="gap-0 overflow-hidden py-0">
          <Table className="table-fixed" style={{ minWidth: tableMinWidth }}>
            <colgroup>
              {userColumnIds.map((columnId, index) => <col key={columnId} style={{ width: displayedColumnWidths[index] }} />)}
              <col style={{ width: USER_ACTION_COLUMN_WIDTH }} />
            </colgroup>
            <TableHeader className="sticky top-0 z-10 bg-muted/50">
              <TableRow className="hover:bg-muted/50">
                {renderResizableHeader("name", renderSortableHeader(t.name, "name"), "pl-6")}
                {renderResizableHeader("email", renderSortableHeader(t.email, "email"))}
                {renderResizableHeader("status", (
                  <div className="flex items-center gap-1">
                    <span>{t.statusLabel}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        {renderFilterTrigger(
                          status !== "all",
                          `${t.statusLabel}: ${status === "active" ? t.active : status === "disabled" ? t.disabled : t.allStatuses}`,
                          status === "active" ? t.active : t.disabled,
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-40">
                        <DropdownMenuRadioGroup
                          value={status}
                          onValueChange={(value) => updateParams({ status: value === "all" ? null : value, page: "1" })}
                        >
                          <DropdownMenuRadioItem value={statusOptions[0].value}>{t.all}</DropdownMenuRadioItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuRadioItem value={statusOptions[1].value}>{statusOptions[1].label}</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value={statusOptions[2].value}>{statusOptions[2].label}</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                {accountType === "user" ? renderResizableHeader("department", (
                  <div className="flex items-center gap-1">
                    {renderSortableHeader(t.departments, "department")}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        {renderFilterTrigger(
                          departmentIds.length > 0,
                          `${t.departments}: ${selectedDepartmentNames.join(", ") || t.allDepartments}`,
                          String(departmentIds.length),
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-52">
                        <DropdownMenuCheckboxItem
                          checked={departmentIds.length === 0}
                          onCheckedChange={() =>
                            updateParams({ departmentIds: null, departmentId: null, page: "1" })
                          }
                          onSelect={(event) => event.preventDefault()}
                        >
                          {t.all}
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        {departments.map((department) => (
                          <DropdownMenuCheckboxItem
                            key={department.id}
                            checked={departmentIds.includes(department.id)}
                            onCheckedChange={(checked) => updateDepartmentFilter(department.id, checked === true)}
                            onSelect={(event) => event.preventDefault()}
                          >
                            {department.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )) : null}
                {renderResizableHeader("activity", (
                  <div className="flex items-center gap-1">
                    {accountType === "admin" ? <span>{t.lastLogin}</span> : renderSortableHeader(t.lastActive, "lastActiveAt")}
                    <ListDateFilterMenu
                      label={accountType === "admin" ? t.lastLogin : t.lastActive}
                      value={activityDateFilter}
                      date={activityDate}
                      locale={locale}
                      labels={{ all: t.all, equals: t.dateEquals, onOrAfter: t.dateOnOrAfter, onOrBefore: t.dateOnOrBefore }}
                      onChange={(value, date) => updateParams({
                        activityDateFilter: value === "ALL" ? null : value,
                        activityDate: date || null,
                        page: "1",
                      })}
                    />
                  </div>
                ))}
                {renderResizableHeader("createdAt", (
                  <div className="flex items-center gap-1">
                    {renderSortableHeader(t.createdAt, "createdAt")}
                    <ListDateFilterMenu
                      label={t.createdAt}
                      value={createdDateFilter}
                      date={createdDate}
                      locale={locale}
                      labels={{ all: t.all, equals: t.dateEquals, onOrAfter: t.dateOnOrAfter, onOrBefore: t.dateOnOrBefore }}
                      onChange={(value, date) => updateParams({
                        createdDateFilter: value === "ALL" ? null : value,
                        createdDate: date || null,
                        page: "1",
                      })}
                    />
                  </div>
                ))}
                <TableHead
                  className="sticky right-0 z-20 overflow-hidden bg-muted/50 px-4 text-left whitespace-nowrap shadow-[-6px_0_8px_-8px_rgba(15,23,42,0.45)] hover:bg-muted"
                  style={{ width: USER_ACTION_COLUMN_WIDTH, minWidth: USER_ACTION_COLUMN_WIDTH }}
                >
                  {resizeHandle(userColumnIds.length - 1, "left", true)}
                  <div className="ml-auto text-left" style={{ width: USER_ACTION_COLUMN_WIDTH - 32 }}>{t.actions}</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isHead = user.headDepartmentsCount > 0;
                const isCurrentUser = user.id === currentUserId;
                const disableDelete = !user.disabledAt || isHead || isCurrentUser || isPending;
                const isResettingThisUser = isResetting && resettingUserId === user.id;
                const activityDate = accountType === "admin" ? user.lastLoginAt : user.lastActiveAt;
                const lastActiveText = activityDate ? formatListDateTime(activityDate) : "";
                const deleteButton = (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    disabled={disableDelete}
                    onClick={() => {
                      setErrorMsg("");
                      setDeleteConfirmation("");
                      setDeletingUser(user);
                    }}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t.delete}
                    title={!user.disabledAt ? t.mustDisableBeforeDelete : isHead ? t.cannotDeleteHead : t.delete}
                  >
                    <Trash2 />
                  </Button>
                );

                return (
                  <TableRow key={user.id} className="group hover:bg-muted/40">
                    <TableCell className="overflow-hidden pl-6">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                          {getDisplayName(user).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                            <span className="min-w-0 truncate" title={getDisplayName(user)}>{getDisplayName(user)}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="overflow-hidden text-muted-foreground">
                      <span className="block truncate" title={user.email}>{user.email}</span>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <Badge variant={user.disabledAt ? "outline" : "secondary"}>{user.disabledAt ? t.disabled : t.active}</Badge>
                    </TableCell>
                    {accountType === "user" ? <TableCell className="overflow-hidden">
                      {user.departments.length > 0 ? (
                        <div className="flex min-w-0 gap-1.5 overflow-hidden">
                          {user.departments.map((department) => (
                            <Badge key={department.id} variant="outline" className="min-w-0 max-w-[160px]">
                              <span className="truncate" title={department.name}>{department.name}</span>
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </TableCell> : null}
                    <TableCell className="overflow-hidden text-xs font-medium text-muted-foreground">
                      <span className="block truncate" title={activityDate ? formatFullDateTime(activityDate, locale) : undefined}>
                        {lastActiveText}
                      </span>
                    </TableCell>
                    <TableCell className="overflow-hidden text-xs font-medium text-muted-foreground">
                      <span className="block truncate" title={formatFullDateTime(user.createdAt, locale)}>
                        {formatListDateTime(user.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell
                      className="sticky right-0 z-10 overflow-hidden bg-card px-4 text-right whitespace-nowrap shadow-[-6px_0_8px_-8px_rgba(15,23,42,0.45)] group-hover:bg-muted/40"
                      style={{ width: USER_ACTION_COLUMN_WIDTH, minWidth: USER_ACTION_COLUMN_WIDTH }}
                    >
                      <div className="flex min-w-0 flex-col items-end gap-1 text-left">
                        <div className="inline-flex items-center gap-2">
                          <Button asChild variant="outline" size="icon-xs">
                            <Link
                              href={`/admin/logs?range=all&targetType=USER&targetId=${encodeURIComponent(user.id)}`}
                              aria-label={t.viewLogs}
                              title={t.viewLogs}
                            >
                              <LogNavIcon className="size-3" />
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            disabled={isResettingThisUser || isCurrentUser}
                            onClick={() => handleResetPassword(user.id)}
                            aria-label={t.resetPassword}
                            title={t.resetPassword}
                          >
                            {isResettingThisUser ? <Loader2 className="animate-spin" /> : <KeyRound />}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            disabled={isPending || isCurrentUser}
                            onClick={() => handleAccountStatus(user)}
                            aria-label={user.disabledAt ? t.restore : t.disable}
                            title={isCurrentUser ? t.selfProtected : user.disabledAt ? t.restore : t.disable}
                          >
                            {statusChangingUserId === user.id ? <Loader2 className="animate-spin" /> : user.disabledAt ? <UserCheck /> : <UserX />}
                          </Button>
                          {isHead ? (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex" tabIndex={0}>{deleteButton}</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={6} className="max-w-xs">
                                  {t.cannotDeleteHead}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : deleteButton}
                        </div>
                        {revealedPasswords[user.id] ? (
                          <div className="w-full min-w-0 truncate rounded-md border bg-muted/50 px-2 py-1 font-mono text-xs text-foreground">
                            {revealedPasswords[user.id]}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={userColumnIds.length + 1} className="h-40 text-center text-muted-foreground">{t.noUsers}</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3 text-sm">
          <div className="font-medium text-muted-foreground">
            {t.showing} <span className="font-bold text-foreground">{rangeStart}</span> {t.to}{" "}
            <span className="font-bold text-foreground">{rangeEnd}</span> {t.of}{" "}
            <span className="font-bold text-foreground">{totalUsers}</span> {t.users}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{t.perPage}</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => updateParams({ pageSize: value, page: "1" })}
              >
                <SelectTrigger size="sm" className="w-20 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {pageSizeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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
                onClick={() => updateParams({ page: String(Math.max(1, page - 1)) })}
                disabled={page === 1}
              >
                <ArrowLeft size={18} />
              </Button>
              <span className="min-w-24 px-2 text-center font-medium leading-none text-foreground">
                {locale === "zh" ? `${t.page} ${page} / ${totalPages}` : `${t.page} ${page} of ${totalPages}`}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => updateParams({ page: String(Math.min(totalPages, page + 1)) })}
                disabled={page >= totalPages}
              >
                <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (isPending) return;
          if (open) {
            setIsCreateOpen(true);
          } else {
            closeCreateDialog();
          }
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-muted/35 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{accountType === "admin" ? t.createAdminTitle : t.createTitle}</DialogTitle>
              <DialogDescription className="sr-only">{accountType === "admin" ? t.createAdminTitle : t.createTitle}</DialogDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closeCreateDialog}
                disabled={isPending}
                aria-label={t.cancel}
              >
                <X />
              </Button>
            </div>
          </DialogHeader>
          <form onSubmit={handleCreate} autoComplete="off">
            <div className="space-y-5 p-6">
              {errorMsg ? (
                <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  {errorMsg}
                </div>
              ) : null}
              {createdAdminPassword ? (
                <div className="space-y-2 rounded-md border bg-muted/40 p-4">
                  <Label>{t.temporaryPassword}</Label>
                  <div className="select-all break-all rounded-md bg-background p-3 font-mono text-sm">{createdAdminPassword}</div>
                  <p className="text-xs text-muted-foreground">{t.temporaryPasswordHint}</p>
                </div>
              ) : <>
                <div className="space-y-2">
                  <Label htmlFor="new-user-name">{t.fullName}</Label>
                  <Input id="new-user-name" name="new-user-name" required autoComplete="off" value={newUser.name} onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))} placeholder="Jane Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-user-email">{t.email}</Label>
                  <Input id="new-user-email" name="new-user-email" required type="email" autoComplete="off" value={newUser.email} onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} placeholder="jane@neo-jira.local" />
                </div>
                {accountType === "user" ? <div className="space-y-2">
                  <Label htmlFor="new-user-password">{t.password}</Label>
                  <div className="flex gap-2">
                    <Input id="new-user-password" name="new-user-password" required minLength={8} type={showPassword ? "text" : "password"} autoComplete="off" value={newUser.password} onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))} />
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowPassword((value) => !value)} title={showPassword ? t.hide : t.show}>{showPassword ? <EyeOff /> : <Eye />}</Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => setNewUser((current) => ({ ...current, password: generateDefaultPassword() }))} title={t.generate}><RefreshCw /></Button>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{t.passwordRule}</p>
                </div> : null}
              </>}
            </div>
            <DialogFooter className="border-t bg-muted/35 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeCreateDialog}
                disabled={isPending}
              >
                {t.cancel}
              </Button>
              {!createdAdminPassword ? <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : null}
                {accountType === "admin" ? t.createAdmin : t.create}
              </Button> : null}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setErrorMsg("");
            setDeleteConfirmation("");
            setDeletingUser(null);
          }
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-destructive/5 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" />
                {t.delete}
              </DialogTitle>
              <DialogDescription className="sr-only">{t.deleteWarning}</DialogDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setErrorMsg("");
                  setDeleteConfirmation("");
                  setDeletingUser(null);
                }}
                disabled={isPending}
                aria-label={t.cancel}
              >
                <X />
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4 p-6">
            <p className="text-sm text-muted-foreground">{t.deleteWarning}</p>
            {errorMsg ? (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                {errorMsg}
              </div>
            ) : null}
            {deletingUser ? (
              <>
                <div className="rounded-md border bg-muted/40 p-3 text-sm font-medium">
                  {getDisplayName(deletingUser)} <span className="font-normal text-muted-foreground">({deletingUser.email})</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delete-user-confirmation">{t.deleteConfirmation}</Label>
                  <Input id="delete-user-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" placeholder={deletingUser.email} />
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter className="border-t bg-muted/35 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setErrorMsg("");
                setDeleteConfirmation("");
                setDeletingUser(null);
              }}
              disabled={isPending || deleteConfirmation.trim().toLowerCase() !== deletingUser?.email.toLowerCase()}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
            >
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {t.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
