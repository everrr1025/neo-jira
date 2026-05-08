"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Building2, FolderGit2, Loader2, Plus, Trash2, Users, X } from "lucide-react";

import {
  createDepartmentProject,
  deleteDepartmentProject,
  setDepartmentMemberRole,
  updateDepartmentProject,
} from "@/app/actions/departments";
import DepartmentUpcomingItemsCard from "@/components/DepartmentUpcomingItemsCard";
import ProjectNavIcon from "@/components/ProjectNavIcon";
import type { DepartmentWorkspaceData, DepartmentWorkspaceProject } from "@/lib/departmentWorkspace";
import type {
  DepartmentReminderIssueOption,
  DepartmentReminderScopeOption,
  DepartmentUpcomingItem,
} from "@/lib/departmentReminders";
import type { Locale } from "@/lib/i18n";

const TEXT = {
  en: {
    workspace: "Department Workspace",
    head: "Head",
    assistant: "Assistant",
    member: "Member",
    members: "Members",
    projects: "Projects",
    issues: "Issues",
    announcements: "Announcements",
    noDescription: "No description provided.",
    noAnnouncements: "No department announcements yet.",
    noMembers: "No department members.",
    noProjects: "No projects created for this department yet.",
    latestAnnouncements: "Latest announcements",
    projectOverview: "Project overview",
    memberProjects: "Projects",
    role: "Role",
    email: "Email",
    name: "Name",
    actions: "Actions",
    setAssistant: "Set as Assistant",
    setMember: "Set as Member",
    createProject: "Create project",
    projectName: "Name",
    projectKey: "Key",
    projectDescription: "Description",
    projectNamePlaceholder: "e.g. Mobile App Upgrade",
    projectKeyPlaceholder: "e.g. APP",
    projectDescriptionPlaceholder: "Optional details...",
    deleteProject: "Delete",
    memberButton: "Members",
    create: "Create",
    cancel: "Cancel",
    memberListHint:
      "Department heads can only set assistants here. Adding or removing department members stays with system admins.",
    projectNameRequired: "Project name and key are required.",
    projectKeyExists: "Project key already exists.",
    projectMembersScope: "Project members must belong to this department.",
    projectOwnerRequired: "Project owner must be selected from project members.",
    projectNotFound: "Project not found.",
    projectDeleteFailed: "Failed to delete project.",
    projectCreateFailed: "Failed to create project.",
    memberRoleFailed: "Failed to update member role.",
    ownerLabel: "Owner",
    currentUser: "Current user",
    pinned: "Pinned",
    createdAt: "Created",
    key: "Key",
    description: "Description",
    viewProject: "View",
    page: "Page",
    previous: "Previous",
    next: "Next",
    departmentDescription: "Department description",
    deleteWarning: "Delete this project? All related project data will be removed.",
    typeToConfirm: "Please type the exact project name to confirm:",
    deleteNameMismatch: "Project name confirmation does not match.",
    unassignedOwner: "Unassigned",
  },
  zh: {
    workspace: "部门工作台",
    head: "负责人",
    assistant: "助理",
    member: "成员",
    members: "成员",
    projects: "项目",
    issues: "问题",
    announcements: "通知",
    noDescription: "暂无描述",
    noAnnouncements: "暂无部门通知。",
    noMembers: "暂无部门成员。",
    noProjects: "该部门暂未创建项目。",
    latestAnnouncements: "最新通知",
    projectOverview: "项目概览",
    memberProjects: "所属项目",
    role: "角色",
    email: "邮箱",
    name: "姓名",
    actions: "操作",
    setAssistant: "设为助理",
    setMember: "设为成员",
    createProject: "创建项目",
    projectName: "名称",
    projectKey: "标识",
    projectDescription: "描述",
    projectNamePlaceholder: "例如：移动端升级",
    projectKeyPlaceholder: "例如：APP",
    projectDescriptionPlaceholder: "可选说明...",
    deleteProject: "删除",
    memberButton: "成员",
    create: "创建",
    cancel: "取消",
    memberListHint: "部门负责人在这里仅可设置助理。添加或移出部门成员仍由系统管理员负责。",
    projectNameRequired: "项目名称和标识不能为空。",
    projectKeyExists: "项目标识已存在。",
    projectMembersScope: "项目成员必须属于当前部门。",
    projectOwnerRequired: "项目负责人必须从项目成员中选择。",
    projectNotFound: "项目不存在。",
    projectDeleteFailed: "删除项目失败。",
    projectCreateFailed: "创建项目失败。",
    memberRoleFailed: "更新成员角色失败。",
    ownerLabel: "负责人",
    currentUser: "当前用户",
    pinned: "置顶",
    createdAt: "创建时间",
    key: "标识",
    description: "描述",
    viewProject: "查看",
    page: "第",
    previous: "上一页",
    next: "下一页",
    departmentDescription: "部门描述",
    deleteWarning: "确定删除该项目吗？该项目的所有关联数据都会被删除。",
    typeToConfirm: "请输入准确的项目名称以确认删除：",
    deleteNameMismatch: "输入的项目名称不正确。",
    unassignedOwner: "未指派",
  },
} as const;

const MEMBER_PAGE_SIZE = 10;

const ROLE_BADGE: Record<string, { bg: string; text: string }> = {
  HEAD: { bg: "bg-amber-100", text: "text-amber-800" },
  ASSISTANT: { bg: "bg-blue-100", text: "text-blue-800" },
  MEMBER: { bg: "bg-slate-100", text: "text-slate-600" },
};

function displayMember(member: { userName: string | null; userEmail: string }) {
  return member.userName || member.userEmail;
}

export default function DepartmentManageClient({
  department,
  locale,
  currentUserId,
  isHead,
  canManageProjects,
  mode,
  upcomingItems = [],
  reminderProjectOptions = [],
  reminderIssueOptions = [],
  canCreateDepartmentReminder = false,
}: {
  department: DepartmentWorkspaceData;
  locale: Locale;
  currentUserId: string;
  isHead: boolean;
  canManageProjects: boolean;
  mode: "dashboard" | "members" | "projects";
  upcomingItems?: DepartmentUpcomingItem[];
  reminderProjectOptions?: DepartmentReminderScopeOption[];
  reminderIssueOptions?: DepartmentReminderIssueOption[];
  canCreateDepartmentReminder?: boolean;
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pageErrorMsg, setPageErrorMsg] = useState("");
  const [createProjectErrorMsg, setCreateProjectErrorMsg] = useState("");
  const [deleteErrorMsg, setDeleteErrorMsg] = useState("");
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<DepartmentWorkspaceProject | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [editingProject, setEditingProject] = useState<DepartmentWorkspaceProject | null>(null);
  const [memberPage, setMemberPage] = useState(1);
  const [newProject, setNewProject] = useState({
    name: "",
    key: "",
    description: "",
  });
  const [editProjectForm, setEditProjectForm] = useState({
    name: "",
    key: "",
    description: "",
  });

  const headName = department.headName || t.member;
  const currentMember = department.members.find((member) => member.userId === currentUserId) || null;
  const currentMemberRole = currentMember
    ? currentMember.role === "HEAD"
      ? t.head
      : currentMember.role === "ASSISTANT"
        ? t.assistant
        : t.member
    : null;
  const sortedMembers = [...department.members].sort((a, b) => {
    const order: Record<string, number> = { HEAD: 0, ASSISTANT: 1, MEMBER: 2 };
    return (order[a.role] ?? 3) - (order[b.role] ?? 3) || displayMember(a).localeCompare(displayMember(b));
  });

  const totalIssues = department.projects.reduce((sum, project) => sum + project.issuesCount, 0);
  const totalMemberPages = Math.max(1, Math.ceil(sortedMembers.length / MEMBER_PAGE_SIZE));
  const currentMemberPage = Math.min(memberPage, totalMemberPages);
  const paginatedMembers = sortedMembers.slice(
    (currentMemberPage - 1) * MEMBER_PAGE_SIZE,
    currentMemberPage * MEMBER_PAGE_SIZE
  );
  const summaryCards = useMemo(
    () => [
      { label: t.members, value: department.members.length, icon: Users },
      { label: t.projects, value: department.projects.length, icon: FolderGit2 },
      { label: t.issues, value: totalIssues, icon: Bell },
    ],
    [
      department.members.length,
      department.projects.length,
      t.issues,
      t.members,
      t.projects,
      totalIssues,
    ]
  );

  const translateError = (message: string | undefined, fallback: string) => {
    if (!message) return fallback;
    if (message.includes("Project name and key are required")) return t.projectNameRequired;
    if (message.includes("Project key already exists")) return t.projectKeyExists;
    if (message.includes("Selected project members must belong to this department")) return t.projectMembersScope;
    if (message.includes("Project owner must be selected from project members")) return t.projectOwnerRequired;
    if (message.includes("Project not found")) return t.projectNotFound;
    if (message.includes("Project name confirmation does not match")) return t.deleteNameMismatch;
    return message;
  };

  useEffect(() => {
    if (mode !== "dashboard") return;

    window.dispatchEvent(new CustomEvent("department-header-title", { detail: { title: department.name } }));
    return () => {
      window.dispatchEvent(new CustomEvent("department-header-title", { detail: { title: "" } }));
    };
  }, [department.name, mode]);

  const handleSetRole = (userId: string, role: "ASSISTANT" | "MEMBER") => {
    setPageErrorMsg("");
    startTransition(async () => {
      const res = await setDepartmentMemberRole(department.id, userId, role);
      if (!res.success) {
        setPageErrorMsg(translateError(res.error, t.memberRoleFailed));
        return;
      }
      router.refresh();
    });
  };

  const handleCreateProject = (event: React.FormEvent) => {
    event.preventDefault();
    setCreateProjectErrorMsg("");
    startTransition(async () => {
      const res = await createDepartmentProject(department.id, newProject);
      if (!res.success) {
        setCreateProjectErrorMsg(translateError(res.error, t.projectCreateFailed));
        return;
      }
      setIsCreateProjectOpen(false);
      setCreateProjectErrorMsg("");
      setNewProject({ name: "", key: "", description: "" });
      router.refresh();
    });
  };

  const handleDeleteProject = () => {
    if (!deletingProject) return;
    setDeleteErrorMsg("");
    startTransition(async () => {
      const res = await deleteDepartmentProject(department.id, deletingProject.id, deleteConfirmText);
      if (!res.success) {
        setDeleteErrorMsg(translateError(res.error, t.projectDeleteFailed));
        return;
      }
      setDeletingProject(null);
      setDeleteConfirmText("");
      router.refresh();
    });
  };

  const handleEditProject = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingProject) return;
    setCreateProjectErrorMsg("");
    startTransition(async () => {
      const res = await updateDepartmentProject(department.id, editingProject.id, editProjectForm);
      if (!res.success) {
        setCreateProjectErrorMsg(translateError(res.error, t.projectCreateFailed));
        return;
      }
      setIsEditProjectOpen(false);
      setEditingProject(null);
      setCreateProjectErrorMsg("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {mode === "dashboard" ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(390px,1fr)_minmax(220px,0.55fr)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-sm">
                <Building2 size={22} />
              </div>
              <div className="grid min-w-0 gap-3">
                <p className="text-sm leading-6 text-slate-600">{department.description || t.noDescription}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t.head}</span>
                  <span className="text-base font-semibold text-slate-900">{headName}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {summaryCards.map((card) => (
                <div key={card.label} className="rounded-xl bg-slate-50 px-5 py-4">
                  <span className="text-sm font-medium text-slate-500">{card.label}</span>
                  <div className="mt-3 text-2xl font-bold text-slate-900">{card.value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-slate-50 px-5 py-4">
              <p className="text-base font-semibold text-slate-900">
                {currentMember ? displayMember(currentMember) : "-"}
              </p>
              {currentMemberRole ? <p className="mt-1 text-sm text-slate-500">{currentMemberRole}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {pageErrorMsg ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {pageErrorMsg}
        </div>
      ) : null}

      {mode === "dashboard" ? (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <DepartmentUpcomingItemsCard
              departmentId={department.id}
              items={upcomingItems}
              locale={locale}
              canCreateDepartmentReminder={canCreateDepartmentReminder}
              projectOptions={reminderProjectOptions}
              issueOptions={reminderIssueOptions}
            />

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Bell size={18} className="text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900">{t.latestAnnouncements}</h3>
              </div>
              {department.announcements.length === 0 ? (
                <p className="text-sm text-slate-500">{t.noAnnouncements}</p>
              ) : (
                <div className="space-y-3">
                  {department.announcements.map((announcement) => (
                    <div key={announcement.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900">{announcement.title}</h4>
                        {announcement.isPinned ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            {t.pinned}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{announcement.content}</p>
                      <p className="mt-3 text-xs text-slate-400">
                        {announcement.authorName} ·{" "}
                        {new Date(announcement.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <FolderGit2 size={18} className="text-emerald-600" />
                <h3 className="text-lg font-semibold text-slate-900">{t.projectOverview}</h3>
              </div>
              {department.projects.length === 0 ? (
                <p className="text-sm text-slate-500">{t.noProjects}</p>
              ) : (
                <div className="space-y-3">
                  {department.projects.map((project) => (
                    <div key={project.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-900">{project.name}</h4>
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                              {project.key}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-500">{project.description || t.noDescription}</p>
                          <p className="mt-3 text-xs text-slate-400">
                            {t.ownerLabel}: {project.ownerName || t.unassignedOwner}
                          </p>
                        </div>
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {project.issuesCount} {t.issues}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {mode === "members" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">{t.members}</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="border-b px-5 py-4">{t.name}</th>
                  <th className="border-b px-5 py-4">{t.email}</th>
                  <th className="border-b px-5 py-4">{t.role}</th>
                  <th className="border-b px-5 py-4">{t.memberProjects}</th>
                  <th className="border-b px-5 py-4">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      {t.noMembers}
                    </td>
                  </tr>
                ) : (
                  paginatedMembers.map((member) => {
                    const badge = ROLE_BADGE[member.role] || ROLE_BADGE.MEMBER;
                    const canToggleAssistant = isHead && member.role !== "HEAD" && member.userId !== currentUserId;
                    return (
                      <tr key={member.userId} className="align-top hover:bg-slate-50">
                        <td className="px-5 py-4 font-medium text-slate-800">
                          <span>{displayMember(member)}</span>
                        </td>
                        <td className="px-5 py-4 text-slate-500">{member.userEmail}</td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.bg} ${badge.text}`}>
                            {member.role === "HEAD" ? t.head : member.role === "ASSISTANT" ? t.assistant : t.member}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            {member.projects.length === 0 ? (
                              <span className="text-xs text-slate-400">-</span>
                            ) : (
                              member.projects.map((project) => (
                                <span
                                  key={project.id}
                                  className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                >
                                  <span>{project.name}</span>
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {canToggleAssistant ? (
                            member.role === "ASSISTANT" ? (
                              <button
                                type="button"
                                onClick={() => handleSetRole(member.userId, "MEMBER")}
                                disabled={isPending}
                                className="text-xs font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
                              >
                                {t.setMember}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetRole(member.userId, "ASSISTANT")}
                                disabled={isPending}
                                className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                              >
                                {t.setAssistant}
                              </button>
                            )
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {sortedMembers.length > 0 ? (
            <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              <span>
                {t.page} {currentMemberPage} / {totalMemberPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMemberPage(Math.max(1, currentMemberPage - 1))}
                  disabled={currentMemberPage === 1}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t.previous}
                </button>
                <button
                  type="button"
                  onClick={() => setMemberPage(Math.min(totalMemberPages, currentMemberPage + 1))}
                  disabled={currentMemberPage === totalMemberPages}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t.next}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "projects" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">{t.projects}</h2>
            {canManageProjects ? (
              <button
                type="button"
                onClick={() => {
                  setPageErrorMsg("");
                  setCreateProjectErrorMsg("");
                  setNewProject({ name: "", key: "", description: "" });
                  setIsCreateProjectOpen(true);
                }}
                className="inline-flex h-9 items-center gap-2 rounded bg-[#0052CC] px-3 text-sm font-semibold text-white hover:bg-[#003D9B]"
              >
                <Plus size={16} />
                {t.createProject}
              </button>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="w-[24%] px-5 py-4">{t.projectName}</th>
                    <th className="w-24 px-5 py-4">{t.key}</th>
                    <th className="w-[18%] px-5 py-4">{t.description}</th>
                    <th className="w-28 px-5 py-4">{t.ownerLabel}</th>
                    <th className="w-24 px-5 py-4">{t.members}</th>
                    <th className="w-32 px-5 py-4">{t.createdAt}</th>
                    <th className="w-64 px-5 py-4">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {department.projects.map((project) => (
                    <tr key={project.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                            <ProjectNavIcon className="h-[18px] w-[18px]" />
                          </div>
                          <Link
                            href={`/projects/select?projectId=${project.id}`}
                            className="font-semibold text-slate-800 transition-colors hover:text-emerald-700"
                          >
                            {project.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-slate-500">{project.key}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        <div className="max-w-sm truncate">{project.description || t.noDescription}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        {project.ownerId ? (
                          <span className="font-medium text-blue-700">{project.ownerName}</span>
                        ) : (
                          <span className="text-slate-400">{t.unassignedOwner}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {project.members.length} {t.members}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-medium text-slate-500">
                        {new Date(project.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                          <a
                            href={`/projects/select?projectId=${project.id}`}
                            className="inline-flex min-w-fit shrink-0 items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            <span className="whitespace-nowrap">{t.viewProject}</span>
                          </a>
                          <Link
                            href={`/departments/${department.id}/projects/${project.id}/members`}
                            className="inline-flex min-w-fit shrink-0 items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            <span className="whitespace-nowrap">{t.memberButton}</span>
                          </Link>
                          {canManageProjects ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProject(project);
                                  setEditProjectForm({
                                    name: project.name,
                                    key: project.key,
                                    description: project.description || "",
                                  });
                                  setCreateProjectErrorMsg("");
                                  setIsEditProjectOpen(true);
                                }}
                                disabled={isPending}
                                className="inline-flex min-w-fit shrink-0 items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                              >
                                <span className="whitespace-nowrap">{locale === "zh" ? "编辑" : "Edit"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteErrorMsg("");
                                  setDeleteConfirmText("");
                                  setDeletingProject(project);
                                }}
                                disabled={isPending}
                                className="inline-flex min-w-fit shrink-0 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                              >
                                <Trash2 size={12} />
                                <span className="whitespace-nowrap">{t.deleteProject}</span>
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {department.projects.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-slate-500">
                        {t.noProjects}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {isCreateProjectOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <h2 className="text-xl font-bold text-slate-900">{t.createProject}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateProjectOpen(false);
                      setCreateProjectErrorMsg("");
                    }}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleCreateProject} className="space-y-4 px-6 py-5">
                  {createProjectErrorMsg ? (
                    <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                      {createProjectErrorMsg}
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">{t.projectName}</label>
                    <input
                      required
                      value={newProject.name}
                      onChange={(event) => setNewProject((current) => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder={t.projectNamePlaceholder}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">{t.projectKey}</label>
                    <input
                      required
                      maxLength={10}
                      value={newProject.key}
                      onChange={(event) =>
                        setNewProject((current) => ({ ...current, key: event.target.value.toUpperCase() }))
                      }
                      className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
                      placeholder={t.projectKeyPlaceholder}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">{t.projectDescription}</label>
                    <textarea
                      rows={3}
                      value={newProject.description}
                      onChange={(event) =>
                        setNewProject((current) => ({ ...current, description: event.target.value }))
                      }
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder={t.projectDescriptionPlaceholder}
                    />
                  </div>
                  <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateProjectOpen(false);
                        setCreateProjectErrorMsg("");
                      }}
                      disabled={isPending}
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                      {t.create}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {isEditProjectOpen && editingProject ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <h2 className="text-xl font-bold text-slate-900">{locale === "zh" ? "编辑项目" : "Edit project"}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditProjectOpen(false);
                      setEditingProject(null);
                      setCreateProjectErrorMsg("");
                    }}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleEditProject} className="space-y-4 px-6 py-5">
                  {createProjectErrorMsg ? (
                    <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                      {createProjectErrorMsg}
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">{t.projectName}</label>
                    <input
                      required
                      value={editProjectForm.name}
                      onChange={(event) => setEditProjectForm((current) => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">{t.projectKey}</label>
                    <input
                      required
                      maxLength={10}
                      value={editProjectForm.key}
                      onChange={(event) =>
                        setEditProjectForm((current) => ({ ...current, key: event.target.value.toUpperCase() }))
                      }
                      className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">{t.projectDescription}</label>
                    <textarea
                      rows={3}
                      value={editProjectForm.description}
                      onChange={(event) =>
                        setEditProjectForm((current) => ({ ...current, description: event.target.value }))
                      }
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditProjectOpen(false);
                        setEditingProject(null);
                        setCreateProjectErrorMsg("");
                      }}
                      disabled={isPending}
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                      {locale === "zh" ? "保存" : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {deletingProject ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="border-b border-rose-100 bg-rose-50/50 px-6 py-4">
                  <h2 className="text-xl font-bold text-rose-600">{t.deleteProject}</h2>
                </div>
                <div className="px-6 py-5">
                  {deleteErrorMsg ? (
                    <div className="mb-4 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                      {deleteErrorMsg}
                    </div>
                  ) : null}
                  <p className="text-sm font-medium text-slate-700">{t.deleteWarning}</p>
                  <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-800">
                    {deletingProject.name} ({deletingProject.key})
                  </div>
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium text-slate-700">{t.typeToConfirm}</label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(event) => setDeleteConfirmText(event.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                      placeholder={deletingProject.name}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteErrorMsg("");
                      setDeletingProject(null);
                      setDeleteConfirmText("");
                    }}
                    disabled={isPending}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={isPending || deleteConfirmText !== deletingProject.name}
                    onClick={handleDeleteProject}
                    className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                    {t.deleteProject}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
