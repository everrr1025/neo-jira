"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Check, ChevronDown, Link2, Plus, X } from "lucide-react";

import { createReminder, setReminderCompleted } from "@/app/actions/reminders";
import type {
  DepartmentReminderIssueOption,
  DepartmentReminderScopeOption,
  DepartmentUpcomingItem,
} from "@/lib/departmentReminders";
import type { Locale } from "@/lib/i18n";

const TEXT = {
  en: {
    title: "Upcoming items",
    empty: "No important items in the next few days.",
    add: "Add reminder",
    allItems: "All items",
    today: "Today",
    tomorrow: "Tomorrow",
    overdue: "Overdue",
    later: "Upcoming",
    reminderTitle: "Title",
    content: "Notes",
    time: "Time",
    priority: "Priority",
    scope: "Scope",
    personal: "Personal",
    department: "Department",
    project: "Project",
    linkedIssue: "Linked issue",
    noIssue: "No issue",
    selectProject: "Select project",
    create: "Create",
    cancel: "Cancel",
    done: "Done",
    failedCreate: "Failed to create reminder.",
    failedComplete: "Failed to complete reminder.",
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
    itemType: "Type",
    note: "Note",
    todo: "To-do",
    event: "Event",
    reminder: "Reminder",
    hasTime: "Add time",
    important: "Important",
  },
  zh: {
    title: "近期重要事项",
    empty: "未来几天暂无重要事项。",
    add: "新增提醒",
    allItems: "全部事项",
    today: "今天",
    tomorrow: "明天",
    overdue: "已逾期",
    later: "近期",
    reminderTitle: "标题",
    content: "备注",
    time: "时间",
    priority: "优先级",
    scope: "范围",
    personal: "个人",
    department: "部门",
    project: "项目",
    linkedIssue: "关联问题",
    noIssue: "不关联问题",
    selectProject: "选择项目",
    create: "创建",
    cancel: "取消",
    done: "完成",
    failedCreate: "创建提醒失败。",
    failedComplete: "完成提醒失败。",
    low: "低",
    medium: "中",
    high: "高",
    urgent: "紧急",
    itemType: "类型",
    note: "笔记",
    todo: "待办",
    event: "日程",
    reminder: "提醒",
    hasTime: "添加时间",
    important: "重要",
  },
} as const;

function formatDateTimeLocal(date = new Date()) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() - next.getTimezoneOffset());
  return next.toISOString().slice(0, 16);
}

function getDayLabel(dateValue: string, locale: Locale) {
  const t = TEXT[locale];
  const date = new Date(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) return t.overdue;
  if (diffDays === 0) return t.today;
  if (diffDays === 1) return t.tomorrow;
  return t.later;
}

function formatItemDate(item: DepartmentUpcomingItem, locale: Locale) {
  const date = new Date(item.date);
  const localeKey = locale === "zh" ? "zh-CN" : "en-US";
  return item.itemType === "TODO" ? date.toLocaleDateString(localeKey) : date.toLocaleString(localeKey);
}

function priorityLabel(priority: string, locale: Locale) {
  const t = TEXT[locale];
  if (priority === "URGENT") return t.urgent;
  if (priority === "HIGH") return t.high;
  if (priority === "LOW") return t.low;
  return t.medium;
}

function priorityClass(priority: string) {
  if (priority === "URGENT") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "HIGH") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "LOW") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function itemTypeLabel(itemType: string, locale: Locale) {
  const t = TEXT[locale];
  if (itemType === "NOTE") return t.note;
  if (itemType === "TODO") return t.todo;
  if (itemType === "EVENT") return t.event;
  if (itemType === "ISSUE_DUE") return locale === "zh" ? "问题到期" : "Issue due";
  return t.reminder;
}

export default function DepartmentUpcomingItemsCard({
  departmentId,
  items,
  locale,
  canCreateDepartmentReminder,
  projectOptions,
  issueOptions,
}: {
  departmentId: string;
  items: DepartmentUpcomingItem[];
  locale: Locale;
  canCreateDepartmentReminder: boolean;
  projectOptions: DepartmentReminderScopeOption[];
  issueOptions: DepartmentReminderIssueOption[];
}) {
  const t = TEXT[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    content: "",
    startAt: formatDateTimeLocal(),
    hasTime: true,
    itemType: "REMINDER" as "NOTE" | "TODO" | "EVENT" | "REMINDER",
    isImportant: false,
    priority: "MEDIUM",
    scopeType: "PERSONAL" as "PERSONAL" | "DEPARTMENT" | "PROJECT",
    projectId: projectOptions[0]?.id || "",
    issueId: "",
  });

  const availableScopes = useMemo(
    () => [
      { value: "PERSONAL", label: t.personal },
      ...(canCreateDepartmentReminder ? [{ value: "DEPARTMENT", label: t.department }] : []),
      ...(projectOptions.length > 0 ? [{ value: "PROJECT", label: t.project }] : []),
    ],
    [canCreateDepartmentReminder, projectOptions.length, t.department, t.personal, t.project]
  );

  const filteredIssueOptions = useMemo(
    () =>
      issueOptions.filter((issue) => {
        if (form.scopeType === "PROJECT") return issue.projectId === form.projectId;
        return true;
      }),
    [form.projectId, form.scopeType, issueOptions]
  );

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await createReminder({
        departmentId,
        title: form.title,
        content: form.content,
        startAt: form.hasTime ? form.startAt : undefined,
        priority: form.priority,
        itemType: form.itemType,
        isImportant: form.isImportant,
        scopeType: form.scopeType,
        projectId: form.scopeType === "PROJECT" ? form.projectId : undefined,
        issueId: form.issueId || undefined,
      });

      if (!result.success) {
        setError(result.error || t.failedCreate);
        return;
      }

      setIsCreateOpen(false);
      setError("");
      setForm({
        title: "",
        content: "",
        startAt: formatDateTimeLocal(),
        hasTime: true,
        itemType: "REMINDER",
        isImportant: false,
        priority: "MEDIUM",
        scopeType: "PERSONAL",
        projectId: projectOptions[0]?.id || "",
        issueId: "",
      });
      router.refresh();
    });
  };

  const handleComplete = (item: DepartmentUpcomingItem) => {
    if (item.kind !== "REMINDER") return;
    setError("");
    startTransition(async () => {
      const result = await setReminderCompleted(item.id, true);
      if (!result.success) {
        setError(result.error || t.failedComplete);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-violet-600" />
          <h3 className="text-lg font-semibold text-slate-900">{t.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/departments/${departmentId}/items`}
            className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            {t.allItems}
          </Link>
          <button
            type="button"
            onClick={() => {
              setError("");
              setIsCreateOpen(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <Plus size={14} />
            {t.add}
          </button>
        </div>
      </div>

      {error ? <div className="mb-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{t.empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.isOverdue ? <AlertTriangle size={14} className="text-red-500" /> : null}
                    <span className="text-xs font-semibold uppercase text-slate-400">{getDayLabel(item.date, locale)}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      {itemTypeLabel(item.itemType, locale)}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityClass(item.priority)}`}>
                      {priorityLabel(item.priority, locale)}
                    </span>
                    {item.isImportant ? (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                        {t.important}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      {item.scopeLabel}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.link ? (
                      <Link href={item.link} className="break-words font-semibold text-slate-900 hover:text-blue-700">
                        {item.issueKey ? `${item.issueKey} ${item.title}` : item.title}
                      </Link>
                    ) : (
                      <h4 className="break-words font-semibold text-slate-900">{item.title}</h4>
                    )}
                    {item.link ? <Link2 size={13} className="text-slate-400" /> : null}
                  </div>
                  {item.content ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.content}</p> : null}
                  <p className="mt-3 text-xs text-slate-400">
                    {formatItemDate(item, locale)}
                    {item.projectKey ? ` · ${item.projectKey}` : ""}
                  </p>
                </div>
                {item.canComplete ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleComplete(item)}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <Check size={13} />
                    {t.done}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{t.add}</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label={t.cancel}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t.reminderTitle}</label>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t.itemType}</label>
                  <select
                    value={form.itemType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        itemType: event.target.value as typeof form.itemType,
                        hasTime: event.target.value === "NOTE" ? false : current.hasTime,
                      }))
                    }
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="NOTE">{t.note}</option>
                    <option value="TODO">{t.todo}</option>
                    <option value="EVENT">{t.event}</option>
                    <option value="REMINDER">{t.reminder}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t.priority}</label>
                  <select
                    value={form.priority}
                    onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="LOW">{t.low}</option>
                    <option value="MEDIUM">{t.medium}</option>
                    <option value="HIGH">{t.high}</option>
                    <option value="URGENT">{t.urgent}</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.hasTime}
                    onChange={(event) => setForm((current) => ({ ...current, hasTime: event.target.checked }))}
                    className="h-4 w-4"
                  />
                  {t.hasTime}
                </label>
                <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isImportant}
                    onChange={(event) => setForm((current) => ({ ...current, isImportant: event.target.checked }))}
                    className="h-4 w-4"
                  />
                  {t.important}
                </label>
              </div>
              {form.hasTime ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t.time}</label>
                  <input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))}
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                    required={form.hasTime}
                  />
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t.scope}</label>
                  <div className="relative">
                    <select
                      value={form.scopeType}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          scopeType: event.target.value as typeof form.scopeType,
                          issueId: "",
                        }))
                      }
                      className="h-10 w-full appearance-none rounded-md border border-slate-200 bg-white px-3 pr-8 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {availableScopes.map((scope) => (
                        <option key={scope.value} value={scope.value}>
                          {scope.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-slate-400" />
                  </div>
                </div>
                {form.scopeType === "PROJECT" ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">{t.project}</label>
                    <select
                      value={form.projectId}
                      onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value, issueId: "" }))}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    >
                      {projectOptions.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name} ({project.key})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t.linkedIssue}</label>
                <select
                  value={form.issueId}
                  onChange={(event) => setForm((current) => ({ ...current, issueId: event.target.value }))}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">{t.noIssue}</option>
                  {filteredIssueOptions.map((issue) => (
                    <option key={issue.id} value={issue.id}>
                      {issue.key} {issue.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t.content}</label>
                <textarea
                  value={form.content}
                  onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
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
