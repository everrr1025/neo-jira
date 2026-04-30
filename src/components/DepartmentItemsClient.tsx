"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, List, Plus, Star, X } from "lucide-react";

import { createReminder, setReminderCompleted } from "@/app/actions/reminders";
import type {
  DepartmentItemCenterItem,
  DepartmentReminderIssueOption,
  DepartmentReminderScopeOption,
} from "@/lib/departmentReminders";
import type { Locale } from "@/lib/i18n";

const TEXT = {
  en: {
    title: "Items",
    list: "List",
    calendar: "Calendar",
    add: "New item",
    empty: "No items yet.",
    titleField: "Title",
    notes: "Notes",
    type: "Type",
    note: "Note",
    todo: "To-do",
    event: "Event",
    reminder: "Reminder",
    scope: "Scope",
    personal: "Personal",
    department: "Department",
    project: "Project",
    projectLabel: "Project",
    issue: "Linked issue",
    noIssue: "No issue",
    time: "Time",
    hasTime: "Add time",
    important: "Important",
    priority: "Priority",
    create: "Create",
    cancel: "Cancel",
    done: "Done",
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  },
  zh: {
    title: "事项",
    list: "列表",
    calendar: "日历",
    add: "新增事项",
    empty: "暂无事项。",
    titleField: "标题",
    notes: "内容",
    type: "类型",
    note: "笔记",
    todo: "待办",
    event: "日程",
    reminder: "提醒",
    scope: "范围",
    personal: "个人",
    department: "部门",
    project: "项目",
    projectLabel: "项目",
    issue: "关联问题",
    noIssue: "不关联问题",
    time: "时间",
    hasTime: "添加时间",
    important: "重要",
    priority: "优先级",
    create: "创建",
    cancel: "取消",
    done: "完成",
    low: "低",
    medium: "中",
    high: "高",
    urgent: "紧急",
  },
} as const;

function formatDateTimeLocal(date = new Date()) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() - next.getTimezoneOffset());
  return next.toISOString().slice(0, 16);
}

function itemTypeLabel(type: string, locale: Locale) {
  const t = TEXT[locale];
  if (type === "TODO") return t.todo;
  if (type === "EVENT") return t.event;
  if (type === "REMINDER") return t.reminder;
  return t.note;
}

function priorityLabel(priority: string, locale: Locale) {
  const t = TEXT[locale];
  if (priority === "LOW") return t.low;
  if (priority === "HIGH") return t.high;
  if (priority === "URGENT") return t.urgent;
  return t.medium;
}

function dayKey(date: string) {
  return new Date(date).toISOString().slice(0, 10);
}

export default function DepartmentItemsClient({
  departmentId,
  locale,
  items,
  canCreateDepartmentItem,
  projectOptions,
  issueOptions,
}: {
  departmentId: string;
  locale: Locale;
  items: DepartmentItemCenterItem[];
  canCreateDepartmentItem: boolean;
  projectOptions: DepartmentReminderScopeOption[];
  issueOptions: DepartmentReminderIssueOption[];
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: "",
    content: "",
    itemType: "NOTE" as "NOTE" | "TODO" | "EVENT" | "REMINDER",
    hasTime: false,
    startAt: formatDateTimeLocal(),
    isImportant: false,
    priority: "MEDIUM",
    scopeType: "PERSONAL" as "PERSONAL" | "DEPARTMENT" | "PROJECT",
    projectId: projectOptions[0]?.id || "",
    issueId: "",
  });

  const availableScopes = useMemo(
    () => [
      { value: "PERSONAL", label: t.personal },
      ...(canCreateDepartmentItem ? [{ value: "DEPARTMENT", label: t.department }] : []),
      ...(projectOptions.length > 0 ? [{ value: "PROJECT", label: t.project }] : []),
    ],
    [canCreateDepartmentItem, projectOptions.length, t.department, t.personal, t.project]
  );
  const filteredIssues = issueOptions.filter((issue) => (form.scopeType === "PROJECT" ? issue.projectId === form.projectId : true));
  const calendarItems = items.filter((item) => item.itemType !== "NOTE");
  const groupedByDay = calendarItems.reduce((acc, item) => {
    const key = dayKey(item.date);
    acc[key] = [...(acc[key] || []), item];
    return acc;
  }, {} as Record<string, DepartmentItemCenterItem[]>);
  const calendarDays = Object.keys(groupedByDay).sort();

  const resetForm = () =>
    setForm({
      title: "",
      content: "",
      itemType: "NOTE",
      hasTime: false,
      startAt: formatDateTimeLocal(),
      isImportant: false,
      priority: "MEDIUM",
      scopeType: "PERSONAL",
      projectId: projectOptions[0]?.id || "",
      issueId: "",
    });

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await createReminder({
        departmentId,
        title: form.title,
        content: form.content,
        itemType: form.itemType,
        startAt: form.hasTime ? form.startAt : undefined,
        priority: form.priority,
        isImportant: form.isImportant,
        scopeType: form.scopeType,
        projectId: form.scopeType === "PROJECT" ? form.projectId : undefined,
        issueId: form.issueId || undefined,
      });

      if (!result.success) {
        setError(result.error || "Failed");
        return;
      }

      setIsCreateOpen(false);
      resetForm();
      router.refresh();
    });
  };

  const handleComplete = (item: DepartmentItemCenterItem) => {
    if (!item.canComplete) return;
    startTransition(async () => {
      const result = await setReminderCompleted(item.id, true);
      if (!result.success) {
        setError(result.error || "Failed");
        return;
      }
      router.refresh();
    });
  };

  const renderItem = (item: DepartmentItemCenterItem) => (
    <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {itemTypeLabel(item.itemType, locale)}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {item.scopeLabel}
            </span>
            {item.isImportant ? <Star size={14} className="fill-amber-400 text-amber-400" /> : null}
            {item.completedAt ? <span className="text-xs font-medium text-emerald-600">{t.done}</span> : null}
          </div>
          {item.link ? (
            <Link href={item.link} className="mt-2 block break-words font-semibold text-slate-900 hover:text-blue-700">
              {item.issueKey ? `${item.issueKey} ${item.title}` : item.title}
            </Link>
          ) : (
            <h3 className="mt-2 break-words font-semibold text-slate-900">{item.title}</h3>
          )}
          {item.content ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.content}</p> : null}
          <p className="mt-3 text-xs text-slate-400">
            {item.itemType === "NOTE" ? new Date(item.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US") : new Date(item.date).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
            {item.projectKey ? ` · ${item.projectKey}` : ""}
            {` · ${priorityLabel(item.priority, locale)}`}
          </p>
        </div>
        {item.canComplete && !item.completedAt ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleComplete(item)}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            <Check size={13} />
            {t.done}
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-slate-800">{t.title}</h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`inline-flex h-8 items-center gap-2 rounded px-3 text-sm ${view === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <List size={14} />
              {t.list}
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`inline-flex h-8 items-center gap-2 rounded px-3 text-sm ${view === "calendar" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <CalendarDays size={14} />
              {t.calendar}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setError("");
              setIsCreateOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            {t.add}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}

      {view === "list" ? (
        <div className="space-y-3">{items.length === 0 ? <p className="text-sm text-slate-500">{t.empty}</p> : items.map(renderItem)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {calendarDays.length === 0 ? (
            <p className="text-sm text-slate-500">{t.empty}</p>
          ) : (
            calendarDays.map((day) => (
              <div key={day} className="rounded-2xl border bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-500">
                  {new Date(`${day}T00:00:00`).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </h3>
                <div className="space-y-2">{groupedByDay[day].map(renderItem)}</div>
              </div>
            ))
          )}
        </div>
      )}

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{t.add}</h3>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder={t.titleField}
                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <select
                  value={form.itemType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      itemType: event.target.value as typeof form.itemType,
                      hasTime: event.target.value === "NOTE" ? false : current.hasTime,
                    }))
                  }
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="NOTE">{t.note}</option>
                  <option value="TODO">{t.todo}</option>
                  <option value="EVENT">{t.event}</option>
                  <option value="REMINDER">{t.reminder}</option>
                </select>
                <select
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="LOW">{t.low}</option>
                  <option value="MEDIUM">{t.medium}</option>
                  <option value="HIGH">{t.high}</option>
                  <option value="URGENT">{t.urgent}</option>
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.hasTime} onChange={(event) => setForm((current) => ({ ...current, hasTime: event.target.checked }))} />
                  {t.hasTime}
                </label>
                <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.isImportant} onChange={(event) => setForm((current) => ({ ...current, isImportant: event.target.checked }))} />
                  {t.important}
                </label>
              </div>
              {form.hasTime ? (
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))}
                  className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <select
                  value={form.scopeType}
                  onChange={(event) => setForm((current) => ({ ...current, scopeType: event.target.value as typeof form.scopeType, issueId: "" }))}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  {availableScopes.map((scope) => (
                    <option key={scope.value} value={scope.value}>
                      {scope.label}
                    </option>
                  ))}
                </select>
                {form.scopeType === "PROJECT" ? (
                  <select
                    value={form.projectId}
                    onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value, issueId: "" }))}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                    required
                  >
                    {projectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} ({project.key})
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              <select
                value={form.issueId}
                onChange={(event) => setForm((current) => ({ ...current, issueId: event.target.value }))}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">{t.noIssue}</option>
                {filteredIssues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.key} {issue.title}
                  </option>
                ))}
              </select>
              <textarea
                value={form.content}
                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                placeholder={t.notes}
                rows={4}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
                  {t.cancel}
                </button>
                <button type="submit" disabled={isPending} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
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
