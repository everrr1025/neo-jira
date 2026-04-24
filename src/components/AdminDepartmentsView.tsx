"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, UserPlus } from "lucide-react";
import { createDepartment, setDepartmentMemberRole, deleteDepartment, addMemberToDepartment, removeMemberFromDepartment } from "@/app/actions/departments";
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

type UserRecord = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type Props = {
  departments: DepartmentRecord[];
  users: UserRecord[];
  setErrorMsg: (msg: string) => void;
  locale: Locale;
};

const TEXT = {
  en: {
    createTitle: "Create Department",
    deptName: "Department Name",
    deptKey: "Department Key",
    description: "Description",
    descPlaceholder: "Optional details...",
    assignHead: "Assign Department Head (Optional)",
    selectUser: "Select a user...",
    create: "Create Department",
    department: "Department",
    head: "Head",
    action: "Action",
    empty: "No departments created yet.",
    projects: "projects",
    noHead: "No Head Assigned",
    assignHeadAction: "Assign Head...",
    members: "Members",
    addMember: "Add member...",
    removeMember: "Remove",
    deleteFailed: "Failed to delete department",
    createFailed: "Failed to create department",
    assignFailed: "Failed to assign department head",
    deleteConfirm: "Are you sure you want to delete this department?",
  },
  zh: {
    createTitle: "创建部门",
    deptName: "部门名称",
    deptKey: "部门标识",
    description: "描述",
    descPlaceholder: "可选说明...",
    assignHead: "指派部门负责人（可选）",
    selectUser: "选择用户...",
    create: "创建部门",
    department: "部门",
    head: "负责人",
    action: "操作",
    empty: "暂无部门。",
    projects: "个项目",
    noHead: "未指派负责人",
    assignHeadAction: "指派负责人...",
    members: "成员",
    addMember: "添加成员...",
    removeMember: "移除",
    deleteFailed: "删除部门失败",
    createFailed: "创建部门失败",
    assignFailed: "指派部门负责人失败",
    deleteConfirm: "确定要删除该部门吗？",
  },
} as const;

export default function AdminDepartmentsView({ departments, users, setErrorMsg, locale }: Props) {
  const t = TEXT[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newDept, setNewDept] = useState({ name: "", key: "", description: "", headUserId: "" });
  const assignableUsers = users.filter((u) => u.role !== "ADMIN");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    startTransition(async () => {
      const res = await createDepartment(newDept);
      if (res.success) {
        setNewDept({ name: "", key: "", description: "", headUserId: "" });
        router.refresh();
      } else {
        setErrorMsg(res.error || t.createFailed);
      }
    });
  };

  const handleSetHead = (departmentId: string, userId: string) => {
    setErrorMsg("");
    startTransition(async () => {
      const res = await setDepartmentMemberRole(departmentId, userId, "HEAD");
      if (!res.success) {
        setErrorMsg(res.error || t.assignFailed);
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = (departmentId: string) => {
    if (!confirm(t.deleteConfirm)) return;
    setErrorMsg("");
    startTransition(async () => {
      const res = await deleteDepartment(departmentId);
      if (!res.success) {
        setErrorMsg(res.error || t.deleteFailed);
        return;
      }
      router.refresh();
    });
  };

  const handleAddMember = (departmentId: string, userId: string) => {
    setErrorMsg("");
    startTransition(async () => {
      const res = await addMemberToDepartment(departmentId, userId);
      if (!res.success) setErrorMsg(res.error || "Failed");
      else router.refresh();
    });
  };

  const handleRemoveMember = (departmentId: string, userId: string) => {
    setErrorMsg("");
    startTransition(async () => {
      const res = await removeMemberFromDepartment(departmentId, userId);
      if (!res.success) setErrorMsg(res.error || "Failed");
      else router.refresh();
    });
  };

  return (
    <>
      <div className="h-fit rounded-xl border bg-white p-6 shadow-sm xl:w-1/3">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
          <Plus size={18} className="text-emerald-600" /> {t.createTitle}
        </h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{t.deptName}</label>
            <input
              required
              value={newDept.name}
              onChange={(e) => setNewDept((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder={locale === "zh" ? "例如：工程部" : "e.g. Engineering"}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{t.deptKey}</label>
            <input
              required
              maxLength={10}
              value={newDept.key}
              onChange={(e) => setNewDept((p) => ({ ...p, key: e.target.value.toUpperCase() }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
              placeholder={locale === "zh" ? "例如：ENG" : "e.g. ENG"}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{t.description}</label>
            <textarea
              rows={2}
              value={newDept.description}
              onChange={(e) => setNewDept((p) => ({ ...p, description: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder={t.descPlaceholder}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">{t.assignHead}</label>
            <select
              value={newDept.headUserId}
              onChange={(e) => setNewDept((p) => ({ ...p, headUserId: e.target.value }))}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">{t.selectUser}</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>
          <button
            disabled={isPending}
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 py-2 font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending && <Loader2 size={16} className="animate-spin" />} {t.create}
          </button>
        </form>
      </div>

      <div className="h-fit flex-1 overflow-hidden rounded-xl border bg-white shadow-sm xl:w-2/3">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="border-b px-5 py-4">{t.department}</th>
              <th className="border-b px-5 py-4">{t.head}</th>
              <th className="border-b px-5 py-4">{t.members}</th>
              <th className="border-b px-5 py-4">{t.action}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {departments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                  {t.empty}
                </td>
              </tr>
            ) : (
              departments.map((dept) => {
                const head = dept.members.find((m) => m.role === "HEAD");
                const regularMembers = dept.members.filter((m) => m.role !== "HEAD");
                const deptMemberIds = new Set(dept.members.map(m => m.userId));
                const addableUsers = assignableUsers.filter(u => !deptMemberIds.has(u.id));
                return (
                  <tr key={dept.id} className="hover:bg-slate-50 align-top">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800">{dept.name}</div>
                      <div className="text-xs font-mono text-slate-500">{dept.key}</div>
                      <div className="text-xs text-slate-400 mt-1">{dept.projectsCount} {t.projects}</div>
                    </td>
                    <td className="px-5 py-4">
                      {head ? (
                        <div className="font-medium text-blue-700">
                          {head.userName || head.userEmail}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <span className="text-slate-400 text-xs italic">{t.noHead}</span>
                          <select
                            className="w-48 rounded bg-white border border-slate-300 px-2 py-1 text-xs"
                            onChange={(e) => {
                              if (e.target.value) handleSetHead(dept.id, e.target.value);
                            }}
                            defaultValue=""
                          >
                            <option value="">{t.assignHeadAction}</option>
                            {assignableUsers.map(u => (
                              <option key={u.id} value={u.id}>{u.name || u.email}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        {regularMembers.map((m) => (
                          <div key={m.userId} className="flex items-center gap-1 text-xs">
                            <span className="text-slate-700">{m.userName || m.userEmail}</span>
                            <button
                              onClick={() => handleRemoveMember(dept.id, m.userId)}
                              disabled={isPending}
                              className="text-red-400 hover:text-red-600 disabled:opacity-50"
                              title={t.removeMember}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                        <select
                          className="mt-1 w-40 rounded bg-white border border-slate-200 px-2 py-1 text-xs text-slate-500"
                          onChange={(e) => {
                            if (e.target.value) handleAddMember(dept.id, e.target.value);
                            e.target.value = "";
                          }}
                          defaultValue=""
                        >
                          <option value="">
                            <UserPlus size={10} />{t.addMember}
                          </option>
                          {addableUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name || u.email}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleDelete(dept.id)}
                        disabled={isPending}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
