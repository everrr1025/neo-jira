"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Plus, Search, Trash2, UserPlus, X } from "lucide-react";

import {
  addMembersToDepartment,
  removeMemberFromDepartment,
  setDepartmentMemberRole,
} from "@/app/actions/departments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";

type MemberRecord = {
  userId: string;
  role: string;
  userName: string | null;
  userEmail: string;
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
    subtitle: "Manage department members.",
    addMembers: "Add members",
    currentMembers: "Current members",
    head: "Head",
    member: "Member",
    setHead: "Set head",
    remove: "Remove",
    emptyMembers: "No members in this department yet.",
    searchUsers: "Search users",
    selected: "selected",
    addSelected: "Add selected",
    noUsers: "No available users.",
    cancel: "Cancel",
    assignFailed: "Failed to update department people",
  },
  zh: {
    title: "部门人员管理",
    subtitle: "管理部门成员。",
    addMembers: "添加成员",
    currentMembers: "当前成员",
    head: "负责人",
    member: "成员",
    setHead: "设为负责人",
    remove: "移除",
    emptyMembers: "当前部门还没有成员。",
    searchUsers: "搜索用户",
    selected: "已选",
    addSelected: "添加所选",
    noUsers: "没有可添加的用户。",
    cancel: "取消",
    assignFailed: "更新部门人员失败",
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
  const normalizedSearch = userSearch.trim().toLowerCase();
  const filteredUsers = availableUsers.filter((user) => {
    if (!normalizedSearch) return true;
    return `${user.name || ""} ${user.email}`.toLowerCase().includes(normalizedSearch);
  });
  const head = department.members.find((member) => member.role === "HEAD") || null;

  const handleSetHead = (userId: string) => {
    setErrorMsg("");
    startTransition(async () => {
      const res = await setDepartmentMemberRole(department.id, userId, "HEAD");
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
    <div className="flex min-h-0 flex-1 flex-col space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{department.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {department.key} · {t.subtitle}
          </p>
        </div>
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
      </div>

      {errorMsg ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {errorMsg}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="border-b bg-muted/50 px-5 py-4">
          <h3 className="text-sm font-bold text-foreground">{t.currentMembers}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{head ? `${t.head}: ${displayMember(head)}` : t.emptyMembers}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b bg-muted/35 text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-4">{locale === "zh" ? "姓名" : "Name"}</th>
                <th className="px-5 py-4">{locale === "zh" ? "邮箱" : "Email"}</th>
                <th className="px-5 py-4">{locale === "zh" ? "角色" : "Role"}</th>
                <th className="w-52 px-5 py-4">{locale === "zh" ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {department.members.map((member) => {
                const isHead = member.role === "HEAD";
                return (
                  <tr
                    key={member.userId}
                    onClick={() => {
                      if (!isPending && !isHead) handleSetHead(member.userId);
                    }}
                    className={`transition-colors ${isHead || isPending ? "" : "cursor-pointer hover:bg-muted/45"}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-foreground">{displayMember(member)}</div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{member.userEmail}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={isHead ? "default" : "secondary"}>
                        {isHead ? t.head : t.member}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {!isHead ? (
                          <>
                            <Badge variant="outline" className="text-primary">
                              {t.setHead}
                            </Badge>
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
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {department.members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center text-muted-foreground">
                    {t.emptyMembers}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {isAddOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{t.addMembers}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t.selected} {selectedMemberIds.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-slate-100 p-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder={t.searchUsers}
                  className="h-9 w-full rounded-md border border-slate-200 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-auto">
              {filteredUsers.map((user) => {
                const checked = selectedMemberIds.includes(user.id);
                return (
                  <label key={user.id} className="flex cursor-pointer items-center gap-3 px-6 py-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setSelectedMemberIds((current) =>
                          event.target.checked
                            ? Array.from(new Set([...current, user.id]))
                            : current.filter((selectedId) => selectedId !== user.id)
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">{displayPerson(user)}</div>
                      <div className="truncate text-xs text-slate-500">{user.email}</div>
                    </div>
                  </label>
                );
              })}
              {filteredUsers.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-slate-500">{t.noUsers}</div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                disabled={isPending}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleAddSelectedMembers}
                disabled={isPending || selectedMemberIds.length === 0}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {t.addSelected}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
