"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, Loader2, Plus, Search, Trash2, X } from "lucide-react";

import { createDepartment, deleteDepartment, updateDepartment } from "@/app/actions/departments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DropdownField } from "./DropdownField";
import type { Locale } from "@/lib/i18n";

type DepartmentMemberRecord = {
  userId: string;
  role: string;
  isDepartmentAdmin: boolean;
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
    createDepartment: "Department",
    search: "Search department name or key",
    createTitle: "Create department",
    editTitle: "Edit department",
    name: "Department",
    key: "Key",
    description: "Description",
    descPlaceholder: "Optional details...",
    head: "Department admin",
    members: "Members",
    projects: "Projects",
    createdAt: "Created",
    actions: "Actions",
    noHead: "No department admin",
    manage: "Members",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    create: "Create department",
    save: "Save changes",
    empty: "No departments created yet.",
    noResults: "No departments match the current search.",
    memberCount: "members",
    projectCount: "projects",
    showing: "Showing",
    to: "to",
    of: "of",
    departmentCount: "departments",
    perPage: "Per page",
    page: "Page",
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
    createDepartment: "部门",
    search: "搜索部门名称或标识",
    createTitle: "创建部门",
    editTitle: "编辑部门",
    name: "部门",
    key: "标识",
    description: "描述",
    descPlaceholder: "可选说明...",
    head: "部门管理员",
    members: "成员",
    projects: "项目",
    createdAt: "创建时间",
    actions: "操作",
    noHead: "未设置部门管理员",
    manage: "成员",
    edit: "编辑",
    delete: "删除",
    cancel: "取消",
    create: "创建部门",
    save: "保存修改",
    empty: "暂无部门。",
    noResults: "没有符合当前搜索条件的部门。",
    memberCount: "名成员",
    projectCount: "个项目",
    showing: "显示",
    to: "到",
    of: "共",
    departmentCount: "个部门",
    perPage: "每页",
    page: "第",
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
  const [search, setSearch] = useState("");
  const [departmentPage, setDepartmentPage] = useState(1);
  const [departmentPageSize, setDepartmentPageSize] = useState(10);
  const [departmentForm, setDepartmentForm] = useState({ name: "", key: "", description: "" });
  const normalizedSearch = search.trim().toLowerCase();
  const filteredDepartments = normalizedSearch
    ? departments.filter((department) =>
        `${department.name} ${department.key}`.toLowerCase().includes(normalizedSearch)
      )
    : departments;
  const totalDepartmentPages = Math.max(1, Math.ceil(filteredDepartments.length / departmentPageSize));
  const currentDepartmentPage = Math.min(departmentPage, totalDepartmentPages);
  const paginatedDepartments = filteredDepartments.slice(
    (currentDepartmentPage - 1) * departmentPageSize,
    currentDepartmentPage * departmentPageSize,
  );
  const departmentRangeStart = filteredDepartments.length > 0
    ? (currentDepartmentPage - 1) * departmentPageSize + 1
    : 0;
  const departmentRangeEnd = Math.min(currentDepartmentPage * departmentPageSize, filteredDepartments.length);
  const departmentPageSizeOptions = [10, 20, 50].map((size) => ({ value: String(size), label: String(size) }));

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
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setDepartmentPage(1);
              }}
              placeholder={t.search}
              className="pl-9"
            />
          </div>
          <Button type="button" onClick={openCreateDialog}>
            <Plus />
            {t.createDepartment}
          </Button>
        </div>
      </div>

      {listErrorMsg ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {listErrorMsg}
        </div>
      ) : null}

      <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/50">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="pl-6">{t.name}</TableHead>
                <TableHead>{t.head}</TableHead>
                <TableHead>{t.members}</TableHead>
                <TableHead>{t.projects}</TableHead>
                <TableHead>{t.createdAt}</TableHead>
                <TableHead className="w-px pl-0 text-left">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDepartments.map((department) => {
                const head = department.members.find((member) => member.isDepartmentAdmin);

                return (
                  <TableRow key={department.id}>
                    <TableCell className="pl-6">
                      <div>
                        <div className="font-medium text-foreground">{department.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{department.key}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {head ? (
                        <span className="font-medium text-foreground">{displayMember(head)}</span>
                      ) : (
                        <span className="text-muted-foreground">{t.noHead}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {department.members.length} {t.memberCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {department.projectsCount} {t.projectCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(department.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
                    </TableCell>
                    <TableCell className="pl-0 text-left">
                      <div className="flex items-center justify-start gap-2">
                        <Button asChild variant="outline" size="xs">
                          <Link href={`/admin/departments/${department.id}/members`}>
                            {t.manage}
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => openEditDialog(department)}
                          disabled={isPending}
                        >
                          {t.edit}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            clearListError();
                            clearDeleteError();
                            setDeleteConfirmText("");
                            setDeletingDepartment(department);
                          }}
                          disabled={isPending}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 />
                          {t.delete}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredDepartments.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    <Building2 className="mx-auto mb-3 size-8 opacity-35" />
                    {departments.length === 0 ? t.empty : t.noResults}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3 text-sm">
          <div className="text-muted-foreground">
            {t.showing} <span className="font-medium text-foreground">{departmentRangeStart}</span> {t.to}{" "}
            <span className="font-medium text-foreground">{departmentRangeEnd}</span> {t.of}{" "}
            <span className="font-medium text-foreground">{filteredDepartments.length}</span> {t.departmentCount}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{t.perPage}</span>
              <DropdownField
                id="department-page-size"
                label={t.perPage}
                value={String(departmentPageSize)}
                onChange={(value) => {
                  setDepartmentPageSize(Number(value));
                  setDepartmentPage(1);
                }}
                options={departmentPageSizeOptions}
                hideLabel
                className="w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setDepartmentPage(Math.max(1, currentDepartmentPage - 1))}
                disabled={currentDepartmentPage === 1}
              >
                <ArrowLeft />
              </Button>
              <span className="px-1 font-medium leading-none text-foreground">
                {locale === "zh"
                  ? `${t.page} ${currentDepartmentPage} / ${totalDepartmentPages} 页`
                  : `${t.page} ${currentDepartmentPage} of ${totalDepartmentPages}`}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setDepartmentPage(Math.min(totalDepartmentPages, currentDepartmentPage + 1))}
                disabled={currentDepartmentPage >= totalDepartmentPages}
              >
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => !open && !isPending && closeFormDialog()}>
        <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-muted/35 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{editingDepartment ? t.editTitle : t.createTitle}</DialogTitle>
              <DialogDescription className="sr-only">
                {editingDepartment ? t.editTitle : t.createTitle}
              </DialogDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closeFormDialog}
                disabled={isPending}
                aria-label={t.cancel}
              >
                <X />
              </Button>
            </div>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 p-6">
              {formErrorMsg ? (
                <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  {formErrorMsg}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="department-name">{t.name}</Label>
                <Input
                  id="department-name"
                  required
                  value={departmentForm.name}
                  onChange={(event) => setDepartmentForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder={locale === "zh" ? "例如：工程部" : "e.g. Engineering"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department-key">{t.key}</Label>
                <Input
                  id="department-key"
                  required
                  maxLength={10}
                  value={departmentForm.key}
                  onChange={(event) => setDepartmentForm((current) => ({ ...current, key: event.target.value.toUpperCase() }))}
                  className="font-mono"
                  placeholder={locale === "zh" ? "例如：ENG" : "e.g. ENG"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department-description">{t.description}</Label>
                <Textarea
                  id="department-description"
                  rows={3}
                  value={departmentForm.description}
                  onChange={(event) => setDepartmentForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder={t.descPlaceholder}
                />
              </div>
            </div>
            <DialogFooter className="border-t bg-muted/35 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeFormDialog}
                disabled={isPending}
              >
                {t.cancel}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : null}
                {editingDepartment ? t.save : t.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingDepartment)}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            clearDeleteError();
            setDeletingDepartment(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-destructive/5 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" />
                {t.delete}
              </DialogTitle>
              <DialogDescription className="sr-only">{t.deleteWarning}</DialogDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  clearDeleteError();
                  setDeletingDepartment(null);
                  setDeleteConfirmText("");
                }}
                disabled={isPending}
                aria-label={t.cancel}
              >
                <X />
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4 p-6">
            <p className="text-sm text-muted-foreground">{t.deleteWarning}</p>
            {deleteErrorMsg ? (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                {deleteErrorMsg}
              </div>
            ) : null}
            {deletingDepartment ? (
              <>
                <div
                  className="select-none rounded-md border bg-muted/40 p-3 text-sm font-medium"
                  onCopy={(event) => event.preventDefault()}
                  onCut={(event) => event.preventDefault()}
                >
                  {deletingDepartment.name}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delete-department-confirm">{t.typeToConfirm}</Label>
                  <Input
                    id="delete-department-confirm"
                    type="text"
                    value={deleteConfirmText}
                    onChange={(event) => setDeleteConfirmText(event.target.value)}
                    placeholder={deletingDepartment.name}
                  />
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter className="border-t bg-muted/35 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearDeleteError();
                setDeletingDepartment(null);
                setDeleteConfirmText("");
              }}
              disabled={isPending}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || !deletingDepartment || deleteConfirmText !== deletingDepartment.name}
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
