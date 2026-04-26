"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, Loader2, Plus, Trash2, Users, X } from "lucide-react";

import { createDepartment, deleteDepartment } from "@/app/actions/departments";
import type { Locale } from "@/lib/i18n";

type DepartmentMemberRecord = {
  userId: string;
  role: string;
  userEmail: string;
  userName: string | null;
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
  setErrorMsg?: (msg: string) => void;
  locale: Locale;
};

const TEXT = {
  en: {
    title: "Departments",
    subtitle: "Manage departments, heads, members, and related project totals.",
    createDepartment: "Add department",
    createTitle: "Create department",
    name: "Department",
    key: "Key",
    description: "Description",
    descPlaceholder: "Optional details...",
    head: "Head",
    members: "Members",
    projects: "Projects",
    createdAt: "Created",
    actions: "Actions",
    noHead: "No head assigned",
    manage: "Manage people",
    delete: "Delete",
    cancel: "Cancel",
    create: "Create department",
    empty: "No departments created yet.",
    memberCount: "members",
    projectCount: "projects",
    deleteConfirm: "Delete this department?",
    createFailed: "Failed to create department",
    deleteFailed: "Failed to delete department",
  },
  zh: {
    title: "部门",
    subtitle: "管理部门、负责人、成员和关联项目数量。",
    createDepartment: "新增部门",
    createTitle: "创建部门",
    name: "部门",
    key: "标识",
    description: "描述",
    descPlaceholder: "可选说明...",
    head: "负责人",
    members: "成员",
    projects: "项目",
    createdAt: "创建时间",
    actions: "操作",
    noHead: "未指派负责人",
    manage: "管理人员",
    delete: "删除",
    cancel: "取消",
    create: "创建部门",
    empty: "暂无部门。",
    memberCount: "名成员",
    projectCount: "个项目",
    deleteConfirm: "确定删除该部门吗？",
    createFailed: "创建部门失败",
    deleteFailed: "删除部门失败",
  },
} as const;

function displayMember(member: DepartmentMemberRecord) {
  return member.userName || member.userEmail;
}

export default function AdminDepartmentsView({ departments, setErrorMsg, locale }: Props) {
  const t = TEXT[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [localErrorMsg, setLocalErrorMsg] = useState("");
  const [newDept, setNewDept] = useState({ name: "", key: "", description: "" });

  const showError = (message: string) => {
    setLocalErrorMsg(message);
    setErrorMsg?.(message);
  };
  const clearError = () => showError("");

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    startTransition(async () => {
      const res = await createDepartment(newDept);
      if (!res.success) {
        showError(res.error || t.createFailed);
        return;
      }
      setNewDept({ name: "", key: "", description: "" });
      setIsCreateOpen(false);
      router.refresh();
    });
  };

  const handleDelete = (department: DepartmentRecord) => {
    if (!confirm(t.deleteConfirm)) return;
    clearError();
    startTransition(async () => {
      const res = await deleteDepartment(department.id);
      if (!res.success) {
        showError(res.error || t.deleteFailed);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">{t.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearError();
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus size={16} />
          {t.createDepartment}
        </button>
      </div>

      {localErrorMsg ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {localErrorMsg}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">{t.name}</th>
                <th className="px-5 py-4">{t.head}</th>
                <th className="px-5 py-4">{t.members}</th>
                <th className="px-5 py-4">{t.projects}</th>
                <th className="px-5 py-4">{t.createdAt}</th>
                <th className="w-64 px-5 py-4">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map((department) => {
                const head = department.members.find((member) => member.role === "HEAD");

                return (
                  <tr key={department.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{department.name}</div>
                          <div className="font-mono text-xs text-slate-500">{department.key}</div>
                          {department.description ? (
                            <div className="mt-1 max-w-xs truncate text-xs text-slate-400">{department.description}</div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {head ? (
                        <span className="font-medium text-blue-700">{displayMember(head)}</span>
                      ) : (
                        <span className="text-slate-400">{t.noHead}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {department.members.length} {t.memberCount}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {department.projectsCount} {t.projectCount}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-slate-500">
                      {new Date(department.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/departments/${department.id}/members`}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                        >
                          <Users size={12} />
                          {t.manage}
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(department)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                        >
                          <Trash2 size={12} />
                          {t.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-slate-500">
                    {t.empty}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">{t.createTitle}</h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">{t.name}</label>
                <input
                  required
                  value={newDept.name}
                  onChange={(event) => setNewDept((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder={locale === "zh" ? "例如：工程部" : "e.g. Engineering"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">{t.key}</label>
                <input
                  required
                  maxLength={10}
                  value={newDept.key}
                  onChange={(event) => setNewDept((current) => ({ ...current, key: event.target.value.toUpperCase() }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
                  placeholder={locale === "zh" ? "例如：ENG" : "e.g. ENG"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">{t.description}</label>
                <textarea
                  rows={3}
                  value={newDept.description}
                  onChange={(event) => setNewDept((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder={t.descPlaceholder}
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
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
    </div>
  );
}
