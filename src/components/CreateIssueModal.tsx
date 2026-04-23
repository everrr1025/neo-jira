"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Loader2, Paperclip, Trash2, X } from "lucide-react";

import { createIssue } from "@/app/actions/issues";
import { getIssueTypeLabel, getPriorityLabel, getTranslations, type Locale } from "@/lib/i18n";
import { ISSUE_TITLE_MAX_LENGTH } from "@/lib/validation";
import AlertPopup from "./AlertPopup";
import { DropdownField } from "./DropdownField";
import LocalizedDateInput from "./LocalizedDateInput";
import RichTextEditor, { type RichTextEditorHandle } from "./RichTextEditor";

type CreateIssueModalProps = {
  isOpen: boolean;
  onClose: () => void;
  users: CreateIssueUser[];
  plans: CreateIssuePlan[];
  iterations: CreateIssueIteration[];
  locale: Locale;
  currentUserId?: string;
  canManagePlans?: boolean;
  defaultPlanId?: string;
  defaultIterationId?: string;
  defaultDueDate?: string;
};

export type CreateIssueUser = {
  id: string;
  name: string | null;
};

export type CreateIssuePlan = {
  id: string;
  name: string;
};

export type CreateIssueIteration = {
  id: string;
  name: string;
  endDate: string | Date;
};

type FormDataState = {
  title: string;
  description: string;
  type: string;
  priority: string;
  planId: string;
  iterationId: string;
  assigneeId: string;
  dueDate: string;
  attachments: { fileName: string; fileUrl: string; id: string }[];
};

type DropdownOption = {
  value: string;
  label: string;
};

function toDateInputValue(dateLike?: string | Date | null) {
  if (!dateLike) return "";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function CreateIssueModal({
  isOpen,
  onClose,
  users,
  plans,
  iterations,
  locale,
  currentUserId,
  canManagePlans = false,
  defaultPlanId,
  defaultIterationId,
  defaultDueDate,
}: CreateIssueModalProps) {
  const [isPending, startTransition] = useTransition();
  const translations = getTranslations(locale);
  const text = translations.createIssue;

  const getInitialFormData = (): FormDataState => {
    const fallbackIteration = iterations.find((item) => item.id === defaultIterationId);
    return {
      title: "",
      description: "",
      type: "TASK",
      priority: "MEDIUM",
      planId: canManagePlans ? plans.find((plan) => plan.id === defaultPlanId)?.id || "" : "",
      iterationId: fallbackIteration?.id || "",
      assigneeId: "",
      dueDate: defaultDueDate || toDateInputValue(fallbackIteration?.endDate),
      attachments: [],
    };
  };

  const [formData, setFormData] = useState<FormDataState>(getInitialFormData);
  const [isDueDateManuallyEdited, setIsDueDateManuallyEdited] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const descriptionEditorRef = useRef<RichTextEditorHandle>(null);

  const handleSprintChange = (iterationId: string) => {
    setFormData((prev) => {
      const selectedIteration = iterations.find((item) => item.id === iterationId);
      const syncedDueDate = selectedIteration ? toDateInputValue(selectedIteration.endDate) : "";
      return {
        ...prev,
        iterationId,
        dueDate: isDueDateManuallyEdited ? prev.dueDate : syncedDueDate,
      };
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;

    setErrorMessage("");
    const file = event.target.files[0];
    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage(text.attachmentTooLarge);
      event.target.value = "";
      return;
    }

    setUploading(true);
    const data = new FormData();
    data.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });

      if (response.ok) {
        const result = await response.json();
        setFormData((prev) => ({
          ...prev,
          attachments: [
            ...prev.attachments,
            { fileName: result.fileName, fileUrl: result.fileUrl, id: Date.now().toString() },
          ],
        }));
      } else {
        const errorData = await response.json().catch(() => null);
        setErrorMessage(`${text.uploadFailed}: ${errorData?.error || response.statusText || "Unknown error"}`);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(text.uploadFailed);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const removeAttachment = async (id: string, fileUrl: string) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((attachment) => attachment.id !== id),
    }));

    try {
      await fetch("/api/upload", {
        method: "DELETE",
        body: JSON.stringify({ fileUrl }),
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Failed to delete attachment:", error);
    }
  };

  const handleCancelAndClose = async () => {
    await descriptionEditorRef.current?.discardPendingUploads();

    if (formData.attachments.length > 0) {
      try {
        await Promise.all(
          formData.attachments.map((attachment) =>
            fetch("/api/upload", {
              method: "DELETE",
              body: JSON.stringify({ fileUrl: attachment.fileUrl }),
              headers: { "Content-Type": "application/json" },
            })
          )
        );
      } catch (error) {
        console.error("Failed to cleanup attachments:", error);
      }
    }

    setFormData(getInitialFormData());
    setIsDueDateManuallyEdited(false);
    onClose();
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i)) return "IMAGE";
    if (fileName.match(/\.(pdf)$/i)) return "PDF";
    if (fileName.match(/\.(xls|xlsx|csv)$/i)) return "EXCEL";
    if (fileName.match(/\.(doc|docx)$/i)) return "WORD";
    return "OTHER";
  };

  if (!isOpen) return null;

  const iterationOptions: DropdownOption[] = [
    { value: "", label: translations.issueList.backlog },
    ...iterations.map((item) => ({ value: item.id, label: item.name })),
  ];
  const assigneeOptions: DropdownOption[] = [
    { value: "", label: translations.issueList.unassigned },
    ...users.map((user) => ({ value: user.id, label: user.name || user.id })),
  ];
  const typeOptions: DropdownOption[] = [
    { value: "TASK", label: getIssueTypeLabel("TASK", locale) },
    { value: "STORY", label: getIssueTypeLabel("STORY", locale) },
    { value: "BUG", label: getIssueTypeLabel("BUG", locale) },
    { value: "EPIC", label: getIssueTypeLabel("EPIC", locale) },
  ];
  const planOptions: DropdownOption[] = [
    { value: "", label: locale === "zh" ? "未设置计划" : "No plan" },
    ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
  ];
  const priorityOptions: DropdownOption[] = [
    { value: "LOW", label: getPriorityLabel("LOW", locale) },
    { value: "MEDIUM", label: getPriorityLabel("MEDIUM", locale) },
    { value: "HIGH", label: getPriorityLabel("HIGH", locale) },
    { value: "URGENT", label: getPriorityLabel("URGENT", locale) },
  ];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.title.trim()) return;

    setErrorMessage("");
    startTransition(async () => {
      const payload = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        planId: canManagePlans ? formData.planId || null : null,
        iterationId: formData.iterationId || null,
        assigneeId: formData.assigneeId || null,
        dueDate: formData.dueDate || null,
        attachments: formData.attachments.map((attachment) => ({
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl,
        })),
      };

      const result = await createIssue(payload);
      if (result.success) {
        descriptionEditorRef.current?.commitPendingUploads();
        setFormData(getInitialFormData());
        setIsDueDateManuallyEdited(false);
        onClose();
      } else {
        setErrorMessage(`${text.failedCreateIssue}: ${result.error}`);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-800">{text.modalTitle}</h2>
          <button
            onClick={handleCancelAndClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-sm font-medium text-slate-700">
                {text.summary} <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                required
                autoFocus
                value={formData.title}
                onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                maxLength={ISSUE_TITLE_MAX_LENGTH}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder={text.summaryPlaceholder}
              />
            </div>

            <div className="flex gap-4">
              <DropdownField
                id="type"
                label={text.issueType}
                value={formData.type}
                onChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
                options={typeOptions}
                className="flex-1"
              />
              <DropdownField
                id="priority"
                label={text.priority}
                value={formData.priority}
                onChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}
                options={priorityOptions}
                className="flex-1"
              />
            </div>

            <div className="flex gap-4">
              {canManagePlans ? (
                <DropdownField
                  id="plan"
                  label={locale === "zh" ? "计划" : "Plan"}
                  value={formData.planId}
                  onChange={(value) => setFormData((prev) => ({ ...prev, planId: value }))}
                  options={planOptions}
                  className="flex-1"
                />
              ) : null}
              <DropdownField
                id="iteration"
                label={text.sprint}
                value={formData.iterationId}
                onChange={handleSprintChange}
                options={iterationOptions}
                className={canManagePlans ? "flex-1" : "w-full"}
              />
            </div>

            <div className="flex gap-4">
              <DropdownField
                id="assignee"
                label={text.assignee}
                value={formData.assigneeId}
                onChange={(value) => setFormData((prev) => ({ ...prev, assigneeId: value }))}
                options={assigneeOptions}
                className="flex-1"
              />
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor="dueDate" className="text-sm font-medium text-slate-700">
                  {text.dueDate}
                </label>
                <LocalizedDateInput
                  id="dueDate"
                  locale={locale}
                  value={formData.dueDate}
                  onChange={(event) => {
                    setIsDueDateManuallyEdited(true);
                    setFormData((prev) => ({ ...prev, dueDate: event.target.value }));
                  }}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            <div className="relative mb-2 flex flex-col gap-1.5">
              <label htmlFor="description" className="text-sm font-medium text-slate-700">
                {text.description}
              </label>
              <div className="rounded-lg">
                <RichTextEditor
                  ref={descriptionEditorRef}
                  value={formData.description}
                  onChange={(value) => setFormData((prev) => ({ ...prev, description: value || "" }))}
                  height={180}
                  mentionUsers={users}
                  mentionLabel={text.mentionSomeone}
                  currentUserId={currentUserId}
                />
              </div>
            </div>

            <div className="relative z-0 flex flex-col gap-2 pb-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  {text.attachments} ({formData.attachments.length})
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                  {uploading ? translations.attachmentSection.uploading : text.addAttachment}
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading || isPending} />
                </label>
              </div>

              {formData.attachments.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {formData.attachments.map((file) => {
                    const fileType = getFileIcon(file.fileName);
                    return (
                      <div
                        key={file.id}
                        className="group relative flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 transition-all hover:border-blue-400 hover:shadow-sm"
                      >
                        <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-slate-50 transition-colors hover:bg-slate-100">
                          {fileType === "IMAGE" && (
                            <img src={file.fileUrl} alt={file.fileName} className="h-full w-full object-cover" />
                          )}
                          {fileType === "PDF" && <FileText size={24} className="text-red-500" />}
                          {fileType === "EXCEL" && <FileText size={24} className="text-green-600" />}
                          {fileType === "WORD" && <FileText size={24} className="text-blue-600" />}
                          {fileType === "OTHER" && <FileText size={24} className="text-slate-400" />}
                        </div>
                        <div className="flex items-center justify-between px-1">
                          <span className="block w-full truncate pr-2 text-xs font-medium text-slate-700">
                            {file.fileName}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(file.id, file.fileUrl)}
                            className="z-10 shrink-0 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-500 group-hover:opacity-100"
                            title={text.removeAttachment}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={handleCancelAndClose}
              disabled={isPending}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {text.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending || !formData.title.trim()}
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {text.creating}
                </>
              ) : (
                text.create
              )}
            </button>
          </div>
        </form>
      </div>
      <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
    </div>
  );
}
