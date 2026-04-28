"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, Loader2, Pencil, Plus, Trash2, Users, X } from "lucide-react";

import { createDepartment, deleteDepartment, updateDepartment } from "@/app/actions/departments";
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
  locale: Locale;
};

const TEXT = {
  en: {
    title: "Departments",
    subtitle: "Manage departments, heads, members, and related project totals.",
    createDepartment: "Add department",
    createTitle: "Create department",
    editTitle: "Edit department",
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
    manage: "Members",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    create: "Create department",
    save: "Save changes",
    empty: "No departments created yet.",
    memberCount: "members",
    projectCount: "projects",
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
  },
  zh: {
    title: "部门",
    subtitle: "管理部门、负责人、成员和关联项目数量。",
    createDepartment: "新增部门",
    createTitle: "创建部门",
    editTitle: "编辑部门",
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
    manage: "成员",
    edit: "编辑",
    delete: "删除",
    cancel: "取消",
    create: "创建部门",
    save: "保存修改",
    empty: "暂无部门。",
    memberCount: "名成员",
    projectCount: "个项目",
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
  const [departmentForm, setDepartmentForm] = useState({ name: "", key: "", description: "" });

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
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">{t.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={openCreateDialog}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus size={16} />
          {t.createDepartment}
        </button>
      </div>

      {listErrorMsg ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {listErrorMsg}
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
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <Users size={12} />
                          {t.manage}
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditDialog(department)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Pencil size={12} />
                          {t.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            clearListError();
                            clearDeleteError();
                            setDeleteConfirmText("");
                            setDeletingDepartment(department);
                          }}
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

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">{editingDepartment ? t.editTitle : t.createTitle}</h2>
              <button
                type="button"
                onClick={closeFormDialog}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              {formErrorMsg ? (
                <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                  {formErrorMsg}
                </div>
              ) : null}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">{t.name}</label>
                <input
                  required
                  value={departmentForm.name}
                  onChange={(event) => setDepartmentForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder={locale === "zh" ? "例如：工程部" : "e.g. Engineering"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">{t.key}</label>
                <input
                  required
                  maxLength={10}
                  value={departmentForm.key}
                  onChange={(event) => setDepartmentForm((current) => ({ ...current, key: event.target.value.toUpperCase() }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
                  placeholder={locale === "zh" ? "例如：ENG" : "e.g. ENG"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">{t.description}</label>
                <textarea
                  rows={3}
                  value={departmentForm.description}
                  onChange={(event) => setDepartmentForm((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder={t.descPlaceholder}
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeFormDialog}
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
                  {editingDepartment ? t.save : t.create}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deletingDepartment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="border-b border-rose-100 bg-rose-50/50 px-6 py-4">
              <h2 className="text-xl font-bold text-rose-600">{t.delete}</h2>
            </div>
            <div className="px-6 py-5">
              {deleteErrorMsg ? (
                <div className="mb-4 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                  {deleteErrorMsg}
                </div>
              ) : null}
              <p className="text-sm font-medium text-slate-700">{t.deleteWarning}</p>
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-800">
                {deletingDepartment.name} ({deletingDepartment.key})
              </div>
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">{t.typeToConfirm}</label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(event) => setDeleteConfirmText(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                  placeholder={deletingDepartment.name}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  clearDeleteError();
                  setDeletingDepartment(null);
                  setDeleteConfirmText("");
                }}
                disabled={isPending}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={isPending || deleteConfirmText !== deletingDepartment.name}
                onClick={handleDelete}
                className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
