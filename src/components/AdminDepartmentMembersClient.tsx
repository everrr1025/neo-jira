"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, Search, Trash2, X } from "lucide-react";

import {
  addMembersToDepartment,
  removeMemberFromDepartment,
  setDepartmentMemberAdmin,
} from "@/app/actions/departments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Locale } from "@/lib/i18n";

type MemberRecord = {
  userId: string;
  role: string;
  isDepartmentAdmin: boolean;
  userName: string | null;
  userEmail: string;
  disabledAt: string | null;
};

type UserOption = {
  id: string;
  name: string | null;
  email: string;
};

type DepartmentRecord = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  members: MemberRecord[];
};

const TEXT = {
  en: {
    title: "Department people",
    addMembers: "Add members",
    head: "Department admin",
    member: "Member",
    setHead: "Set admin",
    unsetHead: "Unset admin",
    remove: "Remove",
    emptyMembers: "No members in this department yet.",
    searchUsers: "Search users",
    selected: "selected",
    addSelected: "Add",
    noUsers: "No available users.",
    cancel: "Cancel",
    assignFailed: "Failed to update department people",
    showing: "Showing",
    to: "to",
    of: "of",
    people: "members",
    perPage: "Per page",
    page: "Page",
    disabled: "Disabled",
  },
  zh: {
    title: "部门人员管理",
    addMembers: "添加成员",
    head: "部门管理员",
    member: "成员",
    setHead: "设为管理员",
    unsetHead: "取消管理员",
    remove: "移除",
    emptyMembers: "当前部门还没有成员。",
    searchUsers: "搜索用户",
    selected: "已选",
    addSelected: "添加",
    noUsers: "没有可添加的用户。",
    cancel: "取消",
    assignFailed: "更新部门人员失败",
    showing: "显示",
    to: "到",
    of: "共",
    people: "名成员",
    perPage: "每页",
    page: "第",
    disabled: "已停用",
  },
} as const;

function displayPerson(person: Pick<UserOption, "name" | "email">) {
  return person.name || person.email;
}

function displayMember(member: MemberRecord) {
  return member.userName || member.userEmail;
}

export default function AdminDepartmentMembersClient({
  department,
  availableUsers,
  locale,
}: {
  department: DepartmentRecord;
  availableUsers: UserOption[];
  locale: Locale;
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberPage, setMemberPage] = useState(1);
  const [memberPageSize, setMemberPageSize] = useState(10);
  const normalizedSearch = userSearch.trim().toLowerCase();
  const filteredUsers = availableUsers.filter((user) => {
    if (!normalizedSearch) return true;
    return `${user.name || ""} ${user.email}`.toLowerCase().includes(normalizedSearch);
  });
  const totalMembers = department.members.length;
  const totalMemberPages = Math.max(1, Math.ceil(totalMembers / memberPageSize));
  const currentMemberPage = Math.min(memberPage, totalMemberPages);
  const memberRangeStart = totalMembers > 0 ? (currentMemberPage - 1) * memberPageSize + 1 : 0;
  const memberRangeEnd = Math.min(currentMemberPage * memberPageSize, totalMembers);
  const paginatedMembers = department.members.slice(
    (currentMemberPage - 1) * memberPageSize,
    currentMemberPage * memberPageSize
  );

  const closeAddDialog = () => {
    if (isPending) return;
    setIsAddOpen(false);
    setUserSearch("");
    setSelectedMemberIds([]);
    setErrorMsg("");
  };

  const handleSetAdmin = (userId: string, isDepartmentAdmin: boolean) => {
    setErrorMsg("");
    startTransition(async () => {
      const res = await setDepartmentMemberAdmin(department.id, userId, isDepartmentAdmin);
      if (!res.success) {
        setErrorMsg(res.error || t.assignFailed);
        return;
      }
      router.refresh();
    });
  };

  const handleAddSelectedMembers = () => {
    if (selectedMemberIds.length === 0) return;
    setErrorMsg("");
    startTransition(async () => {
      const res = await addMembersToDepartment(department.id, selectedMemberIds);
      if (!res.success) {
        setErrorMsg(res.error || t.assignFailed);
        return;
      }

      setSelectedMemberIds([]);
      setUserSearch("");
      setIsAddOpen(false);
      router.refresh();
    });
  };

  const handleRemoveMember = (userId: string) => {
    setErrorMsg("");
    startTransition(async () => {
      const res = await removeMemberFromDepartment(department.id, userId);
      if (!res.success) {
        setErrorMsg(res.error || t.assignFailed);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{department.name}</h1>
        <Button
          type="button"
          onClick={() => {
            setErrorMsg("");
            setIsAddOpen(true);
          }}
        >
          {t.addMembers}
        </Button>
      </div>

      {errorMsg && !isAddOpen ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {errorMsg}
        </div>
      ) : null}

      <Card className="gap-0 overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="pl-6">{locale === "zh" ? "姓名" : "Name"}</TableHead>
                <TableHead>{locale === "zh" ? "邮箱" : "Email"}</TableHead>
                <TableHead>{locale === "zh" ? "角色" : "Role"}</TableHead>
                <TableHead className="w-52">{locale === "zh" ? "操作" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMembers.map((member) => {
                const isAdmin = member.isDepartmentAdmin;
                return (
                  <TableRow key={member.userId}>
                    <TableCell className="pl-6 font-medium text-foreground">
                      <span className="inline-flex items-center gap-2">
                        {displayMember(member)}
                        {member.disabledAt ? <Badge variant="outline" className="text-muted-foreground">{t.disabled}</Badge> : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.userEmail}</TableCell>
                    <TableCell>
                      <Badge variant={isAdmin ? "default" : "secondary"}>
                        {isAdmin ? t.head : t.member}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={isPending}
                          onClick={() => handleSetAdmin(member.userId, !isAdmin)}
                          className={isAdmin ? "" : "text-primary"}
                        >
                          {isAdmin ? t.unsetHead : t.setHead}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={isPending}
                          onClick={() => handleRemoveMember(member.userId)}
                          className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 />
                          {t.remove}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {department.members.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="h-40 text-center text-muted-foreground">
                    {t.emptyMembers}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3 text-sm">
          <div className="font-medium text-muted-foreground">
            {t.showing} <span className="font-bold text-foreground">{memberRangeStart}</span> {t.to}{" "}
            <span className="font-bold text-foreground">{memberRangeEnd}</span> {t.of}{" "}
            <span className="font-bold text-foreground">{totalMembers}</span> {t.people}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{t.perPage}</span>
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
                  {[10, 20, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
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
                  ? `${t.page} ${currentMemberPage} / ${totalMemberPages}`
                  : `${t.page} ${currentMemberPage} of ${totalMemberPages}`}
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
      </Card>

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
              const checked = selectedMemberIds.includes(user.id);
              return (
                <label key={user.id} className="flex cursor-pointer items-center gap-3 px-6 py-3 hover:bg-muted/45">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) =>
                        setSelectedMemberIds((current) =>
                          nextChecked === true
                            ? Array.from(new Set([...current, user.id]))
                            : current.filter((selectedId) => selectedId !== user.id)
                        )
                      }
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {displayPerson(user)}
                      </span>
                      {user.name ? (
                        <span className="min-w-0 truncate text-sm text-muted-foreground">
                          {user.email}
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
            <Button type="button" variant="outline" onClick={closeAddDialog} disabled={isPending}>
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
