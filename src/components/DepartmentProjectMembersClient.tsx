"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Plus, Search, Trash2, UserPlus, X } from "lucide-react";

import { updateDepartmentProjectMembers } from "@/app/actions/departments";
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
    addSelected: "Add selected",
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
    addSelected: "确认添加",
    noUsers: "没有可添加的用户。",
    cancel: "取消",
    assignFailed: "更新项目成员失败",
    ownerRequired: "项目负责人必须从项目成员中选择。",
    unassignedOwner: "未指派",
  },
} as const;

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
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">{project.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {project.key} · {t.subtitle}
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => {
              setErrorMsg("");
              setIsAddOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus size={16} />
            {t.addMembers}
          </button>
        ) : null}
      </div>

      {errorMsg ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {errorMsg}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-800">{t.currentMembers}</h3>
          <p className="mt-1 text-xs text-slate-500">
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
            <thead className="border-b bg-white text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">{locale === "zh" ? "姓名" : "Name"}</th>
                <th className="px-5 py-4">{locale === "zh" ? "邮箱" : "Email"}</th>
                <th className="px-5 py-4">{locale === "zh" ? "角色" : "Role"}</th>
                <th className="w-56 px-5 py-4">{locale === "zh" ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projectMembers.map((member) => {
                const isOwner = member.userId === project.ownerId;
                return (
                  <tr
                    key={member.userId}
                    onClick={() => {
                      if (canManage && !isPending && !isOwner) handleSetOwner(member.userId);
                    }}
                    className={`transition-colors ${canManage && !isOwner && !isPending ? "cursor-pointer hover:bg-slate-50/70" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <span>{displayMember(member)}</span>
                        {isOwner ? <Crown size={14} className="text-amber-500" /> : null}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{member.userEmail}</td>
                    <td className="px-5 py-3.5">
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {isOwner ? t.owner : t.member}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          {!isOwner ? (
                            <span className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-600">
                              {t.setOwner}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRemoveMember(member.userId);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                            {t.remove}
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {projectMembers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center text-slate-500">
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
                const checked = selectedMemberIds.includes(user.userId);
                return (
                  <label key={user.userId} className="flex cursor-pointer items-center gap-3 px-6 py-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setSelectedMemberIds((current) =>
                          event.target.checked
                            ? Array.from(new Set([...current, user.userId]))
                            : current.filter((selectedId) => selectedId !== user.userId)
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">{displayMember(user)}</div>
                      <div className="truncate text-xs text-slate-500">{user.userEmail}</div>
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
