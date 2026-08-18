"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Crown, Loader2, Plus, Search, Trash2, X } from "lucide-react";

import { updateDepartmentProjectMembers } from "@/app/actions/departments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DepartmentWorkspaceMember, DepartmentWorkspaceProject } from "@/lib/departmentWorkspace";
import type { Locale } from "@/lib/i18n";

const TEXT = {
  en: {
    title: "Project members",
    subtitle: "Manage project members and owner assignments.",
    addMembers: "Add members",
    currentMembers: "Current members",
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
    unassignedOwner: "Unassigned",
  },
  zh: {
    title: "项目成员",
    subtitle: "管理项目成员和项目负责人。",
    addMembers: "添加成员",
    currentMembers: "当前成员",
    owner: "负责人",
    member: "成员",
    setOwner: "设为负责人",
    remove: "移出项目",
    emptyMembers: "当前项目还没有成员。",
    searchUsers: "搜索用户",
    selected: "已选",
    addSelected: "添加",
    noUsers: "没有可添加的用户。",
    cancel: "取消",
    assignFailed: "更新项目成员失败",
    ownerRequired: "项目负责人必须从项目成员中选择。",
    unassignedOwner: "未指派",
  },
} as const;

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

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

  const currentMemberIds = new Set(project.members.map((member) => member.userId));
  const projectMembers = [...project.members].sort((a, b) => {
    const ownerDiff = Number(b.userId === project.ownerId) - Number(a.userId === project.ownerId);
    if (ownerDiff !== 0) return ownerDiff;
    return displayMember(a).localeCompare(displayMember(b));
  });
  const availableUsers = departmentMembers.filter((member) => !currentMemberIds.has(member.userId));
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

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{project.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.key} · {t.subtitle}
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            onClick={() => {
              setErrorMsg("");
              setIsAddOpen(true);
            }}
          >
            <Plus />
            {t.addMembers}
          </Button>
        ) : null}
      </div>

      {errorMsg && !isAddOpen ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {errorMsg}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="border-b bg-muted/50 px-5 py-4">
          <h3 className="text-sm font-bold text-foreground">{t.currentMembers}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {project.ownerId
              ? `${t.owner}: ${
                  displayMember(
                    departmentMembers.find((member) => member.userId === project.ownerId) || {
                      userName: null,
                      userEmail: t.unassignedOwner,
                    }
                  )
                }`
              : t.unassignedOwner}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="h-12 px-5 py-0 align-middle">{locale === "zh" ? "姓名" : "Name"}</th>
                <th className="h-12 px-5 py-0 align-middle">{locale === "zh" ? "邮箱" : "Email"}</th>
                <th className="h-12 px-5 py-0 align-middle">{locale === "zh" ? "角色" : "Role"}</th>
                <th className="h-12 w-56 px-5 py-0 align-middle">{locale === "zh" ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedProjectMembers.map((member) => {
                const isOwner = member.userId === project.ownerId;
                return (
                  <tr
                    key={member.userId}
                    onClick={() => {
                      if (canManage && !isPending && !isOwner) handleSetOwner(member.userId);
                    }}
                    className={`transition-colors ${canManage && !isOwner && !isPending ? "cursor-pointer hover:bg-muted/45" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <span>{displayMember(member)}</span>
                        {isOwner ? <Crown size={14} className="text-amber-500" /> : null}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{member.userEmail}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={isOwner ? "default" : "secondary"}>
                        {isOwner ? t.owner : t.member}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          {!isOwner ? (
                            <Badge variant="outline" className="text-primary">
                              {t.setOwner}
                            </Badge>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={isPending}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveMember(member.userId);
                            }}
                            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 />
                            {t.remove}
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {projectMembers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center text-muted-foreground">
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
                  <ChevronLeft size={18} />
                </Button>
                <span className="min-w-24 px-2 text-center font-medium leading-none text-foreground">
                  {locale === "zh"
                    ? `第 ${currentMemberPage} / ${totalMemberPages || 1} 页`
                    : `Page ${currentMemberPage} of ${totalMemberPages || 1}`}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setMemberPage(Math.min(totalMemberPages || 1, currentMemberPage + 1))}
                  disabled={currentMemberPage === totalMemberPages || totalMemberPages === 0}
                >
                  <ChevronRight size={18} />
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
