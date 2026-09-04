"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { createDepartment, deleteDepartment, updateDepartment } from "@/app/actions/departments";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/lib/i18n";
import type { ListDateFilter } from "@/lib/listDateFilter";
import {
  DISPLAY_LIST_COLUMN_MIN_WIDTH,
  getListActionColumnWidth,
  LIST_ACTION_BUTTON_GAP,
  LIST_ACTION_COLUMN_PADDING_X,
} from "@/lib/listColumnSizing";
import { formatFullDateTime, formatListDate, formatListDateTime } from "@/lib/timeFormat";

type DepartmentMemberRecord = {
  userId: string;
  role: string;
  isDepartmentAdmin: boolean;
  userEmail: string;
  userName: string | null;
  disabledAt: string | null;
};

export type DepartmentRecord = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  members: DepartmentMemberRecord[];
  projectsCount: number;
  createdAt: string;
};

type Props = {
  departments: DepartmentRecord[];
  locale: Locale;
};

type DepartmentSortField = "name" | "head" | "members" | "projects" | "createdAt";
type SortDirection = "asc" | "desc";
type DepartmentColumnId = DepartmentSortField;

const DEPARTMENT_ACTION_BUTTON_COUNT = 4;
const DEPARTMENT_ACTION_COLUMN_WIDTH = getListActionColumnWidth(DEPARTMENT_ACTION_BUTTON_COUNT);
const DEPARTMENT_COLUMN_IDS: DepartmentColumnId[] = ["name", "head", "members", "projects", "createdAt"];
const DEPARTMENT_COLUMN_WIDTHS: Record<DepartmentColumnId, number> = {
  name: 240,
  head: 190,
  members: 130,
  projects: 130,
  createdAt: 220,
};
const TEXT = {
  en: {
    title: "Departments",
    createDepartment: "Department",
    search: "Search department name or key",
    createTitle: "Create department",
    editTitle: "Edit department",
    name: "Department",
    key: "Key",
    description: "Description",
    descPlaceholder: "Optional details...",
    head: "Department admin",
    members: "Members",
    projects: "Projects",
    createdAt: "Created",
    actions: "Actions",
    viewLogs: "Logs",
    manage: "Members",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    create: "Create department",
    save: "Save changes",
    empty: "No departments created yet.",
    noResults: "No departments match the current search.",
    memberCount: "members",
    projectCount: "projects",
    showing: "Showing",
    to: "to",
    of: "of",
    departmentCount: "departments",
    perPage: "Per page",
    page: "Page",
    deleteWarning: "Delete this department? Members will be removed and linked projects will be cleared.",
    typeToConfirm: "Please type the exact department name to confirm:",
    createFailed: "Failed to create department",
    updateFailed: "Failed to update department",
    deleteFailed: "Failed to delete department",
    confirmNameMismatch: "Department name confirmation does not match.",
    required: "Department name and key are required.",
    keyExists: "Department key already exists.",
    nameExists: "Department name already exists.",
    notFound: "Department not found.",
    headConflict: "Selected head already belongs to another department.",
    disabled: "Disabled",
    sortAscending: "Sort ascending",
    sortDescending: "Sort descending",
    removeFilter: "Remove filter", all: "All", dateEquals: "Equals", dateOnOrAfter: "On or after", dateOnOrBefore: "On or before",
  },
  zh: {
    title: "部门",
    createDepartment: "部门",
    search: "搜索部门名称或标识",
    createTitle: "创建部门",
    editTitle: "编辑部门",
    name: "部门",
    key: "标识",
    description: "描述",
    descPlaceholder: "可选说明...",
    head: "部门管理员",
    members: "成员",
    projects: "项目",
    createdAt: "创建时间",
    actions: "操作",
    viewLogs: "日志",
    manage: "成员",
    edit: "编辑",
    delete: "删除",
    cancel: "取消",
    create: "创建部门",
    save: "保存修改",
    empty: "暂无部门。",
    noResults: "没有符合当前搜索条件的部门。",
    memberCount: "名成员",
    projectCount: "个项目",
    showing: "显示",
    to: "到",
    of: "共",
    departmentCount: "个部门",
    perPage: "每页",
    page: "第",
    deleteWarning: "确定删除该部门吗？部门成员会被移除，关联项目会取消部门归属。",
    typeToConfirm: "请输入准确的部门名称以确认删除：",
    createFailed: "创建部门失败",
    updateFailed: "更新部门失败",
    deleteFailed: "删除部门失败",
    confirmNameMismatch: "输入的部门名称不正确。",
    required: "部门名称和标识不能为空。",
    keyExists: "部门标识已存在。",
    nameExists: "部门名称已存在。",
    notFound: "部门不存在。",
    headConflict: "所选负责人已属于其他部门。",
    disabled: "已停用",
    sortAscending: "升序排列",
    sortDescending: "降序排列",
    removeFilter: "取消筛选", all: "全部", dateEquals: "等于", dateOnOrAfter: "晚于或等于", dateOnOrBefore: "早于或等于",
  },
} as const;

function displayMember(member: DepartmentMemberRecord) {
  return member.userName || member.userEmail;
}

export default function AdminDepartmentsView({ departments, locale }: Props) {
  const t = TEXT[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [listErrorMsg, setListErrorMsg] = useState("");
  const [formErrorMsg, setFormErrorMsg] = useState("");
  const [deleteErrorMsg, setDeleteErrorMsg] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentRecord | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<DepartmentRecord | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [search, setSearch] = useState("");
  const [createdDateFilter, setCreatedDateFilter] = useState<ListDateFilter>("ALL");
  const [createdDate, setCreatedDate] = useState("");
  const [columnWidths, setColumnWidths] = useState(DEPARTMENT_COLUMN_WIDTHS);
  const resizingRef = useRef<{
    index: number;
    startX: number;
    startWidth: number;
    scrollContainer: HTMLElement | null;
    startScrollLeft: number;
  } | null>(null);
  const [sortBy, setSortBy] = useState<DepartmentSortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [departmentPage, setDepartmentPage] = useState(1);
  const [departmentPageSize, setDepartmentPageSize] = useState(10);
  const [departmentForm, setDepartmentForm] = useState({ name: "", key: "", description: "" });
  const normalizedSearch = search.trim().toLowerCase();
  const filteredDepartments = departments.filter((department) => {
    if (normalizedSearch && !`${department.name} ${department.key}`.toLowerCase().includes(normalizedSearch)) return false;
    if (createdDateFilter === "ALL" || !createdDate) return true;
    const value = formatListDate(department.createdAt);
    if (createdDateFilter === "EQ") return value === createdDate;
    if (createdDateFilter === "GTE") return value >= createdDate;
    return value <= createdDate;
  });
  const sortedDepartments = [...filteredDepartments].sort((left, right) => {
    const leftHead = left.members.find((member) => member.isDepartmentAdmin);
    const rightHead = right.members.find((member) => member.isDepartmentAdmin);
    let comparison = 0;

    if (sortBy === "name") comparison = left.name.localeCompare(right.name, locale);
    if (sortBy === "head") comparison = (leftHead ? displayMember(leftHead) : "").localeCompare(
      rightHead ? displayMember(rightHead) : "",
      locale,
    );
    if (sortBy === "members") comparison = left.members.length - right.members.length;
    if (sortBy === "projects") comparison = left.projectsCount - right.projectsCount;
    if (sortBy === "createdAt") comparison = left.createdAt.localeCompare(right.createdAt);

    if (comparison !== 0) return sortDirection === "asc" ? comparison : -comparison;
    return left.name.localeCompare(right.name, locale) || left.id.localeCompare(right.id);
  });
  const totalDepartmentPages = Math.max(1, Math.ceil(filteredDepartments.length / departmentPageSize));
  const currentDepartmentPage = Math.min(departmentPage, totalDepartmentPages);
  const paginatedDepartments = sortedDepartments.slice(
    (currentDepartmentPage - 1) * departmentPageSize,
    currentDepartmentPage * departmentPageSize,
  );
  const departmentRangeStart = filteredDepartments.length > 0
    ? (currentDepartmentPage - 1) * departmentPageSize + 1
    : 0;
  const departmentRangeEnd = Math.min(currentDepartmentPage * departmentPageSize, filteredDepartments.length);
  const displayedColumnWidths = DEPARTMENT_COLUMN_IDS.map((id) => Math.max(columnWidths[id], DISPLAY_LIST_COLUMN_MIN_WIDTH));
  const tableMinWidth = displayedColumnWidths.reduce((total, width) => total + width, DEPARTMENT_ACTION_COLUMN_WIDTH);
  const departmentPageSizeOptions = [10, 20, 50].map((size) => ({ value: String(size), label: String(size) }));

  const translateDepartmentError = (message: string | undefined, fallback: string) => {
    if (!message) return fallback;
    if (message.includes("Department name and key are required")) return t.required;
    if (message.includes("Department key already exists")) return t.keyExists;
    if (message.includes("Department name already exists")) return t.nameExists;
    if (message.includes("Department not found")) return t.notFound;
    if (message.includes("Department name confirmation does not match")) return t.confirmNameMismatch;
    if (message.includes("Selected head already belongs to another department")) return t.headConflict;
    return message;
  };

  const clearListError = () => setListErrorMsg("");
  const clearFormError = () => setFormErrorMsg("");
  const clearDeleteError = () => setDeleteErrorMsg("");

  const renderSortableHeader = (label: string, field: DepartmentSortField) => {
    const isSorted = sortBy === field;
    const nextDirection: SortDirection = isSorted
      ? sortDirection === "asc" ? "desc" : "asc"
      : field === "createdAt" ? "desc" : "asc";

    return (
      <button
        type="button"
        onClick={() => {
          setSortBy(field);
          setSortDirection(nextDirection);
          setDepartmentPage(1);
        }}
        className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
        aria-label={`${label}: ${nextDirection === "asc" ? t.sortAscending : t.sortDescending}`}
        title={`${label}: ${nextDirection === "asc" ? t.sortAscending : t.sortDescending}`}
      >
        <span className="truncate">{label}</span>
        {isSorted ? sortDirection === "asc" ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" /> : null}
      </button>
    );
  };

  const handleColumnResizeStart = (event: React.MouseEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    const columnId = DEPARTMENT_COLUMN_IDS[index];
    if (!columnId) return;
    const scrollContainer = event.currentTarget.closest<HTMLElement>("[data-slot=table-container]");
    resizingRef.current = {
      index,
      startX: event.clientX,
      startWidth: displayedColumnWidths[index],
      scrollContainer,
      startScrollLeft: scrollContainer?.scrollLeft ?? 0,
    };
    const handleMove = (moveEvent: MouseEvent) => {
      const current = resizingRef.current;
      if (!current) return;
      const currentId = DEPARTMENT_COLUMN_IDS[current.index];
      if (!currentId) return;
      const delta = moveEvent.clientX - current.startX;
      const newWidth = Math.max(DISPLAY_LIST_COLUMN_MIN_WIDTH, current.startWidth + delta);
      setColumnWidths((widths) => ({
        ...widths,
        [currentId]: newWidth,
      }));
      if (current.index === DEPARTMENT_COLUMN_IDS.length - 1 && current.scrollContainer) {
        const nextScrollLeft = Math.max(0, current.startScrollLeft + newWidth - current.startWidth);
        window.requestAnimationFrame(() => current.scrollContainer?.scrollTo({ left: nextScrollLeft }));
      }
    };
    const handleUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  const resizeHandle = (index: number) => (
    <div
      className="group/resize absolute bottom-0 right-0 top-0 z-30 w-4 cursor-ew-resize"
      onMouseDown={(event) => handleColumnResizeStart(event, index)}
      title={locale === "zh" ? "拖拽调整列宽" : "Drag to resize column"}
    >
      <span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-border opacity-0 transition-[width,background-color,opacity] group-hover/column:opacity-100 group-hover/resize:w-0.5 group-hover/resize:bg-primary" />
    </div>
  );

  const renderResizableHeader = (columnId: DepartmentColumnId, content: React.ReactNode, className = "") => {
    const index = DEPARTMENT_COLUMN_IDS.indexOf(columnId);
    return (
      <TableHead className={`group/column relative overflow-hidden bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] hover:bg-muted ${className}`} style={{ width: displayedColumnWidths[index] }}>
        {content}
        {resizeHandle(index)}
      </TableHead>
    );
  };

  const resetForm = () => {
    setDepartmentForm({ name: "", key: "", description: "" });
    setEditingDepartment(null);
  };

  const openCreateDialog = () => {
    clearFormError();
    resetForm();
    setIsFormOpen(true);
  };

  const openEditDialog = (department: DepartmentRecord) => {
    clearFormError();
    setEditingDepartment(department);
    setDepartmentForm({
      name: department.name,
      key: department.key,
      description: department.description || "",
    });
    setIsFormOpen(true);
  };

  const closeFormDialog = () => {
    setIsFormOpen(false);
    clearFormError();
    resetForm();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    clearFormError();
    startTransition(async () => {
      const res = editingDepartment
        ? await updateDepartment(editingDepartment.id, departmentForm)
        : await createDepartment(departmentForm);

      if (!res.success) {
        setFormErrorMsg(
          translateDepartmentError(res.error, editingDepartment ? t.updateFailed : t.createFailed)
        );
        return;
      }

      closeFormDialog();
      clearListError();
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!deletingDepartment) return;
    clearDeleteError();
    startTransition(async () => {
      const res = await deleteDepartment(deletingDepartment.id, deleteConfirmText);
      if (!res.success) {
        setDeleteErrorMsg(translateDepartmentError(res.error, t.deleteFailed));
        return;
      }

      clearListError();
      setDeletingDepartment(null);
      setDeleteConfirmText("");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setDepartmentPage(1);
              }}
              placeholder={t.search}
              className="pl-9"
            />
          </div>
          <Button type="button" onClick={openCreateDialog}>
            <Plus />
            {t.createDepartment}
          </Button>
        </div>
      </div>

      {listErrorMsg ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {listErrorMsg}
        </div>
      ) : null}

      {createdDateFilter !== "ALL" && createdDate ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <div className="inline-flex max-w-[360px] items-start rounded-md border bg-background text-foreground shadow-xs">
            <span className="flex min-w-0 items-center px-2.5 py-1">
              <span className="shrink-0 text-muted-foreground">{t.createdAt}：</span>
              <span className="min-w-0 truncate">
                {{ EQ: t.dateEquals, GTE: t.dateOnOrAfter, LTE: t.dateOnOrBefore }[createdDateFilter]}
                {createdDate ? `：${createdDate}` : ""}
              </span>
            </span>
            <button
              type="button"
              className="m-0.5 ml-0 inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`${t.removeFilter}：${t.createdAt}`}
              title={`${t.removeFilter}：${t.createdAt}`}
              onClick={() => {
                setCreatedDateFilter("ALL");
                setCreatedDate("");
                setDepartmentPage(1);
              }}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <Card className="gap-0 overflow-hidden py-0">
          <Table className="table-fixed" style={{ minWidth: tableMinWidth }}>
            <colgroup>
              {DEPARTMENT_COLUMN_IDS.map((columnId, index) => <col key={columnId} style={{ width: displayedColumnWidths[index] }} />)}
              <col />
              <col style={{ width: DEPARTMENT_ACTION_COLUMN_WIDTH }} />
            </colgroup>
            <TableHeader className="sticky top-0 z-10 bg-muted/50">
              <TableRow className="hover:bg-muted/50">
                {renderResizableHeader("name", renderSortableHeader(t.name, "name"), "pl-6")}
                {renderResizableHeader("head", renderSortableHeader(t.head, "head"))}
                {renderResizableHeader("members", renderSortableHeader(t.members, "members"))}
                {renderResizableHeader("projects", renderSortableHeader(t.projects, "projects"))}
                {renderResizableHeader("createdAt", (
                  <div className="flex min-w-0 items-center gap-1">
                    {renderSortableHeader(t.createdAt, "createdAt")}
                    <ListDateFilterMenu
                      label={t.createdAt}
                      value={createdDateFilter}
                      date={createdDate}
                      locale={locale}
                      labels={{ all: t.all, equals: t.dateEquals, onOrAfter: t.dateOnOrAfter, onOrBefore: t.dateOnOrBefore }}
                      onChange={(value, date) => {
                        if (value === "BETWEEN") return;
                        setCreatedDateFilter(value);
                        setCreatedDate(date);
                        setDepartmentPage(1);
                      }}
                    />
                  </div>
                ))}
                <TableHead aria-hidden className="bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] p-0 hover:bg-muted" />
                <TableHead
                  className="sticky right-0 z-20 overflow-hidden bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] text-left whitespace-nowrap shadow-[-6px_0_8px_-8px_rgba(15,23,42,0.45)] hover:bg-muted"
                  style={{
                    width: DEPARTMENT_ACTION_COLUMN_WIDTH,
                    minWidth: DEPARTMENT_ACTION_COLUMN_WIDTH,
                    paddingInline: LIST_ACTION_COLUMN_PADDING_X,
                  }}
                >
                  <div
                    className="text-left"
                    style={{ width: DEPARTMENT_ACTION_COLUMN_WIDTH - LIST_ACTION_COLUMN_PADDING_X * 2 }}
                  >
                    {t.actions}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDepartments.map((department) => {
                const head = department.members.find((member) => member.isDepartmentAdmin);

                return (
                  <TableRow key={department.id} className="group hover:bg-muted/40">
                    <TableCell className="overflow-hidden pl-6">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground" title={department.name}>{department.name}</div>
                        <div className="truncate font-mono text-xs text-muted-foreground" title={department.key}>{department.key}</div>
                      </div>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      {head ? <span className="flex min-w-0 items-center gap-2 font-medium text-foreground"><span className="truncate" title={displayMember(head)}>{displayMember(head)}</span>{head.disabledAt ? <Badge variant="outline" className="shrink-0 text-muted-foreground">{t.disabled}</Badge> : null}</span> : null}
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <Badge variant="secondary">
                        {department.members.length} {t.memberCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <Badge variant="outline">
                        {department.projectsCount} {t.projectCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="overflow-hidden text-xs font-medium text-muted-foreground">
                      <span className="block truncate" title={formatFullDateTime(department.createdAt, locale)}>
                        {formatListDateTime(department.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell aria-hidden className="p-0" />
                    <TableCell
                      className="sticky right-0 z-10 overflow-hidden bg-card text-right whitespace-nowrap shadow-[-6px_0_8px_-8px_rgba(15,23,42,0.45)] group-hover:bg-muted/40"
                      style={{
                        width: DEPARTMENT_ACTION_COLUMN_WIDTH,
                        minWidth: DEPARTMENT_ACTION_COLUMN_WIDTH,
                        paddingInline: LIST_ACTION_COLUMN_PADDING_X,
                      }}
                    >
                      <div className="flex min-w-0 flex-col items-end gap-1 text-left">
                        <div className="inline-flex items-center" style={{ gap: LIST_ACTION_BUTTON_GAP }}>
                          <Button asChild variant="outline" size="icon-xs">
                            <Link
                              href={`/admin/logs?range=all&targetType=DEPARTMENT&targetId=${encodeURIComponent(department.id)}`}
                              aria-label={t.viewLogs}
                              title={t.viewLogs}
                            >
                              <LogNavIcon className="size-3" />
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="icon-xs">
                            <Link
                              href={`/admin/departments/${department.id}/members`}
                              aria-label={t.manage}
                              title={t.manage}
                            >
                              <UserRound />
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() => openEditDialog(department)}
                            disabled={isPending}
                            aria-label={t.edit}
                            title={t.edit}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() => {
                              clearListError();
                              clearDeleteError();
                              setDeleteConfirmText("");
                              setDeletingDepartment(department);
                            }}
                            disabled={isPending}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={t.delete}
                            title={t.delete}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredDepartments.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={DEPARTMENT_COLUMN_IDS.length + 2} className="h-48 text-center text-muted-foreground">
                    {departments.length === 0 ? t.empty : t.noResults}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3 text-sm">
          <div className="font-medium text-muted-foreground">
            {t.showing} <span className="font-bold text-foreground">{departmentRangeStart}</span> {t.to}{" "}
            <span className="font-bold text-foreground">{departmentRangeEnd}</span> {t.of}{" "}
            <span className="font-bold text-foreground">{filteredDepartments.length}</span> {t.departmentCount}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{t.perPage}</span>
              <Select
                value={String(departmentPageSize)}
                onValueChange={(value) => {
                  setDepartmentPageSize(Number(value));
                  setDepartmentPage(1);
                }}
              >
                <SelectTrigger size="sm" className="w-20 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {departmentPageSizeOptions.map((option) => (
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
                onClick={() => setDepartmentPage(Math.max(1, currentDepartmentPage - 1))}
                disabled={currentDepartmentPage === 1}
              >
                <ArrowLeft size={18} />
              </Button>
              <span className="min-w-24 px-2 text-center font-medium leading-none text-foreground">
                {locale === "zh"
                  ? `${t.page} ${currentDepartmentPage} / ${totalDepartmentPages}`
                  : `${t.page} ${currentDepartmentPage} of ${totalDepartmentPages}`}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setDepartmentPage(Math.min(totalDepartmentPages, currentDepartmentPage + 1))}
                disabled={currentDepartmentPage >= totalDepartmentPages}
              >
                <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => !open && !isPending && closeFormDialog()}>
        <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-muted/35 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{editingDepartment ? t.editTitle : t.createTitle}</DialogTitle>
              <DialogDescription className="sr-only">
                {editingDepartment ? t.editTitle : t.createTitle}
              </DialogDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closeFormDialog}
                disabled={isPending}
                aria-label={t.cancel}
              >
                <X />
              </Button>
            </div>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 p-6">
              {formErrorMsg ? (
                <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  {formErrorMsg}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="department-name">{t.name}</Label>
                <Input
                  id="department-name"
                  required
                  value={departmentForm.name}
                  onChange={(event) => setDepartmentForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder={locale === "zh" ? "例如：工程部" : "e.g. Engineering"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department-key">{t.key}</Label>
                <Input
                  id="department-key"
                  required
                  maxLength={10}
                  value={departmentForm.key}
                  onChange={(event) => setDepartmentForm((current) => ({ ...current, key: event.target.value.toUpperCase() }))}
                  className="font-mono"
                  placeholder={locale === "zh" ? "例如：ENG" : "e.g. ENG"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department-description">{t.description}</Label>
                <Textarea
                  id="department-description"
                  rows={3}
                  value={departmentForm.description}
                  onChange={(event) => setDepartmentForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder={t.descPlaceholder}
                />
              </div>
            </div>
            <DialogFooter className="border-t bg-muted/35 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeFormDialog}
                disabled={isPending}
              >
                {t.cancel}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : null}
                {editingDepartment ? t.save : t.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingDepartment)}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            clearDeleteError();
            setDeletingDepartment(null);
            setDeleteConfirmText("");
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
                  clearDeleteError();
                  setDeletingDepartment(null);
                  setDeleteConfirmText("");
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
            {deleteErrorMsg ? (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                {deleteErrorMsg}
              </div>
            ) : null}
            {deletingDepartment ? (
              <>
                <div
                  className="select-none rounded-md border bg-muted/40 p-3 text-sm font-medium"
                  onCopy={(event) => event.preventDefault()}
                  onCut={(event) => event.preventDefault()}
                >
                  {deletingDepartment.name}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delete-department-confirm">{t.typeToConfirm}</Label>
                  <Input
                    id="delete-department-confirm"
                    type="text"
                    value={deleteConfirmText}
                    onChange={(event) => setDeleteConfirmText(event.target.value)}
                    placeholder={deletingDepartment.name}
                  />
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter className="border-t bg-muted/35 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearDeleteError();
                setDeletingDepartment(null);
                setDeleteConfirmText("");
              }}
              disabled={isPending}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || !deletingDepartment || deleteConfirmText !== deletingDepartment.name}
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
