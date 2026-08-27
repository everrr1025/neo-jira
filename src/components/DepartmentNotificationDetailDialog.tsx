"use client";

import { FileArchive, FileImage, FileSpreadsheet, FileText, Loader2, Paperclip, Trash2, X } from "lucide-react";

import RichTextEditor, { type RichTextEditorHandle } from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import type { DepartmentNotificationListItem } from "@/lib/departmentNotifications";
import type { Locale } from "@/lib/i18n";
import {
  formatNotificationAttachmentSize,
  parseNotificationAttachmentsFromContent,
  stripNotificationAttachmentsFromContent,
  type NotificationAttachment,
} from "@/lib/notificationAttachments";
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
  attachments?: string;
  addAttachment?: string;
  uploading?: string;
};

type Props = {
  departmentId: string;
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
  resendAttachments?: NotificationAttachment[];
  isResendAttachmentUploading?: boolean;
  onUploadResendAttachment?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveResendAttachment?: (attachmentId: string) => void;
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

function attachmentIcon(fileName: string) {
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

function getAttachmentDownloadName(fileName: string) {
  return /\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i.test(fileName) ? undefined : fileName;
}

function AttachmentList({
  attachments,
  removable = false,
  onRemove,
}: {
  attachments: NotificationAttachment[];
  removable?: boolean;
  onRemove?: (attachmentId: string) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-md border bg-card text-card-foreground shadow-xs">
      {attachments.map((attachment) => {
        const sizeText = formatNotificationAttachmentSize(attachment.fileSize);
        const content = (
          <>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              {attachmentIcon(attachment.fileName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{attachment.fileName}</span>
              {sizeText ? <span className="block text-xs text-muted-foreground">{sizeText}</span> : null}
            </span>
          </>
        );

        return removable ? (
          <div key={attachment.id} className="flex min-w-0 items-center justify-between gap-3 border-b px-3 py-2.5 text-sm last:border-b-0 hover:bg-accent/50">
            <a href={attachment.fileUrl} download={getAttachmentDownloadName(attachment.fileName)} target="_blank" rel="noreferrer" className="inline-flex min-w-0 flex-1 items-center gap-2.5 text-foreground">
              {content}
            </a>
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => onRemove?.(attachment.id)}>
              <Trash2 size={14} />
            </Button>
          </div>
        ) : (
          <a
            key={attachment.id}
            href={attachment.fileUrl}
            download={getAttachmentDownloadName(attachment.fileName)}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-2.5 border-b px-3 py-2.5 text-sm text-foreground last:border-b-0 hover:bg-accent/50"
          >
            {content}
          </a>
        );
      })}
    </div>
  );
}

export default function DepartmentNotificationDetailDialog({
  departmentId,
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
  resendAttachments = [],
  isResendAttachmentUploading = false,
  onUploadResendAttachment,
  onRemoveResendAttachment,
}: Props) {
  const canResend = showActions && notification.status === "REVOKED" && notification.canManage;
  const canRevoke = showActions && notification.status === "SENT" && notification.canManage;
  const resendFormId = "department-notification-resend-form";
  const notificationContent = stripNotificationAttachmentsFromContent(notification.content);
  const notificationAttachments = parseNotificationAttachmentsFromContent(notification.content);
  const contentIsEmpty = !hasContent(notificationContent);
  const attachmentLabel = labels.attachments || (locale === "zh" ? "附件" : "Attachments");
  const hasFooterActions = canRevoke || canResend;

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

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-0 pt-6">
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
                  departmentId={departmentId}
                  value={resendForm.content}
                  onChange={(value) => setResendForm((current) => ({ ...current, content: value || "" }))}
                  height={220}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">{`${attachmentLabel} (${resendAttachments.length})`}</span>
                  {onUploadResendAttachment ? (
                    <Button asChild type="button" variant="secondary" size="sm" disabled={isResendAttachmentUploading || isPending}>
                      <label className="cursor-pointer">
                        {isResendAttachmentUploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                        {isResendAttachmentUploading ? labels.uploading || (locale === "zh" ? "上传中" : "Uploading") : labels.addAttachment || (locale === "zh" ? "添加附件" : "Add attachment")}
                        <input type="file" className="hidden" onChange={onUploadResendAttachment} disabled={isResendAttachmentUploading || isPending} />
                      </label>
                    </Button>
                  ) : null}
                </div>
                <AttachmentList attachments={resendAttachments} removable onRemove={onRemoveResendAttachment} />
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="min-h-28 rounded-lg bg-muted/50 px-3 py-2">
                {contentIsEmpty ? (
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {locale === "zh" ? "无内容" : "No content"}
                  </p>
                ) : (
                  <div className="text-sm leading-6 text-foreground [&_.neo-rich-text-editor__content]:text-sm [&_.neo-rich-text-editor__content_p]:text-sm [&_img]:max-w-full [&_img]:rounded-md">
                    <RichTextEditor value={notificationContent} onChange={() => {}} readOnly />
                  </div>
                )}
              </div>
              {notificationAttachments.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">{`${attachmentLabel} (${notificationAttachments.length})`}</span>
                  <AttachmentList attachments={notificationAttachments} />
                </div>
              ) : null}
            </div>
          )}
        </div>

        {hasFooterActions ? (
          <div className="mt-6 flex min-h-[73px] shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            {canRevoke ? (
              <button type="button" onClick={onRevoke} disabled={isPending} className="rounded-md border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                {labels.revoke}
              </button>
            ) : null}
            {canResend ? (
              <button
                type="submit"
                form={resendFormId}
                disabled={isPending || isResendAttachmentUploading || !resendForm.title.trim() || !resendForm.content.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                {labels.resend}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="h-6 shrink-0 bg-white" />
        )}
      </div>
    </div>
  );
}
