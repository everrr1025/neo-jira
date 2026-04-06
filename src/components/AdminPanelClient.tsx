"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, createProject, updateProjectMembers, updateProjectOwner, resetUserPassword, deleteUser } from "@/app/actions/admin";
import { Users, FolderGit2, Plus, Shield, Loader2, Crown, Eye, EyeOff, RefreshCw, Trash2, ChevronDown, UserPlus, X, KeyRound } from "lucide-react";
import { Locale } from "@/lib/i18n";

type UserRecord = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  ownedProjectsCount: number;
};

type ProjectMemberRecord = {
  userId: string;
  role: string;
  userName?: string | null;
  userEmail?: string;
};

type ProjectRecord = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  ownerId: string;
  owner: { id: string; name: string | null; email: string };
  members: ProjectMemberRecord[];
  issuesCount: number;
  createdAt: string;
};

type NewUserForm = {
  name: string;
  email: string;
  password: string;
  role: "USER" | "ADMIN";
};

type NewProjectForm = {
  name: string;
  key: string;
  description: string;
  ownerId: string;
  memberIds: string[];
};

type UsersViewProps = {
  users: UserRecord[];
  setErrorMsg: React.Dispatch<React.SetStateAction<string>>;
  locale: Locale;
  currentUserId: string;
};

type ProjectsViewProps = {
  projects: ProjectRecord[];
  users: UserRecord[];
  setErrorMsg: React.Dispatch<React.SetStateAction<string>>;
  locale: Locale;
};

const SPECIAL_CHARS = "!@#$%^&*()-_=+[]{};:,.?/|";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const PASSWORD_POOLS = [UPPER, LOWER, DIGITS, SPECIAL_CHARS];

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
  const chosen = shuffle("0123").slice(0, 3).split("").map((i) => PASSWORD_POOLS[Number(i)]);
  let password = chosen.map((pool) => pickChar(pool)).join("");
  const all = PASSWORD_POOLS.join("");
  while (password.length < Math.max(8, length)) {
    password += pickChar(all);
  }
  return shuffle(password);
}

const TEXT = {
  en: {
    tabs: {
      users: "Users Management",
      projects: "Projects & Access",
    },
    errors: {
      createUser: "Failed to create user",
      deleteUser: "Failed to delete user",
      resetPassword: "Failed to reset password",
      createProject: "Failed to create project",
      updateAccess: "Failed to update access",
      updateRole: "Failed to update role",
      ownerRequired: "Please select a project owner.",
      memberRequired: "Please select at least one project member.",
    },
    users: {
      addTitle: "Add New User",
      fullName: "Full Name",
      email: "Email Address",
      password: "Password",
      passwordRule: "At least 8 chars, and include at least 3 of uppercase/lowercase/number/special.",
      generate: "Generate",
      show: "Show",
      hide: "Hide",
      systemRole: "System Role",
      baseUser: "Base User",
      systemAdmin: "System Administrator",
      create: "Create User",
      name: "Name",
      role: "Role",
      createdAt: "Created At",
      actions: "Actions",
      resetPassword: "Reset Password",
      cannotDeleteOwner: "Project owner",
      cannotDeleteSelf: "Current user",
      delete: "Delete",
      user: "USER",
      admin: "ADMIN",
    },
    projects: {
      createTitle: "Create Project",
      projectName: "Project Name",
      projectKey: "Key (2-4 uppercase letters)",
      projectOwner: "Project Owner",
      projectMembers: "Project Members",
      description: "Description",
      descriptionPlaceholder: "Optional details...",
      create: "Create Project",
      noAssignableUsers: "No non-admin users available for project assignment.",
      noDescription: "No description provided.",
      createdBy: "Created by",
      totalIssues: "total issues",
      teamAccess: "Team Access & Roles",
      toggleAccess: "Click to toggle access",
      demote: "Click to demote to Member",
      promote: "Click to promote to Project Admin",
      admin: "Admin",
      member: "Member",
      empty: "No projects currently exist.",
    },
  },
  zh: {
    tabs: {
      users: "用户管理",
      projects: "项目与权限",
    },
    errors: {
      createUser: "创建用户失败",
      deleteUser: "删除用户失败",
      resetPassword: "重置密码失败",
      createProject: "创建项目失败",
      updateAccess: "更新权限失败",
      updateRole: "更新角色失败",
      ownerRequired: "请选择项目负责人。",
      memberRequired: "请至少选择一个项目成员。",
    },
    users: {
      addTitle: "新增用户",
      fullName: "姓名",
      email: "邮箱地址",
      password: "密码",
      passwordRule: "至少 8 位，并包含大写/小写/数字/特殊符号中的至少 3 项。",
      generate: "重生密码",
      show: "显示",
      hide: "隐藏",
      systemRole: "系统角色",
      baseUser: "普通用户",
      systemAdmin: "系统管理员",
      create: "创建用户",
      name: "姓名",
      role: "角色",
      createdAt: "创建时间",
      actions: "操作",
      resetPassword: "重置密码",
      cannotDeleteOwner: "项目负责人",
      cannotDeleteSelf: "当前用户",
      delete: "删除",
      user: "用户",
      admin: "管理员",
    },
    projects: {
      createTitle: "创建项目",
      projectName: "项目名称",
      projectKey: "标识（2-4 位大写字母）",
      projectOwner: "项目负责人",
      projectMembers: "项目成员",
      description: "项目描述",
      descriptionPlaceholder: "可选说明...",
      create: "创建项目",
      noAssignableUsers: "没有可分配的非系统管理员用户。",
      noDescription: "暂无项目描述。",
      createdBy: "创建人",
      totalIssues: "个问题",
      teamAccess: "团队权限与角色",
      toggleAccess: "点击切换访问权限",
      demote: "点击降级为成员",
      promote: "点击提升为项目管理员",
      admin: "管理员",
      member: "成员",
      empty: "当前还没有项目。",
    },
  },
} as const;

function getDisplayName(user: UserRecord) {
  return user.name || user.email;
}

function getMemberDisplayName(member: ProjectMemberRecord) {
  return member.userName || member.userEmail || member.userId;
}

export default function AdminPanelClient({
  initialUsers,
  initialProjects,
  locale,
  currentUserId,
}: {
  initialUsers: UserRecord[];
  initialProjects: ProjectRecord[];
  locale: Locale;
  currentUserId: string;
}) {
  const [activeTab, setActiveTab] = useState<"USERS" | "PROJECTS">("USERS");
  const [errorMsg, setErrorMsg] = useState("");
  const text = TEXT[locale];

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <div className="flex w-fit gap-1 rounded-lg bg-slate-200/50 p-1">
        <button
          onClick={() => {
            setActiveTab("USERS");
            setErrorMsg("");
          }}
          className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all ${
            activeTab === "USERS" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Users size={16} /> {text.tabs.users}
        </button>
        <button
          onClick={() => {
            setActiveTab("PROJECTS");
            setErrorMsg("");
          }}
          className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all ${
            activeTab === "PROJECTS" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FolderGit2 size={16} /> {text.tabs.projects}
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {errorMsg}
        </div>
      )}

      <div className="flex flex-col gap-6 xl:flex-row">
        {activeTab === "USERS" ? (
          <UsersView
            users={initialUsers}
            setErrorMsg={setErrorMsg}
            locale={locale}
            currentUserId={currentUserId}
          />
        ) : (
          <ProjectsView
            projects={initialProjects}
            users={initialUsers}
            setErrorMsg={setErrorMsg}
            locale={locale}
          />
        )}
      </div>
    </div>
  );
}

function UsersView({ users, setErrorMsg, locale, currentUserId }: UsersViewProps) {
  const text = TEXT[locale];
  const [isPending, startTransition] = useTransition();
  const [isResettingPassword, startResetPasswordTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<NewUserForm>({
    name: "",
    email: "",
    password: generateDefaultPassword(),
    role: "USER",
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    startTransition(async () => {
      const res = await createUser(newUser);
      if (res.success) {
        setNewUser({ name: "", email: "", password: generateDefaultPassword(), role: "USER" });
        setShowPassword(false);
      } else {
        setErrorMsg(res.error || text.errors.createUser);
      }
    });
  };

  const handleDeleteUser = (userId: string) => {
    setErrorMsg("");
    startTransition(async () => {
      const res = await deleteUser(userId);
      if (!res.success) {
        setErrorMsg(res.error || text.errors.deleteUser);
      }
    });
  };

  const handleResetPassword = (userId: string) => {
    setErrorMsg("");
    setResettingPasswordUserId(userId);
    startResetPasswordTransition(async () => {
      try {
        const res = await resetUserPassword(userId);
        if (!res.success || !res.password) {
          setErrorMsg(res.error || text.errors.resetPassword);
          return;
        }
        setRevealedPasswords((prev) => ({ ...prev, [userId]: res.password }));
      } finally {
        setResettingPasswordUserId(null);
      }
    });
  };

  return (
    <>
      <div className="h-fit rounded-xl border bg-white p-6 shadow-sm xl:w-1/3">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
          <Plus size={18} className="text-blue-600" /> {text.users.addTitle}
        </h3>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{text.users.fullName}</label>
            <input
              required
              type="text"
              value={newUser.name}
              onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{text.users.email}</label>
            <input
              required
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="jane@neo-jira.local"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{text.users.password}</label>
            <div className="flex gap-2">
              <input
                required
                minLength={8}
                type={showPassword ? "text" : "password"}
                value={newUser.password}
                onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? text.users.hide : text.users.show}
                aria-label={showPassword ? text.users.hide : text.users.show}
                className="inline-flex items-center rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                type="button"
                onClick={() => setNewUser((p) => ({ ...p, password: generateDefaultPassword() }))}
                title={text.users.generate}
                aria-label={text.users.generate}
                className="inline-flex items-center rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">{text.users.passwordRule}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{text.users.systemRole}</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as NewUserForm["role"] }))}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="USER">{text.users.baseUser}</option>
              <option value="ADMIN">{text.users.systemAdmin}</option>
            </select>
          </div>
          <button
            disabled={isPending}
            type="submit"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 py-2 font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending && <Loader2 size={16} className="animate-spin" />} {text.users.create}
          </button>
        </form>
      </div>

      <div className="h-fit flex-1 overflow-hidden rounded-xl border bg-white shadow-sm xl:w-2/3">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="border-b px-5 py-4">{text.users.name}</th>
              <th className="border-b px-5 py-4">{text.users.email}</th>
              <th className="w-32 border-b px-5 py-4">{text.users.role}</th>
              <th className="w-40 border-b px-5 py-4">{text.users.createdAt}</th>
              <th className="w-72 border-b px-5 py-4">{text.users.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              const isOwner = u.ownedProjectsCount > 0;
              const disableDelete = isSelf || isOwner || isPending;
              const isResettingThisUser = isResettingPassword && resettingPasswordUserId === u.id;
              return (
                <tr key={u.id} className="transition-colors hover:bg-slate-50">
                  <td className="flex items-center gap-3 px-5 py-3 font-medium text-slate-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                      {getDisplayName(u).charAt(0).toUpperCase()}
                    </div>
                    {getDisplayName(u)}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{u.email}</td>
                  <td className="px-5 py-3">
                    {u.role === "ADMIN" ? (
                      <span className="flex w-fit items-center gap-1 rounded bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">
                        <Shield size={12} /> {text.users.admin}
                      </span>
                    ) : (
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{text.users.user}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs font-medium text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          disabled={isResettingThisUser}
                          onClick={() => handleResetPassword(u.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                        >
                          {isResettingThisUser ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                          {text.users.resetPassword}
                        </button>
                        <button
                          type="button"
                          disabled={disableDelete}
                          onClick={() => handleDeleteUser(u.id)}
                          title={isOwner ? text.users.cannotDeleteOwner : isSelf ? text.users.cannotDeleteSelf : text.users.delete}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 size={12} />
                          {text.users.delete}
                        </button>
                      </div>
                      {revealedPasswords[u.id] && (
                        <div className="max-w-72 truncate rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                          {revealedPasswords[u.id]}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProjectsView({ projects, users, setErrorMsg, locale }: ProjectsViewProps) {
  const text = TEXT[locale];
  const extraText =
    locale === "zh"
      ? {
          addMembers: "添加成员",
          confirmAdd: "确认添加",
          remove: "移除",
          owner: "负责人",
          noMembers: "暂无成员",
          changeOwner: "更改项目负责人",
          saveOwner: "更新负责人",
          selectOwner: "通过菜单选择负责人",
          ownerSelected: "已选负责人",
          selectMembers: "通过菜单选择成员",
          selectedMembers: "已选成员",
          updateOwnerFailed: "更新负责人失败",
        }
      : {
          addMembers: "Add Members",
          confirmAdd: "Add Selected",
          remove: "Remove",
          owner: "Owner",
          noMembers: "No members.",
          changeOwner: "Change Project Owner",
          saveOwner: "Update Owner",
          selectOwner: "Select owner from menu",
          ownerSelected: "Selected owner",
          selectMembers: "Select members from menu",
          selectedMembers: "Selected members",
          updateOwnerFailed: "Failed to update project owner",
        };
  const router = useRouter();
  const [isCreatingProject, startCreateTransition] = useTransition();
  const [isUpdatingMembers, startUpdateTransition] = useTransition();
  const [isChangingOwner, startOwnerTransition] = useTransition();
  const [changingOwnerProjectId, setChangingOwnerProjectId] = useState<string | null>(null);
  const assignableUsers = users.filter((u) => u.role !== "ADMIN");
  const [pendingAddMemberIds, setPendingAddMemberIds] = useState<Record<string, string[]>>({});
  const [pendingOwnerByProject, setPendingOwnerByProject] = useState<Record<string, string>>({});
  const [newProject, setNewProject] = useState<NewProjectForm>({
    name: "",
    key: "",
    description: "",
    ownerId: "",
    memberIds: [],
  });
  const selectedNewOwner = assignableUsers.find((u) => u.id === newProject.ownerId);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!newProject.ownerId) {
      setErrorMsg(text.errors.ownerRequired);
      return;
    }
    if (newProject.memberIds.length < 1) {
      setErrorMsg(text.errors.memberRequired);
      return;
    }

    const memberIds = newProject.memberIds.includes(newProject.ownerId)
      ? Array.from(new Set(newProject.memberIds))
      : Array.from(new Set([...newProject.memberIds, newProject.ownerId]));

    startCreateTransition(async () => {
      const res = await createProject({
        name: newProject.name,
        key: newProject.key,
        description: newProject.description,
        ownerId: newProject.ownerId,
        memberIds,
      });
      if (res.success) {
        setNewProject({ name: "", key: "", description: "", ownerId: "", memberIds: [] });
        router.refresh();
      } else {
        setErrorMsg(res.error || text.errors.createProject);
      }
    });
  };

  const toggleCreateProjectMember = (userId: string, checked: boolean) => {
    setNewProject((prev) => ({
      ...prev,
      memberIds: checked
        ? Array.from(new Set([...prev.memberIds, userId]))
        : prev.memberIds.filter((id) => id !== userId),
    }));
  };

  const togglePendingMember = (projectId: string, userId: string, checked: boolean) => {
    setPendingAddMemberIds((prev) => {
      const current = prev[projectId] || [];
      const next = checked ? Array.from(new Set([...current, userId])) : current.filter((id) => id !== userId);
      return { ...prev, [projectId]: next };
    });
  };

  const addSelectedMembers = (project: ProjectRecord) => {
    const selected = pendingAddMemberIds[project.id] || [];
    if (selected.length === 0) return;

    const currentMemberIds = project.members.map((m) => m.userId);
    const nextMemberIds = Array.from(new Set([...currentMemberIds, ...selected]));

    startUpdateTransition(async () => {
      const res = await updateProjectMembers(project.id, nextMemberIds);
      if (!res.success) {
        setErrorMsg(res.error || text.errors.updateAccess);
        return;
      }

      setPendingAddMemberIds((prev) => ({ ...prev, [project.id]: [] }));
      router.refresh();
    });
  };

  const removeMember = (project: ProjectRecord, userId: string) => {
    if (project.ownerId === userId) return;
    const nextMemberIds = project.members.map((m) => m.userId).filter((id) => id !== userId);

    startUpdateTransition(async () => {
      const res = await updateProjectMembers(project.id, nextMemberIds);
      if (!res.success) {
        setErrorMsg(res.error || text.errors.updateAccess);
        return;
      }
      router.refresh();
    });
  };

  const changeProjectOwner = (project: ProjectRecord) => {
    const nextOwnerId = pendingOwnerByProject[project.id] || project.ownerId;
    if (!nextOwnerId || nextOwnerId === project.ownerId) return;
    if (changingOwnerProjectId && changingOwnerProjectId !== project.id) return;

    startOwnerTransition(async () => {
      setChangingOwnerProjectId(project.id);
      try {
        const res = await updateProjectOwner(project.id, nextOwnerId);
        if (!res.success) {
          setErrorMsg(res.error || extraText.updateOwnerFailed);
          return;
        }
        router.refresh();
      } finally {
        setChangingOwnerProjectId(null);
      }
    });
  };

  return (
    <>
      <div className="h-fit rounded-xl border bg-white p-6 shadow-sm xl:w-1/3">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
          <Plus size={18} className="text-emerald-600" /> {text.projects.createTitle}
        </h3>
        {assignableUsers.length === 0 && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {text.projects.noAssignableUsers}
          </div>
        )}
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{text.projects.projectName}</label>
            <input
              required
              type="text"
              value={newProject.name}
              onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Frontend App"
              disabled={assignableUsers.length === 0}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{text.projects.projectKey}</label>
            <input
              required
              type="text"
              maxLength={4}
              pattern="[A-Z]+"
              value={newProject.key}
              onChange={(e) => setNewProject((p) => ({ ...p, key: e.target.value.toUpperCase() }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
              placeholder="FE"
              disabled={assignableUsers.length === 0}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{text.projects.projectOwner}</label>
            <details className="rounded-md border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm text-slate-700 [&::-webkit-details-marker]:hidden">
                <span>
                  {newProject.ownerId
                    ? `${extraText.ownerSelected}: ${selectedNewOwner ? getDisplayName(selectedNewOwner) : newProject.ownerId}`
                    : extraText.selectOwner}
                </span>
                <ChevronDown size={14} className="text-slate-500" />
              </summary>
              <div className="max-h-40 space-y-1 overflow-y-auto border-t border-slate-200 bg-slate-50 p-2">
                {assignableUsers.map((u) => {
                  const checked = newProject.ownerId === u.id;
                  return (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-white">
                      <input
                        type="radio"
                        name="new-project-owner"
                        checked={checked}
                        onChange={() => setNewProject((p) => ({ ...p, ownerId: u.id }))}
                        disabled={assignableUsers.length === 0}
                      />
                      <span className="text-sm text-slate-700">{getDisplayName(u)}</span>
                    </label>
                  );
                })}
              </div>
            </details>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{text.projects.projectMembers}</label>
            <details className="rounded-md border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm text-slate-700 [&::-webkit-details-marker]:hidden">
                <span>
                  {newProject.memberIds.length > 0
                    ? `${extraText.selectedMembers}: ${newProject.memberIds.length}`
                    : extraText.selectMembers}
                </span>
                <ChevronDown size={14} className="text-slate-500" />
              </summary>
              <div className="max-h-40 space-y-1 overflow-y-auto border-t border-slate-200 bg-slate-50 p-2">
                {assignableUsers.map((u) => {
                  const checked = newProject.memberIds.includes(u.id);
                  return (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-white">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleCreateProjectMember(u.id, e.target.checked)}
                        disabled={assignableUsers.length === 0}
                      />
                      <span className="text-sm text-slate-700">{getDisplayName(u)}</span>
                    </label>
                  );
                })}
              </div>
            </details>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{text.projects.description}</label>
            <textarea
              value={newProject.description}
              onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))}
              className="h-20 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder={text.projects.descriptionPlaceholder}
              disabled={assignableUsers.length === 0}
            />
          </div>
          <button
            disabled={isCreatingProject || assignableUsers.length === 0}
            type="submit"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 py-2 font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {isCreatingProject && <Loader2 size={16} className="animate-spin" />} {text.projects.create}
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-4 xl:w-2/3">
        {projects.map((p) => {
          const orderedMembers = [...p.members].sort((a, b) => {
            const roleA = a.role;
            const roleB = b.role;
            if (roleA === "ADMIN" && roleB !== "ADMIN") return -1;
            if (roleA !== "ADMIN" && roleB === "ADMIN") return 1;
            return getMemberDisplayName(a).localeCompare(getMemberDisplayName(b));
          });
          const memberIds = new Set(p.members.map((m) => m.userId));
          const candidateUsers = assignableUsers.filter((u) => !memberIds.has(u.id));
          const selectedToAdd = pendingAddMemberIds[p.id] || [];
          const selectedOwnerId = pendingOwnerByProject[p.id] || p.ownerId;
          const isChangingOwnerThisProject = isChangingOwner && changingOwnerProjectId === p.id;

          return (
            <div
              key={p.id}
              className="flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm transition-colors hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-3">
                    <h4 className="text-lg font-bold text-slate-800">{p.name}</h4>
                    <span className="rounded border bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-slate-600">
                      {p.key}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{p.description || text.projects.noDescription}</p>
                </div>
                <div className="rounded border border-slate-100 bg-slate-50 p-2 text-right text-xs">
                  <div className="text-slate-400">
                    <span className="font-bold text-slate-700">{p.issuesCount}</span> {text.projects.totalIssues}
                  </div>
                </div>
              </div>

              <div className="mt-2 border-t pt-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h5 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-700">
                    <Users size={14} /> {text.projects.teamAccess}
                  </h5>
                  <details className="relative">
                    <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                      <UserPlus size={12} />
                      {extraText.addMembers}
                      <ChevronDown size={12} />
                    </summary>
                    <div className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                      {candidateUsers.length === 0 ? (
                        <p className="px-1 py-2 text-xs text-slate-500">{text.projects.noAssignableUsers}</p>
                      ) : (
                        <div className="max-h-44 space-y-1 overflow-y-auto">
                          {candidateUsers.map((u) => {
                            const checked = selectedToAdd.includes(u.id);
                            return (
                              <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => togglePendingMember(p.id, u.id, e.target.checked)}
                                />
                                <span className="text-sm text-slate-700">{getDisplayName(u)}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => addSelectedMembers(p)}
                        disabled={isUpdatingMembers || selectedToAdd.length === 0}
                        className="mt-2 w-full rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isUpdatingMembers && <Loader2 size={12} className="mr-1 inline animate-spin" />}
                        {extraText.confirmAdd}
                      </button>
                    </div>
                  </details>
                </div>

                <div className="flex flex-wrap gap-2">
                  {orderedMembers.map((member) => {
                    const isOwner = member.userId === p.ownerId;
                    const isProjectAdmin = member.role === "ADMIN";
                    return (
                      <div
                        key={member.userId}
                        className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5"
                      >
                        <span className="text-sm font-medium text-slate-800">{getMemberDisplayName(member)}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                            isOwner
                              ? "bg-amber-100 text-amber-700"
                              : isProjectAdmin
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {isOwner ? (
                            <span className="inline-flex items-center gap-1">
                              <Crown size={12} />
                              {extraText.owner}
                            </span>
                          ) : isProjectAdmin ? (
                            text.projects.admin
                          ) : (
                            text.projects.member
                          )}
                        </span>
                        {!isOwner && (
                          <button
                            type="button"
                            onClick={() => removeMember(p, member.userId)}
                            disabled={isUpdatingMembers}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50"
                            title={extraText.remove}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {orderedMembers.length === 0 && <p className="text-sm text-slate-500">{extraText.noMembers}</p>}

                <div className="mt-4 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">{extraText.changeOwner}</label>
                    <select
                      value={selectedOwnerId}
                      onChange={(e) => setPendingOwnerByProject((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      disabled={isChangingOwnerThisProject || orderedMembers.length === 0}
                    >
                      {orderedMembers.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {getMemberDisplayName(member)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeProjectOwner(p)}
                    disabled={isChangingOwnerThisProject || selectedOwnerId === p.ownerId || orderedMembers.length === 0}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber-600 px-3 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {isChangingOwnerThisProject && <Loader2 size={14} className="animate-spin" />}
                    {extraText.saveOwner}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {projects.length === 0 && (
          <div className="rounded-xl border border-dashed bg-white p-8 text-center font-medium text-slate-500">
            {text.projects.empty}
          </div>
        )}
      </div>
    </>
  );
}
