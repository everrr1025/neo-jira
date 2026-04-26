"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { createUser, deleteUser, resetUserPassword } from "@/app/actions/admin";
import { DropdownField } from "./DropdownField";
import type { Locale } from "@/lib/i18n";

type DepartmentOption = {
  id: string;
  name: string;
};

type UserRecord = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  departments: DepartmentOption[];
  headDepartmentsCount: number;
};

type Props = {
  users: UserRecord[];
  departments: DepartmentOption[];
  totalUsers: number;
  page: number;
  pageSize: number;
  search: string;
  departmentId: string;
  locale: Locale;
  currentUserId: string;
};

const SPECIAL_CHARS = "!@#$%^&*()-_=+[]{};:,.?/|";
const PASSWORD_POOLS = ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz", "0123456789", SPECIAL_CHARS];

const TEXT = {
  en: {
    title: "Users",
    subtitle: "Manage workspace users and department assignment.",
    addUser: "Add user",
    search: "Search name or email",
    allDepartments: "All departments",
    name: "Name",
    email: "Email",
    departments: "Departments",
    createdAt: "Created",
    actions: "Actions",
    createTitle: "Create user",
    fullName: "Full name",
    password: "Password",
    passwordRule: "At least 8 chars, and include at least 3 of uppercase/lowercase/number/special.",
    create: "Create user",
    cancel: "Cancel",
    generate: "Generate",
    show: "Show password",
    hide: "Hide password",
    resetPassword: "Reset",
    delete: "Delete",
    deleteWarning: "Delete this user? Assigned issues will become unassigned, and comments/attachments will be reassigned to you.",
    cannotDeleteHead: "Department head",
    cannotDeleteSelf: "Current user",
    noUsers: "No users match the current filters.",
    showing: "Showing",
    to: "to",
    of: "of",
    users: "users",
    perPage: "Per page",
    page: "Page",
    adminBadge: "Admin",
    noDepartment: "No department",
    createFailed: "Failed to create user",
    deleteFailed: "Failed to delete user",
    resetFailed: "Failed to reset password",
  },
  zh: {
    title: "用户",
    subtitle: "管理工作区用户与部门归属。",
    addUser: "新增用户",
    search: "搜索姓名或邮箱",
    allDepartments: "全部部门",
    name: "姓名",
    email: "邮箱",
    departments: "部门",
    createdAt: "创建时间",
    actions: "操作",
    createTitle: "创建用户",
    fullName: "姓名",
    password: "密码",
    passwordRule: "至少 8 位，并包含大写/小写/数字/特殊字符中的至少 3 项。",
    create: "创建用户",
    cancel: "取消",
    generate: "重新生成",
    show: "显示密码",
    hide: "隐藏密码",
    resetPassword: "重置",
    delete: "删除",
    deleteWarning: "确定删除该用户吗？经办的问题会变为未分配，评论和附件会转交给你。",
    cannotDeleteHead: "部门负责人",
    cannotDeleteSelf: "当前用户",
    noUsers: "当前筛选下没有用户。",
    showing: "显示",
    to: "到",
    of: "共",
    users: "个用户",
    perPage: "每页",
    page: "第",
    adminBadge: "管理员",
    noDepartment: "未分配部门",
    createFailed: "创建用户失败",
    deleteFailed: "删除用户失败",
    resetFailed: "重置密码失败",
  },
} as const;

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
  let password = PASSWORD_POOLS.slice(0, 3).map((pool) => pickChar(pool)).join("");
  const all = PASSWORD_POOLS.join("");
  while (password.length < Math.max(8, length)) {
    password += pickChar(all);
  }
  return shuffle(password);
}

function getDisplayName(user: UserRecord) {
  return user.name || user.email;
}

export default function AdminUsersClient({
  users,
  departments,
  totalUsers,
  page,
  pageSize,
  search,
  departmentId,
  locale,
  currentUserId,
}: Props) {
  const t = TEXT[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");
  const [query, setQuery] = useState(search);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: generateDefaultPassword(),
  });

  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const rangeStart = totalUsers > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, totalUsers);
  const departmentOptions = [
    { value: "", label: t.allDepartments },
    ...departments.map((department) => ({ value: department.id, label: department.name })),
  ];
  const pageSizeOptions = [10, 20, 50].map((size) => ({ value: String(size), label: String(size) }));

  const updateParams = (next: Record<string, string | null>) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (departmentId) params.set("departmentId", departmentId);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    router.push(`/admin/users?${params.toString()}`);
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    updateParams({ search: query.trim() || null, page: "1" });
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg("");
    startTransition(async () => {
      const res = await createUser(newUser);
      if (!res.success) {
        setErrorMsg(res.error || t.createFailed);
        return;
      }

      setNewUser({ name: "", email: "", password: generateDefaultPassword() });
      setShowPassword(false);
      setIsCreateOpen(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!deletingUser) return;
    setErrorMsg("");
    startTransition(async () => {
      const res = await deleteUser(deletingUser.id);
      if (!res.success) {
        setErrorMsg(res.error || t.deleteFailed);
      }
      setDeletingUser(null);
      router.refresh();
    });
  };

  const handleResetPassword = (userId: string) => {
    setErrorMsg("");
    setResettingUserId(userId);
    startResetTransition(async () => {
      const res = await resetUserPassword(userId);
      if (res.success && res.password) {
        setRevealedPasswords((current) => ({ ...current, [userId]: res.password }));
      } else {
        setErrorMsg(res.error || t.resetFailed);
      }
      setResettingUserId(null);
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">{t.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setErrorMsg("");
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus size={16} />
          {t.addUser}
        </button>
      </div>

      {errorMsg ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {errorMsg}
        </div>
      ) : null}

      <div className="sticky top-0 z-20 rounded-lg border bg-white p-3 shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-80">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.search}
              className="h-9 w-full rounded-md border border-slate-200 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <DropdownField
            id="department-filter"
            label={t.departments}
            value={departmentId}
            onChange={(value) => updateParams({ departmentId: value || null, page: "1" })}
            options={departmentOptions}
            hideLabel
            className="w-full sm:w-56"
          />
          <button
            type="submit"
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            {locale === "zh" ? "筛选" : "Filter"}
          </button>
        </form>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">{t.name}</th>
                <th className="px-5 py-4">{t.email}</th>
                <th className="px-5 py-4">{t.departments}</th>
                <th className="px-5 py-4">{t.createdAt}</th>
                <th className="w-72 px-5 py-4">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                const isHead = user.headDepartmentsCount > 0;
                const disableDelete = isSelf || isHead || isPending;
                const isResettingThisUser = isResetting && resettingUserId === user.id;

                return (
                  <tr key={user.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                          {getDisplayName(user).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-semibold text-slate-800">
                            <span className="truncate">{getDisplayName(user)}</span>
                            {user.role === "ADMIN" ? (
                              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                                {t.adminBadge}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{user.email}</td>
                    <td className="px-5 py-3.5">
                      {user.departments.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {user.departments.map((department) => (
                            <span key={department.id} className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                              {department.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">{t.noDepartment}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isResettingThisUser}
                            onClick={() => handleResetPassword(user.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50"
                          >
                            {isResettingThisUser ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                            {t.resetPassword}
                          </button>
                          <button
                            type="button"
                            disabled={disableDelete}
                            onClick={() => setDeletingUser(user)}
                            title={isHead ? t.cannotDeleteHead : isSelf ? t.cannotDeleteSelf : t.delete}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                            {t.delete}
                          </button>
                        </div>
                        {revealedPasswords[user.id] ? (
                          <div className="max-w-72 truncate rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                            {revealedPasswords[user.id]}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-slate-500">
                    {t.noUsers}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-5 py-3 text-sm">
          <div className="font-medium text-slate-500">
            {t.showing} <span className="font-bold text-slate-800">{rangeStart}</span> {t.to}{" "}
            <span className="font-bold text-slate-800">{rangeEnd}</span> {t.of}{" "}
            <span className="font-bold text-slate-800">{totalUsers}</span> {t.users}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-500">
              <span>{t.perPage}</span>
              <DropdownField
                id="user-page-size"
                label={t.perPage}
                value={String(pageSize)}
                onChange={(value) => updateParams({ pageSize: value, page: "1" })}
                options={pageSizeOptions}
                hideLabel
                className="w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateParams({ page: String(Math.max(1, page - 1)) })}
                disabled={page === 1}
                className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="px-2 font-medium leading-none text-slate-700">
                {locale === "zh" ? `${t.page} ${page} / ${totalPages} 页` : `${t.page} ${page} of ${totalPages}`}
              </span>
              <button
                type="button"
                onClick={() => updateParams({ page: String(Math.min(totalPages, page + 1)) })}
                disabled={page >= totalPages}
                className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
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
                <label className="mb-1 block text-xs font-bold text-slate-700">{t.fullName}</label>
                <input
                  required
                  value={newUser.name}
                  onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">{t.email}</label>
                <input
                  required
                  type="email"
                  value={newUser.email}
                  onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="jane@neo-jira.local"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">{t.password}</label>
                <div className="flex gap-2">
                  <input
                    required
                    minLength={8}
                    type={showPassword ? "text" : "password"}
                    value={newUser.password}
                    onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    title={showPassword ? t.hide : t.show}
                    className="inline-flex items-center rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewUser((current) => ({ ...current, password: generateDefaultPassword() }))}
                    title={t.generate}
                    className="inline-flex items-center rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">{t.passwordRule}</p>
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

      {deletingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="border-b border-rose-100 bg-rose-50/50 px-6 py-4">
              <h2 className="text-xl font-bold text-rose-600">{t.delete}</h2>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm font-medium text-slate-700">{t.deleteWarning}</p>
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-800">
                {getDisplayName(deletingUser)} ({deletingUser.email})
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                disabled={isPending}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={isPending}
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
