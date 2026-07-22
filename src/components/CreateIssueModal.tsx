"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Loader2, Paperclip, Trash2, X } from "lucide-react";

import { createIssue } from "@/app/actions/issues";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canNestIssueType } from "@/lib/issueHierarchy";
import { getIssueTypeLabel, getPriorityLabel, getTranslations, type Locale } from "@/lib/i18n";
import { ISSUE_TITLE_MAX_LENGTH } from "@/lib/validation";
import AlertPopup from "./AlertPopup";
import ParentIssuePicker from "./ParentIssuePicker";
import RichTextEditor, { type RichTextEditorHandle } from "./RichTextEditor";
import ShadcnDatePicker from "./ShadcnDatePicker";

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
  defaultType?: string;
  defaultParentIssueId?: string | null;
  parentIssueLabel?: string;
  parentIssues?: CreateIssueParentIssue[];
  allowedTypes?: string[];
};

export type CreateIssueUser = {
  id: string;
  name: string | null;
  role?: string | null;
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

export type CreateIssueParentIssue = {
  id: string;
  key: string;
  title: string;
  type: string;
  parentIssueId?: string | null;
};

type FormDataState = {
  title: string;
  description: string;
  type: string;
  priority: string;
  planId: string;
  iterationId: string;
  assigneeId: string;
  parentIssueId: string;
  dueDate: string;
  attachments: { fileName: string; fileUrl: string; id: string }[];
};

type DropdownOption = {
  value: string;
  label: string;
};

const emptySelectValue = "__empty__";

function toSelectValue(value: string) {
  return value || emptySelectValue;
}

function fromSelectValue(value: string) {
  return value === emptySelectValue ? "" : value;
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  className = "",
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </Label>
      <Select value={toSelectValue(value)} onValueChange={(nextValue) => onChange(fromSelectValue(nextValue))}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={`${id}-${option.value || emptySelectValue}`} value={toSelectValue(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

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
  defaultType,
  defaultParentIssueId,
  parentIssueLabel,
  parentIssues = [],
  allowedTypes,
}: CreateIssueModalProps) {
  const [isPending, startTransition] = useTransition();
  const translations = getTranslations(locale);
  const text = translations.createIssue;
  const noParentAssociationLabel = locale === "zh" ? "暂无关联" : "No association";

  const getInitialFormData = (): FormDataState => {
    const fallbackIteration = iterations.find((item) => item.id === defaultIterationId);
    return {
      title: "",
      description: "",
      type: defaultType || "",
      priority: "MEDIUM",
      planId: canManagePlans ? plans.find((plan) => plan.id === defaultPlanId)?.id || "" : "",
      iterationId: fallbackIteration?.id || "",
      assigneeId: "",
      parentIssueId: defaultParentIssueId || "",
      dueDate: defaultDueDate || toDateInputValue(fallbackIteration?.endDate),
      attachments: [],
    };
  };

  const [formData, setFormData] = useState<FormDataState>(getInitialFormData);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const descriptionEditorRef = useRef<RichTextEditorHandle>(null);

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

  const assigneeOptions: DropdownOption[] = [
    { value: "", label: translations.issueList.unassigned },
    ...users
      .filter((user) => user.role !== "ADMIN")
      .map((user) => ({ value: user.id, label: user.name || user.id })),
  ];
  const typeOptions: DropdownOption[] = [
    { value: "", label: locale === "zh" ? "请选择类型" : "Select type" },
    { value: "TASK", label: getIssueTypeLabel("TASK", locale) },
    { value: "STORY", label: getIssueTypeLabel("STORY", locale) },
    { value: "BUG", label: getIssueTypeLabel("BUG", locale) },
    { value: "EPIC", label: getIssueTypeLabel("EPIC", locale) },
  ].filter((option) => option.value === "" || !allowedTypes || allowedTypes.includes(option.value));
  const priorityOptions: DropdownOption[] = [
    { value: "LOW", label: getPriorityLabel("LOW", locale) },
    { value: "MEDIUM", label: getPriorityLabel("MEDIUM", locale) },
    { value: "HIGH", label: getPriorityLabel("HIGH", locale) },
    { value: "URGENT", label: getPriorityLabel("URGENT", locale) },
  ];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.title.trim() || !formData.type) return;

    setErrorMessage("");
    startTransition(async () => {
      const payload = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        parentIssueId: formData.type === "EPIC" ? null : formData.parentIssueId || defaultParentIssueId || null,
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
        onClose();
      } else {
        setErrorMessage(`${text.failedCreateIssue}: ${result.error}`);
      }
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => (!open ? void handleCancelAndClose() : undefined)}>
        <DialogContent showCloseButton={false} className="flex max-h-[94vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{text.modalTitle}</DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleCancelAndClose}
                disabled={isPending}
                aria-label={text.cancel}
              >
                <X className="size-4" />
              </Button>
            </div>
          </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">
                {text.summary} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                required
                autoFocus
                value={formData.title}
                onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                maxLength={ISSUE_TITLE_MAX_LENGTH}
                placeholder={text.summaryPlaceholder}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <SelectField
                id="type"
                label={text.issueType}
                value={formData.type}
                onChange={(value) =>
                  setFormData((prev) => {
                    const selectedParent = parentIssues.find((issue) => issue.id === prev.parentIssueId);
                    return {
                      ...prev,
                      type: value,
                      parentIssueId:
                        value !== "EPIC" && (defaultParentIssueId || (selectedParent && canNestIssueType(selectedParent.type, value)))
                          ? prev.parentIssueId
                          : "",
                    };
                  })
                }
                options={typeOptions}
                required
              />
              <SelectField
                id="priority"
                label={text.priority}
                value={formData.priority}
                onChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}
                options={priorityOptions}
              />
              <SelectField
                id="assignee"
                label={text.assignee}
                value={formData.assigneeId}
                onChange={(value) => setFormData((prev) => ({ ...prev, assigneeId: value }))}
                options={assigneeOptions}
              />
              <ShadcnDatePicker
                id="dueDate"
                label={text.dueDate}
                locale={locale}
                value={formData.dueDate}
                onChange={(dueDate) => setFormData((prev) => ({ ...prev, dueDate }))}
                contentAlign="end"
              />
            </div>

            {formData.type === "EPIC" ? (
              <ParentIssuePicker
                value=""
                options={[]}
                locale={locale}
                disabled
                disabledLabel={locale === "zh" ? "史诗不能关联父级问题" : "Epics cannot have a parent issue"}
                label={locale === "zh" ? "父项" : "Parent item"}
                labelClassName="text-sm font-medium"
                emptyLabel={noParentAssociationLabel}
                onChange={() => undefined}
              />
            ) : parentIssueLabel ? (
              <div className="flex flex-col gap-1.5">
                <Label>{locale === "zh" ? "父项" : "Parent item"}</Label>
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium text-muted-foreground">
                  {parentIssueLabel}
                </div>
              </div>
            ) : parentIssues.length > 0 ? (
              <ParentIssuePicker
                value={formData.parentIssueId}
                onChange={(value) => setFormData((prev) => ({ ...prev, parentIssueId: value }))}
                options={parentIssues.filter((issue) => canNestIssueType(issue.type, formData.type))}
                locale={locale}
                disabled={!formData.type}
                disabledLabel={locale === "zh" ? "请先选择类型" : "Select a type first"}
                label={locale === "zh" ? "父项" : "Parent item"}
                labelClassName="text-sm font-medium"
                emptyLabel={noParentAssociationLabel}
              />
            ) : null}

            <div className="relative mb-2 flex flex-col gap-1.5">
              <Label htmlFor="description">{text.description}</Label>
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
                <Label>
                  {text.attachments} ({formData.attachments.length})
                </Label>
                <Button asChild type="button" variant="secondary" size="sm">
                  <label className="cursor-pointer">
                  {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
                  {uploading ? translations.attachmentSection.uploading : text.addAttachment}
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading || isPending} />
                  </label>
                </Button>
              </div>

              {formData.attachments.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {formData.attachments.map((file) => {
                    const fileType = getFileIcon(file.fileName);
                    return (
                      <div
                        key={file.id}
                        className="group relative flex flex-col gap-2 rounded-lg border bg-background p-2 transition-all hover:border-ring hover:shadow-sm"
                      >
                        <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-md border bg-muted/50 transition-colors hover:bg-muted">
                          {fileType === "IMAGE" && (
                            <img src={file.fileUrl} alt={file.fileName} className="h-full w-full object-cover" />
                          )}
                          {fileType === "PDF" && <FileText size={24} className="text-red-500" />}
                          {fileType === "EXCEL" && <FileText size={24} className="text-green-600" />}
                          {fileType === "WORD" && <FileText size={24} className="text-blue-600" />}
                          {fileType === "OTHER" && <FileText size={24} className="text-slate-400" />}
                        </div>
                        <div className="flex items-center justify-between px-1">
                          <span className="block w-full truncate pr-2 text-xs font-medium text-foreground">
                            {file.fileName}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeAttachment(file.id, file.fileUrl)}
                            className="z-10 shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            title={text.removeAttachment}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t bg-muted/35 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelAndClose}
              disabled={isPending}
            >
              {text.cancel}
            </Button>
            <Button
              type="submit"
              disabled={isPending || !formData.title.trim() || !formData.type}
            >
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {isPending ? text.creating : text.create}
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>
      <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
    </>
  );
}
