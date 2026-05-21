"use client";

import { Loader2, X } from "lucide-react";

import RichTextEditor, { type RichTextEditorHandle } from "@/components/RichTextEditor";
import type { DepartmentNotificationListItem } from "@/lib/departmentNotifications";
import type { Locale } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/timeFormat";

type DetailDialogLabels = {
  level: {
    department: string;
    project: string;
    system: string;
  };
  revoked: string;
  sent: string;
  title: string;
  content: string;
  project: string;
  createdBy: string;
  createdAt: string;
  status: string;
  resend: string;
  revoke: string;
};

type Props = {
  locale: Locale;
  notification: DepartmentNotificationListItem;
  isPending: boolean;
  errorMsg: string;
  resendForm: { title: string; content: string };
  setResendForm: React.Dispatch<React.SetStateAction<{ title: string; content: string }>>;
  labels: DetailDialogLabels;
  resendEditorRef: React.RefObject<RichTextEditorHandle | null>;
  onClose: () => void;
  onSubmitResend: (event: React.FormEvent<HTMLFormElement>) => void;
  onRevoke: () => void;
  showActions?: boolean;
};

function levelLabel(level: DepartmentNotificationListItem["level"], labels: DetailDialogLabels["level"]) {
  if (level === "DEPARTMENT") return labels.department;
  if (level === "PROJECT") return labels.project;
  return labels.system;
}

function metaText(notification: DepartmentNotificationListItem, labels: DetailDialogLabels, locale: Locale) {
  const prefix = [levelLabel(notification.level, labels.level), notification.projectName, notification.authorName]
    .filter(Boolean)
    .join(" · ");
  const createdText = locale === "zh" ? "创建于" : "created";
  return `${prefix} ${createdText} ${formatRelativeTime(notification.createdAt, locale)}`;
}

function hasContent(content: string) {
  return content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

export default function DepartmentNotificationDetailDialog({
  locale,
  notification,
  isPending,
  errorMsg,
  resendForm,
  setResendForm,
  labels,
  resendEditorRef,
  onClose,
  onSubmitResend,
  onRevoke,
  showActions = true,
}: Props) {
  const canResend = showActions && notification.status === "REVOKED" && notification.canManage;
  const canRevoke = showActions && notification.status === "SENT" && notification.canManage;
  const resendFormId = "department-notification-resend-form";
  const contentIsEmpty = !hasContent(notification.content);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-slate-900">{notification.title}</h3>
            <p className="mt-1 text-xs text-slate-500">{metaText(notification, labels, locale)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6">
          {errorMsg ? <div className="mb-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">{errorMsg}</div> : null}
          {canResend ? (
            <form id={resendFormId} onSubmit={onSubmitResend} className="space-y-5">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">
                  {labels.title} <span className="text-red-500">*</span>
                </span>
                <input
                  required
                  value={resendForm.title}
                  onChange={(event) => setResendForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </label>
              <div className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">
                  {labels.content} <span className="text-red-500">*</span>
                </span>
                <RichTextEditor
                  ref={resendEditorRef}
                  value={resendForm.content}
                  onChange={(value) => setResendForm((current) => ({ ...current, content: value || "" }))}
                  height={220}
                />
              </div>
            </form>
          ) : (
            <div className="min-h-28 rounded-lg bg-muted/50 px-3 py-2">
              {contentIsEmpty ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {locale === "zh" ? "无内容" : "No content"}
                </p>
              ) : (
                <div className="text-sm leading-6 text-foreground [&_.neo-rich-text-editor__content]:text-sm [&_.neo-rich-text-editor__content_p]:text-sm [&_img]:max-w-full [&_img]:rounded-md">
                  <RichTextEditor value={notification.content} onChange={() => {}} readOnly />
                </div>
              )}
            </div>
          )}
        </div>

        {showActions ? (
          <div className="flex min-h-[73px] shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            {canRevoke ? (
              <button type="button" onClick={onRevoke} disabled={isPending} className="rounded-md border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                {labels.revoke}
              </button>
            ) : null}
            {canResend ? (
              <button
                type="submit"
                form={resendFormId}
                disabled={isPending || !resendForm.title.trim() || !resendForm.content.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                {labels.resend}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="h-12 shrink-0 bg-white" />
        )}
      </div>
    </div>
  );
}
