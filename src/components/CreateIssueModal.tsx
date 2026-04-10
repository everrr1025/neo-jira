"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createIssue } from "@/app/actions/issues";
import { Check, ChevronDown, X, Paperclip, Loader2, FileText, Trash2 } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import AlertPopup from "./AlertPopup";
import { getIssueTypeLabel, getPriorityLabel, getTranslations, Locale } from "@/lib/i18n";
import { DropdownField } from "./DropdownField";

type CreateIssueModalProps = {
  isOpen: boolean;
  onClose: () => void;
  users: CreateIssueUser[];
  iterations: CreateIssueIteration[];
  locale: Locale;
  currentUserId?: string;
  defaultIterationId?: string;
  defaultDueDate?: string;
};

export type CreateIssueUser = {
  id: string;
  name: string | null;
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
  iterations,
  locale,
  currentUserId,
  defaultIterationId,
  defaultDueDate,
}: CreateIssueModalProps) {
  const [isPending, startTransition] = useTransition();
  const translations = getTranslations(locale);

  const getInitialFormData = (): FormDataState => {
    const fallbackIteration = iterations.find((item) => item.id === defaultIterationId);
    return {
      title: "",
      description: "",
      type: "TASK",
      priority: "MEDIUM",
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setErrorMessage("");
    const file = e.target.files[0];
    
    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage("文件大小不能超过 50MB");
      e.target.value = '';
      return;
    }

    setUploading(true);
    const data = new FormData();
    data.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });
      
      if (res.ok) {
        const result = await res.json();
        setFormData(prev => ({
          ...prev,
          attachments: [...prev.attachments, { fileName: result.fileName, fileUrl: result.fileUrl, id: Date.now().toString() }]
        }));
      } else {
        const errorData = await res.json().catch(() => null);
        setErrorMessage(`上传失败: ${errorData?.error || res.statusText || '未知错误'}`);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("上传失败，请检查网络连接");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeAttachment = async (id: string, fileUrl: string) => {
    // Optimistically update UI
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(a => a.id !== id)
    }));

    // Delete from server
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
    if (formData.attachments.length > 0) {
      try {
        await Promise.all(
          formData.attachments.map(a => 
            fetch("/api/upload", {
              method: "DELETE",
              body: JSON.stringify({ fileUrl: a.fileUrl }),
              headers: { "Content-Type": "application/json" },
            })
          )
        );
      } catch (error) {
        console.error("Failed to cleanup attachments:", error);
      }
    }
    onClose();
  };

  const getFileIcon = (fileName: string) => {
    const isImage = fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i);
    if (isImage) return "IMAGE";
    const isPdf = fileName.match(/\.(pdf)$/i);
    if (isPdf) return "PDF";
    const isExcel = fileName.match(/\.(xls|xlsx|csv)$/i);
    if (isExcel) return "EXCEL";
    const isWord = fileName.match(/\.(doc|docx)$/i);
    if (isWord) return "WORD";
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
  const priorityOptions: DropdownOption[] = [
    { value: "LOW", label: getPriorityLabel("LOW", locale) },
    { value: "MEDIUM", label: getPriorityLabel("MEDIUM", locale) },
    { value: "HIGH", label: getPriorityLabel("HIGH", locale) },
    { value: "URGENT", label: getPriorityLabel("URGENT", locale) },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setErrorMessage("");
    startTransition(async () => {
      const payload = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        iterationId: formData.iterationId || null,
        assigneeId: formData.assigneeId || null,
        dueDate: formData.dueDate || null,
        attachments: formData.attachments.map(a => ({ fileName: a.fileName, fileUrl: a.fileUrl })),
      };

      const result = await createIssue(payload);
      if (result.success) {
        setFormData(getInitialFormData());
        setIsDueDateManuallyEdited(false);
        onClose();
      } else {
        setErrorMessage(`${translations.createIssue.failedCreateIssue}: ${result.error}`);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">{translations.createIssue.modalTitle}</h2>
          <button
            onClick={handleCancelAndClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-5 flex-1 overflow-y-auto min-h-0">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-sm font-medium text-slate-700">
                {translations.createIssue.summary} <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                required
                autoFocus
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
                placeholder={translations.createIssue.summaryPlaceholder}
              />
            </div>

            <div className="flex gap-4">
              <DropdownField
                id="type"
                label={translations.createIssue.issueType}
                value={formData.type}
                onChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
                options={typeOptions}
                className="flex-1"
              />
              <DropdownField
                id="priority"
                label={translations.createIssue.priority}
                value={formData.priority}
                onChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}
                options={priorityOptions}
                className="flex-1"
              />
            </div>

            <div className="flex gap-4">
              <DropdownField
                id="iteration"
                label={translations.createIssue.sprint}
                value={formData.iterationId}
                onChange={handleSprintChange}
                options={iterationOptions}
                className="flex-1"
              />
              <DropdownField
                id="assignee"
                label={translations.createIssue.assignee}
                value={formData.assigneeId}
                onChange={(value) => setFormData((prev) => ({ ...prev, assigneeId: value }))}
                options={assigneeOptions}
                className="flex-1"
              />
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="dueDate" className="text-sm font-medium text-slate-700">
                  {translations.createIssue.dueDate}
                </label>
                <input
                  type="date"
                  id="dueDate"
                  value={formData.dueDate}
                  onChange={(e) => {
                    setIsDueDateManuallyEdited(true);
                    setFormData((prev) => ({ ...prev, dueDate: e.target.value }));
                  }}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mb-2 relative">
              <label htmlFor="description" className="text-sm font-medium text-slate-700">
                {translations.createIssue.description}
              </label>
              <div>
                <RichTextEditor
                  value={formData.description}
                  onChange={(value) => setFormData((prev) => ({ ...prev, description: value || "" }))}
                  height={180}
                  mentionUsers={users}
                  mentionLabel={translations.createIssue.mentionSomeone}
                  currentUserId={currentUserId}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 relative z-0 pb-2">
               <div className="flex items-center justify-between">
                 <label className="text-sm font-medium text-slate-700">
                   附件 ({formData.attachments.length})
                 </label>
                 <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 shadow-sm border border-slate-200">
                   {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                   {uploading ? '上传中...' : '添加附件'}
                   <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading || isPending} />
                 </label>
               </div>
               
               {formData.attachments.length > 0 && (
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                   {formData.attachments.map((file) => {
                     const fileType = getFileIcon(file.fileName);
                     return (
                       <div key={file.id} className="relative border border-slate-200 rounded-lg p-2 flex flex-col gap-2 hover:border-blue-400 hover:shadow-sm transition-all group bg-white">
                         <div className="h-24 w-full bg-slate-50 flex flex-col items-center justify-center rounded-md overflow-hidden relative border border-slate-100 hover:bg-slate-100 transition-colors">
                           {fileType === "IMAGE" && (
                             <img src={file.fileUrl} alt={file.fileName} className="object-cover w-full h-full" />
                           )}
                           {fileType === "PDF" && <FileText size={24} className="text-red-500" />}
                           {fileType === "EXCEL" && <FileText size={24} className="text-green-600" />}
                           {fileType === "WORD" && <FileText size={24} className="text-blue-600" />}
                           {fileType === "OTHER" && <FileText size={24} className="text-slate-400" />}
                         </div>
                         <div className="flex justify-between items-center px-1">
                           <span className="text-xs truncate font-medium text-slate-700 pr-2 block w-full">
                             {file.fileName}
                           </span>
                           <button
                             type="button"
                             onClick={() => removeAttachment(file.id, file.fileUrl)}
                             className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity rounded-md hover:bg-slate-100 z-10 shrink-0"
                             title="删除"
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

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCancelAndClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {translations.createIssue.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending || !formData.title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {translations.createIssue.creating}
                </>
              ) : (
                translations.createIssue.create
              )}
            </button>
          </div>
        </form>
      </div>
      <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
    </div>
  );
}
