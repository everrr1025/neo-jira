"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
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
  Users,
  X,
} from "lucide-react";

import { createUser, deleteUser, resetUserPassword } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    addUser: "User",
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
    addUser: "用户",
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
  const [showPassword, setShowPassword] = useState(true);
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
  });

  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const rangeStart = totalUsers > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, totalUsers);
  const pageSizeOptions = [10, 20, 50].map((size) => ({ value: String(size), label: String(size) }));

  useEffect(() => {
    setQuery(search);
  }, [search]);

  useEffect(() => {
    const nextSearch = query.trim();
    if (nextSearch === search) return;

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (nextSearch) params.set("search", nextSearch);
      if (departmentId) params.set("departmentId", departmentId);
      params.set("page", "1");
      params.set("pageSize", String(pageSize));
      router.replace(`/admin/users?${params.toString()}`);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [departmentId, pageSize, query, router, search]);

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

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg("");
    startTransition(async () => {
      const res = await createUser(newUser);
      if (!res.success) {
        setErrorMsg(res.error || t.createFailed);
        return;
      }

      setNewUser({ name: "", email: "", password: "" });
      setShowPassword(true);
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
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <Button
          type="button"
          onClick={() => {
            setErrorMsg("");
            setShowPassword(true);
            setIsCreateOpen(true);
          }}
        >
          <Plus />
          {t.addUser}
        </Button>
      </div>

      {errorMsg && !isCreateOpen ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {errorMsg}
        </div>
      ) : null}

      <Card className="gap-0 py-0">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.search}
                className="pl-9"
              />
            </div>
            <Select
              value={departmentId || "all"}
              onValueChange={(value) => updateParams({ departmentId: value === "all" ? null : value, page: "1" })}
            >
              <SelectTrigger className="w-full sm:w-56" aria-label={t.departments}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allDepartments}</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/50">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="pl-6">{t.name}</TableHead>
                <TableHead>{t.email}</TableHead>
                <TableHead>{t.departments}</TableHead>
                <TableHead>{t.createdAt}</TableHead>
                <TableHead className="w-64">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                const isHead = user.headDepartmentsCount > 0;
                const disableDelete = isSelf || isHead || isPending;
                const isResettingThisUser = isResetting && resettingUserId === user.id;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                          {getDisplayName(user).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-medium text-foreground">
                            <span className="truncate">{getDisplayName(user)}</span>
                            {user.role === "ADMIN" ? (
                              <Badge variant="secondary">{t.adminBadge}</Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      {user.departments.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {user.departments.map((department) => (
                            <Badge key={department.id} variant="outline">{department.name}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">{t.noDepartment}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isResettingThisUser}
                            onClick={() => handleResetPassword(user.id)}
                          >
                            {isResettingThisUser ? <Loader2 className="animate-spin" /> : <KeyRound />}
                            {t.resetPassword}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={disableDelete}
                            onClick={() => setDeletingUser(user)}
                            title={isHead ? t.cannotDeleteHead : isSelf ? t.cannotDeleteSelf : t.delete}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 />
                            {t.delete}
                          </Button>
                        </div>
                        {revealedPasswords[user.id] ? (
                          <div className="max-w-64 truncate rounded-md border bg-muted/50 px-2 py-1 font-mono text-xs text-foreground">
                            {revealedPasswords[user.id]}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                    <Users className="mx-auto mb-3 size-8 opacity-35" />
                    {t.noUsers}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3 text-sm">
          <div className="text-muted-foreground">
            {t.showing} <span className="font-medium text-foreground">{rangeStart}</span> {t.to}{" "}
            <span className="font-medium text-foreground">{rangeEnd}</span> {t.of}{" "}
            <span className="font-medium text-foreground">{totalUsers}</span> {t.users}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
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
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => updateParams({ page: String(Math.max(1, page - 1)) })}
                disabled={page === 1}
              >
                <ArrowLeft />
              </Button>
              <span className="px-1 font-medium leading-none text-foreground">
                {locale === "zh" ? `${t.page} ${page} / ${totalPages} 页` : `${t.page} ${page} of ${totalPages}`}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => updateParams({ page: String(Math.min(totalPages, page + 1)) })}
                disabled={page >= totalPages}
              >
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={(open) => !isPending && setIsCreateOpen(open)}>
        <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-muted/35 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{t.createTitle}</DialogTitle>
              <DialogDescription className="sr-only">{t.createTitle}</DialogDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsCreateOpen(false)}
                disabled={isPending}
                aria-label={t.cancel}
              >
                <X />
              </Button>
            </div>
          </DialogHeader>
          <form onSubmit={handleCreate} autoComplete="off">
            <div className="space-y-5 p-6">
              {errorMsg ? (
                <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  {errorMsg}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="new-user-name">{t.fullName}</Label>
                <Input
                  id="new-user-name"
                  name="new-user-name"
                  required
                  autoComplete="off"
                  value={newUser.name}
                  onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-email">{t.email}</Label>
                <Input
                  id="new-user-email"
                  name="new-user-email"
                  required
                  type="email"
                  autoComplete="off"
                  value={newUser.email}
                  onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
                  placeholder="jane@neo-jira.local"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-password">{t.password}</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-user-password"
                    name="new-user-password"
                    required
                    minLength={8}
                    type={showPassword ? "text" : "password"}
                    autoComplete="off"
                    value={newUser.password}
                    onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPassword((value) => !value)}
                    title={showPassword ? t.hide : t.show}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setNewUser((current) => ({ ...current, password: generateDefaultPassword() }))}
                    title={t.generate}
                  >
                    <RefreshCw />
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{t.passwordRule}</p>
              </div>
            </div>
            <DialogFooter className="border-t bg-muted/35 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isPending}
              >
                {t.cancel}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : null}
                {t.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingUser)} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              {t.delete}
            </DialogTitle>
            <DialogDescription>{t.deleteWarning}</DialogDescription>
          </DialogHeader>
          {deletingUser ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm font-medium">
              {getDisplayName(deletingUser)} <span className="font-normal text-muted-foreground">({deletingUser.email})</span>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingUser(null)} disabled={isPending}>
              {t.cancel}
            </Button>
            <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={handleDelete}
              >
                {isPending ? <Loader2 className="animate-spin" /> : null}
                {t.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
