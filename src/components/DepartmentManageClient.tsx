"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Loader2, Building2, Users, FolderGit2, Crown, Shield } from "lucide-react";
import {
  setDepartmentMemberRole,
  addMemberToDepartment,
  removeMemberFromDepartment,
} from "@/app/actions/departments";
import type { Locale } from "@/lib/i18n";

type MemberRecord = {
  userId: string;
  role: string;
  userName: string | null;
  userEmail: string;
};

type ProjectRecord = {
  id: string;
  name: string;
  key: string;
  ownerName: string;
  issuesCount: number;
};

type DeptData = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  members: MemberRecord[];
  projects: ProjectRecord[];
};

type UserOption = {
  id: string;
  name: string | null;
  email: string;
};

const TEXT = {
  en: {
    title: "Department Management",
    membersTab: "Members",
    projectsTab: "Projects",
    memberCount: "members",
    projectCount: "projects",
    addMember: "Add Member",
    selectUser: "Select user...",
    add: "Add",
    name: "Name",
    email: "Email",
    role: "Role",
    action: "Action",
    head: "Head",
    assistant: "Assistant",
    member: "Member",
    setAssistant: "Set as Assistant",
    setMember: "Set as Member",
    remove: "Remove",
    noMembers: "No members in this department.",
    noProjects: "No projects associated yet.",
    project: "Project",
    owner: "Owner",
    issues: "Issues",
    confirmRemove: "Remove this member from the department?",
  },
  zh: {
    title: "部门管理",
    membersTab: "成员管理",
    projectsTab: "关联项目",
    memberCount: "位成员",
    projectCount: "个项目",
    addMember: "添加成员",
    selectUser: "选择用户...",
    add: "添加",
    name: "姓名",
    email: "邮箱",
    role: "角色",
    action: "操作",
    head: "负责人",
    assistant: "助理",
    member: "成员",
    setAssistant: "设为助理",
    setMember: "设为成员",
    remove: "移除",
    noMembers: "暂无部门成员。",
    noProjects: "暂无关联项目。",
    project: "项目",
    owner: "负责人",
    issues: "问题数",
    confirmRemove: "确定要将该成员移出部门吗？",
  },
} as const;

const ROLE_BADGE: Record<string, { bg: string; text: string }> = {
  HEAD: { bg: "bg-amber-100", text: "text-amber-800" },
  ASSISTANT: { bg: "bg-blue-100", text: "text-blue-800" },
  MEMBER: { bg: "bg-slate-100", text: "text-slate-600" },
};

export default function DepartmentManageClient({
  department,
  allUsers,
  locale,
  currentUserId,
  isHead,
}: {
  department: DeptData;
  allUsers: UserOption[];
  locale: Locale;
  currentUserId: string;
  isHead: boolean;
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"MEMBERS" | "PROJECTS">("MEMBERS");
  const [addUserId, setAddUserId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const existingMemberIds = new Set(department.members.map((m) => m.userId));
  const availableUsers = allUsers.filter((u) => !existingMemberIds.has(u.id));

  const handleAddMember = () => {
    if (!addUserId) return;
    setErrorMsg("");
    startTransition(async () => {
      const res = await addMemberToDepartment(department.id, addUserId);
      if (res.success) {
        setAddUserId("");
        router.refresh();
      } else {
        setErrorMsg(res.error || "Failed");
      }
    });
  };

  const handleSetRole = (userId: string, role: "ASSISTANT" | "MEMBER") => {
    setErrorMsg("");
    startTransition(async () => {
      const res = await setDepartmentMemberRole(department.id, userId, role);
      if (!res.success) setErrorMsg(res.error || "Failed");
      else router.refresh();
    });
  };

  const handleRemove = (userId: string) => {
    if (!confirm(t.confirmRemove)) return;
    setErrorMsg("");
    startTransition(async () => {
      const res = await removeMemberFromDepartment(department.id, userId);
      if (!res.success) setErrorMsg(res.error || "Failed");
      else router.refresh();
    });
  };

  const getRoleName = (role: string) => {
    if (role === "HEAD") return t.head;
    if (role === "ASSISTANT") return t.assistant;
    return t.member;
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white font-bold text-xl shadow-sm">
          <Building2 size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">
            {department.name}
          </h2>
          <p className="text-sm text-slate-500">
            {department.key} · {department.members.length} {t.memberCount} · {department.projects.length} {t.projectCount}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex w-fit gap-1 rounded-lg bg-slate-200/50 p-1">
        <button
          onClick={() => setActiveTab("MEMBERS")}
          className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all ${
            activeTab === "MEMBERS" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Users size={16} /> {t.membersTab}
        </button>
        <button
          onClick={() => setActiveTab("PROJECTS")}
          className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all ${
            activeTab === "PROJECTS" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FolderGit2 size={16} /> {t.projectsTab}
        </button>
      </div>

      {activeTab === "MEMBERS" ? (
        <div className="space-y-4">
          {/* Members table */}
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="border-b px-5 py-4">{t.name}</th>
                  <th className="border-b px-5 py-4">{t.email}</th>
                  <th className="border-b px-5 py-4">{t.role}</th>
                  <th className="border-b px-5 py-4">{t.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {department.members.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                      {t.noMembers}
                    </td>
                  </tr>
                ) : (
                  department.members
                    .sort((a, b) => {
                      const order: Record<string, number> = { HEAD: 0, ASSISTANT: 1, MEMBER: 2 };
                      return (order[a.role] ?? 3) - (order[b.role] ?? 3);
                    })
                    .map((m) => {
                      const badge = ROLE_BADGE[m.role] || ROLE_BADGE.MEMBER;
                      const isCurrentUser = m.userId === currentUserId;
                      const isMemberHead = m.role === "HEAD";
                      return (
                        <tr key={m.userId} className="hover:bg-slate-50">
                          <td className="px-5 py-4 font-medium text-slate-800">
                            <div className="flex items-center gap-2">
                              {isMemberHead && <Crown size={14} className="text-amber-500" />}
                              {m.role === "ASSISTANT" && <Shield size={14} className="text-blue-500" />}
                              {m.userName || m.userEmail}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-500">{m.userEmail}</td>
                          <td className="px-5 py-4">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.bg} ${badge.text}`}>
                              {getRoleName(m.role)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {!isMemberHead && !isCurrentUser && isHead && (
                              <div className="flex items-center gap-2">
                                {m.role !== "ASSISTANT" ? (
                                  <button
                                    onClick={() => handleSetRole(m.userId, "ASSISTANT")}
                                    disabled={isPending}
                                    className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                  >
                                    {t.setAssistant}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleSetRole(m.userId, "MEMBER")}
                                    disabled={isPending}
                                    className="text-xs text-slate-600 hover:text-slate-800 disabled:opacity-50"
                                  >
                                    {t.setMember}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRemove(m.userId)}
                                  disabled={isPending}
                                  className="text-red-500 hover:text-red-700 disabled:opacity-50"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Projects tab */
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="border-b px-5 py-4">{t.project}</th>
                <th className="border-b px-5 py-4">{t.owner}</th>
                <th className="border-b px-5 py-4">{t.issues}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {department.projects.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-500">
                    {t.noProjects}
                  </td>
                </tr>
              ) : (
                department.projects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800">{p.name}</div>
                      <div className="text-xs font-mono text-slate-500">{p.key}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{p.ownerName}</td>
                    <td className="px-5 py-4 text-slate-600">{p.issuesCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
