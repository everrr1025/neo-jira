"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crown, Loader2, Search, UserMinus, X } from "lucide-react";

import { updateDepartmentProjectMembers } from "@/app/actions/departments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DepartmentWorkspaceMember, DepartmentWorkspaceProject } from "@/lib/departmentWorkspace";
import type { Locale } from "@/lib/i18n";
import {
  DISPLAY_LIST_COLUMN_MIN_WIDTH,
  getListActionColumnWidth,
  LIST_ACTION_BUTTON_GAP,
  LIST_ACTION_COLUMN_PADDING_X,
} from "@/lib/listColumnSizing";

const TEXT = {
  en: {
    title: "Project members",
    addMembers: "Add members",
    owner: "Owner",
    member: "Member",
    setOwner: "Set as owner",
    remove: "Remove",
    emptyMembers: "No members in this project yet.",
    searchUsers: "Search users",
    selected: "selected",
    addSelected: "Add",
    noUsers: "No available users.",
    cancel: "Cancel",
    assignFailed: "Failed to update project members",
    ownerRequired: "Project owner must be selected from project members.",
    disabled: "Disabled",
  },
  zh: {
    title: "项目成员",
    addMembers: "添加成员",
    owner: "负责人",
    member: "成员",
    setOwner: "设为负责人",
    remove: "移出",
    emptyMembers: "当前项目还没有成员。",
    searchUsers: "搜索用户",
    selected: "已选",
    addSelected: "添加",
    noUsers: "没有可添加的用户。",
    cancel: "取消",
    assignFailed: "更新项目成员失败",
    ownerRequired: "项目负责人必须从项目成员中选择。",
    disabled: "已停用",
  },
} as const;

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const ACTION_COLUMN_WIDTH = getListActionColumnWidth(2);

type MemberColumnId = "name" | "email" | "role";
type MemberSortField = Extract<MemberColumnId, "name" | "email">;
type SortDirection = "asc" | "desc";
type MemberColumnConfig = {
  id: MemberColumnId;
  label: string;
  width: number;
};

const DEFAULT_COLUMN_WIDTHS: Record<MemberColumnId, number> = {
  name: 220,
  email: 280,
  role: 140,
};

function displayMember(member: Pick<DepartmentWorkspaceMember, "userName" | "userEmail">) {
  return member.userName || member.userEmail;
}

export default function DepartmentProjectMembersClient({
  departmentId,
  project,
  departmentMembers,
  locale,
  canManage,
}: {
  departmentId: string;
  project: DepartmentWorkspaceProject;
  departmentMembers: DepartmentWorkspaceMember[];
  locale: Locale;
  canManage: boolean;
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberPage, setMemberPage] = useState(1);
  const [memberPageSize, setMemberPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [memberColumnWidths, setMemberColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [memberSortField, setMemberSortField] = useState<MemberSortField | null>(null);
  const [memberSortDirection, setMemberSortDirection] = useState<SortDirection>("asc");
  const memberResizingRef = useRef<{
    colIndex: number;
    startX: number;
    startWidth: number;
    scrollContainer: HTMLElement | null;
    startScrollLeft: number;
  } | null>(null);

  const memberColumns = useMemo<MemberColumnConfig[]>(
    () => [
      { id: "name", label: locale === "zh" ? "姓名" : "Name", width: memberColumnWidths.name },
      { id: "email", label: locale === "zh" ? "邮箱" : "Email", width: memberColumnWidths.email },
      { id: "role", label: locale === "zh" ? "角色" : "Role", width: memberColumnWidths.role },
    ],
    [locale, memberColumnWidths]
  );
  const memberColumnsTotalWidth = useMemo(
    () => memberColumns.reduce((total, column) => total + column.width, canManage ? ACTION_COLUMN_WIDTH : 0),
    [canManage, memberColumns]
  );

  const currentMemberIds = new Set(project.members.map((member) => member.userId));
  const projectMembers = useMemo(() => {
    return [...project.members].sort((a, b) => {
      if (memberSortField) {
        const left = memberSortField === "name" ? displayMember(a) : a.userEmail;
        const right = memberSortField === "name" ? displayMember(b) : b.userEmail;
        const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
        return memberSortDirection === "asc" ? result : -result;
      }
      const ownerDiff = Number(b.userId === project.ownerId) - Number(a.userId === project.ownerId);
      if (ownerDiff !== 0) return ownerDiff;
      return displayMember(a).localeCompare(displayMember(b));
    });
  }, [memberSortDirection, memberSortField, project.members, project.ownerId]);
  const availableUsers = departmentMembers.filter((member) => !member.disabledAt && !currentMemberIds.has(member.userId));
  const normalizedSearch = userSearch.trim().toLowerCase();
  const filteredUsers = availableUsers.filter((user) => {
    if (!normalizedSearch) return true;
    return `${user.userName || ""} ${user.userEmail}`.toLowerCase().includes(normalizedSearch);
  });
  const totalMemberPages = Math.max(1, Math.ceil(projectMembers.length / memberPageSize));
  const currentMemberPage = Math.min(memberPage, totalMemberPages);
  const paginatedProjectMembers = projectMembers.slice(
    (currentMemberPage - 1) * memberPageSize,
    currentMemberPage * memberPageSize
  );
  const memberRangeStart = projectMembers.length > 0 ? (currentMemberPage - 1) * memberPageSize + 1 : 0;
  const memberRangeEnd = Math.min(currentMemberPage * memberPageSize, projectMembers.length);

  const closeAddDialog = () => {
    if (isPending) return;
    setIsAddOpen(false);
    setUserSearch("");
    setSelectedMemberIds([]);
    setErrorMsg("");
  };

  const translateError = (message: string | undefined) => {
    if (!message) return t.assignFailed;
    if (message.includes("Project owner must be selected from project members")) return t.ownerRequired;
    return message;
  };

  const syncProjectMembers = (ownerId: string, memberIds: string[]) => {
    setErrorMsg("");
    startTransition(async () => {
      const res = await updateDepartmentProjectMembers(departmentId, project.id, { ownerId, memberIds });
      if (!res.success) {
        setErrorMsg(translateError(res.error));
        return;
      }
      setIsAddOpen(false);
      setSelectedMemberIds([]);
      setUserSearch("");
      router.refresh();
    });
  };

  const handleSetOwner = (userId: string) => {
    const memberIds = project.members.map((member) => member.userId);
    syncProjectMembers(userId, memberIds);
  };

  const handleRemoveMember = (userId: string) => {
    const memberIds = project.members.map((member) => member.userId).filter((id) => id !== userId);
    const ownerId = project.ownerId === userId ? "" : project.ownerId || "";
    syncProjectMembers(ownerId, memberIds);
  };

  const handleAddSelectedMembers = () => {
    if (selectedMemberIds.length === 0) return;
    const mergedMemberIds = Array.from(new Set([...project.members.map((member) => member.userId), ...selectedMemberIds]));
    syncProjectMembers(project.ownerId || "", mergedMemberIds);
  };

  const handleMemberSort = (field: MemberColumnId) => {
    if (field === "role") return;
    if (memberSortField === field) {
      setMemberSortDirection((current) => current === "asc" ? "desc" : "asc");
    } else {
      setMemberSortField(field);
      setMemberSortDirection("asc");
    }
    setMemberPage(1);
  };

  const handleMemberColumnResizeStart = useCallback(
    (event: React.MouseEvent, colIndex: number) => {
      event.preventDefault();
      event.stopPropagation();
      const column = memberColumns[colIndex];
      if (!column) return;
      const scrollContainer = event.currentTarget.closest<HTMLElement>(".overflow-auto");
      memberResizingRef.current = {
        colIndex,
        startX: event.clientX,
        startWidth: column.width,
        scrollContainer,
        startScrollLeft: scrollContainer?.scrollLeft ?? 0,
      };

      const onMouseMove = (moveEvent: MouseEvent) => {
        const resizeState = memberResizingRef.current;
        if (!resizeState) return;
        const columnId = memberColumns[resizeState.colIndex]?.id;
        if (!columnId) return;

        const newWidth = Math.max(
          DISPLAY_LIST_COLUMN_MIN_WIDTH,
          resizeState.startWidth + moveEvent.clientX - resizeState.startX
        );
        setMemberColumnWidths((current) => ({ ...current, [columnId]: newWidth }));
        if (resizeState.colIndex === memberColumns.length - 1 && resizeState.scrollContainer) {
          const nextScrollLeft = Math.max(0, resizeState.startScrollLeft + newWidth - resizeState.startWidth);
          window.requestAnimationFrame(() => resizeState.scrollContainer?.scrollTo({ left: nextScrollLeft }));
        }
      };

      const onMouseUp = () => {
        memberResizingRef.current = null;
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
    [memberColumns]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-2xl font-semibold tracking-tight text-foreground">{project.name}</h2>
          <Badge variant="secondary" className="shrink-0 font-mono">{project.key}</Badge>
        </div>
        {canManage ? (
          <Button
            type="button"
            onClick={() => {
              setErrorMsg("");
              setIsAddOpen(true);
            }}
          >
            {t.addMembers}
          </Button>
        ) : null}
      </div>

      {errorMsg && !isAddOpen ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {errorMsg}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-auto">
          <table
            className="text-left text-sm"
            style={{ tableLayout: "fixed", width: `max(100%, ${memberColumnsTotalWidth}px)` }}
          >
            <colgroup>
              {memberColumns.map((column) => <col key={column.id} style={{ width: `${column.width}px` }} />)}
              <col />
              {canManage ? <col style={{ width: `${ACTION_COLUMN_WIDTH}px` }} /> : null}
            </colgroup>
            <thead className="border-b bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                {memberColumns.map((column, index) => (
                  <th
                    key={column.id}
                    className="group/column relative h-12 select-none overflow-hidden bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] px-5 py-0 align-middle transition-colors hover:bg-muted"
                    style={{ width: `${column.width}px` }}
                  >
                    {column.id === "name" || column.id === "email" ? (
                      <button
                        type="button"
                        onClick={() => handleMemberSort(column.id)}
                        className="inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1 font-semibold text-muted-foreground hover:text-foreground"
                      >
                        <span className="truncate">{column.label}</span>
                        {memberSortField === column.id
                          ? memberSortDirection === "asc"
                            ? <ArrowUp size={12} />
                            : <ArrowDown size={12} />
                          : null}
                      </button>
                    ) : (
                      <span className="block truncate font-semibold">{column.label}</span>
                    )}
                    <div
                      className="group/resize absolute bottom-0 right-0 top-0 z-20 w-4 cursor-ew-resize"
                      onMouseDown={(event) => handleMemberColumnResizeStart(event, index)}
                      title={locale === "zh" ? "拖拽调整列宽" : "Drag to resize column"}
                    >
                      <span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-border opacity-0 transition-[width,background-color,opacity] group-hover/column:opacity-100 group-hover/resize:w-0.5 group-hover/resize:bg-primary" />
                    </div>
                  </th>
                ))}
                <th aria-hidden className="h-12 bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] p-0 hover:bg-muted" />
                {canManage ? (
                  <th
                    className="sticky right-0 z-20 h-12 select-none overflow-hidden bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] py-0 text-left align-middle whitespace-nowrap shadow-[-6px_0_8px_-8px_rgba(15,23,42,0.45)] hover:bg-muted"
                    style={{ width: ACTION_COLUMN_WIDTH, minWidth: ACTION_COLUMN_WIDTH, paddingInline: LIST_ACTION_COLUMN_PADDING_X }}
                  >
                    {locale === "zh" ? "操作" : "Actions"}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedProjectMembers.map((member) => {
                const isOwner = member.userId === project.ownerId;
                return (
                  <tr key={member.userId} className="group/member-row transition-colors hover:bg-muted/40">
                    <td className="overflow-hidden px-5 py-4 font-medium text-foreground">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{displayMember(member)}</span>
                        {member.disabledAt ? <Badge variant="outline" className="text-muted-foreground">{t.disabled}</Badge> : null}
                      </span>
                    </td>
                    <td className="overflow-hidden px-5 py-4 text-muted-foreground">
                      <span className="block truncate">{member.userEmail}</span>
                    </td>
                    <td className="overflow-hidden px-5 py-4">
                      <Badge variant={isOwner ? "default" : "secondary"}>
                        {isOwner ? t.owner : t.member}
                      </Badge>
                    </td>
                    <td aria-hidden className="p-0" />
                    {canManage ? (
                      <td
                        className="sticky right-0 z-10 overflow-hidden bg-card py-4 text-left whitespace-nowrap shadow-[-6px_0_8px_-8px_rgba(15,23,42,0.45)] group-hover/member-row:bg-muted/40"
                        style={{ width: ACTION_COLUMN_WIDTH, minWidth: ACTION_COLUMN_WIDTH, paddingInline: LIST_ACTION_COLUMN_PADDING_X }}
                      >
                        <div className="inline-flex items-center" style={{ gap: LIST_ACTION_BUTTON_GAP }}>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            disabled={isPending || isOwner || Boolean(member.disabledAt)}
                            onClick={() => handleSetOwner(member.userId)}
                            className="text-primary"
                            aria-label={t.setOwner}
                            title={t.setOwner}
                          >
                            <Crown />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            disabled={isPending}
                            onClick={() => handleRemoveMember(member.userId)}
                            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={t.remove}
                            title={t.remove}
                          >
                            <UserMinus />
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {projectMembers.length === 0 ? (
                <tr>
                  <td colSpan={memberColumns.length + 2} className="px-5 py-16 text-center text-muted-foreground">
                    {t.emptyMembers}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {projectMembers.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3 text-sm">
            <div className="font-medium text-muted-foreground">
              {locale === "zh" ? "显示" : "Showing"}
              <span className="font-bold text-foreground"> {memberRangeStart} </span>
              {locale === "zh" ? "至" : "to"}
              <span className="font-bold text-foreground"> {memberRangeEnd} </span>
              {locale === "zh" ? "共" : "of"}
              <span className="font-bold text-foreground"> {projectMembers.length} </span>
              {locale === "zh" ? "成员" : "members"}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{locale === "zh" ? "每页" : "Per page"}</span>
                <Select
                  value={String(memberPageSize)}
                  onValueChange={(value) => {
                    setMemberPageSize(Number(value));
                    setMemberPage(1);
                  }}
                >
                  <SelectTrigger size="sm" className="w-20 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {PAGE_SIZE_OPTIONS.map((option) => (
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
                  onClick={() => setMemberPage(Math.max(1, currentMemberPage - 1))}
                  disabled={currentMemberPage === 1}
                >
                  <ArrowLeft />
                </Button>
                <span className="min-w-24 px-2 text-center font-medium leading-none text-foreground">
                  {locale === "zh"
                    ? `第 ${currentMemberPage} / ${totalMemberPages} 页`
                    : `Page ${currentMemberPage} of ${totalMemberPages}`}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setMemberPage(Math.min(totalMemberPages, currentMemberPage + 1))}
                  disabled={currentMemberPage >= totalMemberPages}
                >
                  <ArrowRight />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={isAddOpen} onOpenChange={(open) => !open && closeAddDialog()}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[88vh] max-w-2xl flex-col gap-0 overflow-hidden p-0"
        >
          <DialogHeader className="shrink-0 border-b bg-muted/35 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{t.addMembers}</DialogTitle>
              <DialogDescription className="sr-only">{t.addMembers}</DialogDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closeAddDialog}
                disabled={isPending}
                aria-label={t.cancel}
              >
                <X />
              </Button>
            </div>
          </DialogHeader>

          <div className="shrink-0 border-b p-4">
            <div className="flex items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder={t.searchUsers}
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary" className="h-7 px-2.5">
                {t.selected} {selectedMemberIds.length}
              </Badge>
            </div>
          </div>

          <div className="min-h-0 flex-1 divide-y overflow-y-auto">
            {errorMsg ? (
              <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-6 py-3 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                {errorMsg}
              </div>
            ) : null}
            {filteredUsers.map((user) => {
              const checked = selectedMemberIds.includes(user.userId);
              return (
                <label
                  key={user.userId}
                  className="flex cursor-pointer items-center gap-3 px-6 py-3 hover:bg-muted/45"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(nextChecked) =>
                      setSelectedMemberIds((current) =>
                        nextChecked === true
                          ? Array.from(new Set([...current, user.userId]))
                          : current.filter((selectedId) => selectedId !== user.userId)
                      )
                    }
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {displayMember(user)}
                    </span>
                    {user.userName ? (
                      <span className="min-w-0 truncate text-sm text-muted-foreground">
                        {user.userEmail}
                      </span>
                    ) : null}
                  </div>
                </label>
              );
            })}
            {filteredUsers.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">{t.noUsers}</div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 border-t bg-muted/35 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeAddDialog}
              disabled={isPending}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              onClick={handleAddSelectedMembers}
              disabled={isPending || selectedMemberIds.length === 0}
            >
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {t.addSelected}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
