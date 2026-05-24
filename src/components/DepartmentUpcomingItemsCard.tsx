"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Check, FileArchive, FileImage, FileSpreadsheet, FileText, Link2, Paperclip } from "lucide-react";

import { setReminderCompleted } from "@/app/actions/reminders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type TaskAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
};

const TASK_ATTACHMENT_MARKER_PATTERN = /<!--neo-task-attachments:([\s\S]*?)-->/g;

function parseTaskAttachmentsFromContent(content?: string | null): TaskAttachment[] {
  if (!content) return [];

  const attachments: TaskAttachment[] = [];
  for (const match of content.matchAll(TASK_ATTACHMENT_MARKER_PATTERN)) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1])) as TaskAttachment[];
      if (Array.isArray(parsed)) {
        attachments.push(
          ...parsed.filter(
            (attachment) =>
              attachment &&
              typeof attachment.id === "string" &&
              typeof attachment.fileName === "string" &&
              typeof attachment.fileUrl === "string" &&
              (attachment.fileSize === undefined || typeof attachment.fileSize === "number")
          )
        );
      }
    } catch {
      // Ignore malformed markers.
    }
  }

  return attachments;
}

function stripTaskAttachmentsFromContent(content?: string | null) {
  return (content || "").replace(TASK_ATTACHMENT_MARKER_PATTERN, "").trim();
}

function formatAttachmentSize(fileSize?: number) {
  if (!Number.isFinite(fileSize) || !fileSize || fileSize <= 0) return "";
  if (fileSize < 1024) return `${fileSize} B`;
  if (fileSize < 1024 * 1024) return `${(fileSize / 1024).toFixed(1)} KB`;
  return `${(fileSize / 1024 / 1024).toFixed(1)} MB`;
}

function getTaskAttachmentIcon(fileName: string) {
  if (/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i.test(fileName)) {
    return <FileImage size={14} className="shrink-0 text-blue-500" />;
  }
  if (/\.(xls|xlsx|csv)$/i.test(fileName)) {
    return <FileSpreadsheet size={14} className="shrink-0 text-emerald-600" />;
  }
  if (/\.(zip|rar|7z|tar|gz)$/i.test(fileName)) {
    return <FileArchive size={14} className="shrink-0 text-amber-600" />;
  }
  if (/\.(pdf)$/i.test(fileName)) {
    return <FileText size={14} className="shrink-0 text-red-500" />;
  }
  if (/\.(doc|docx|txt|md)$/i.test(fileName)) {
    return <FileText size={14} className="shrink-0 text-sky-600" />;
  }
  return <Paperclip size={14} className="shrink-0 text-slate-400" />;
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
  if (itemType === "ISSUE_DUE") return locale === "zh" ? "任务" : "Task";
  return t.reminder;
}

export default function DepartmentUpcomingItemsCard({
  departmentId,
  items,
  locale,
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
  const [error, setError] = useState("");

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
    <div className="rounded-2xl border bg-background p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{t.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/departments/${departmentId}/items`}>{t.allItems}</Link>
          </Button>
        </div>
      </div>

      {error ? <div className="mb-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const content = stripTaskAttachmentsFromContent(item.content);
            const attachments = parseTaskAttachmentsFromContent(item.content);

            return (
              <div key={`${item.kind}-${item.id}`} className="rounded-xl border bg-muted/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.isOverdue ? <AlertTriangle size={14} className="text-red-500" /> : null}
                      <span className="text-xs font-semibold uppercase text-muted-foreground">{getDayLabel(item.date, locale)}</span>
                      <Badge variant="secondary">
                        {itemTypeLabel(item.itemType, locale)}
                      </Badge>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityClass(item.priority)}`}>
                        {priorityLabel(item.priority, locale)}
                      </span>
                      {item.isImportant ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                          {t.important}
                        </span>
                      ) : null}
                      <Badge variant="outline">
                        {item.scopeLabel}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {item.link ? (
                        <Link href={item.link} className="break-words font-semibold text-foreground hover:text-primary">
                          {item.issueKey ? `${item.issueKey} ${item.title}` : item.title}
                        </Link>
                      ) : (
                        <h4 className="break-words font-semibold text-foreground">{item.title}</h4>
                      )}
                      {item.link ? <Link2 size={13} className="text-muted-foreground" /> : null}
                    </div>
                    {content ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{content}</p> : null}
                    {attachments.length > 0 ? (
                      <div className="mt-3 overflow-hidden rounded-md border bg-card text-card-foreground shadow-xs">
                        {attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-w-0 items-center gap-2.5 border-b px-3 py-2.5 text-sm text-foreground last:border-b-0 hover:bg-accent/50"
                          >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                              {getTaskAttachmentIcon(attachment.fileName)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{attachment.fileName}</span>
                              {formatAttachmentSize(attachment.fileSize) ? (
                                <span className="block text-xs text-muted-foreground">{formatAttachmentSize(attachment.fileSize)}</span>
                              ) : null}
                            </span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">
                      {formatItemDate(item, locale)}
                      {item.projectKey ? ` · ${item.projectKey}` : ""}
                    </p>
                  </div>
                  {item.canComplete ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleComplete(item)}
                      className="shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      <Check />
                      {t.done}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
