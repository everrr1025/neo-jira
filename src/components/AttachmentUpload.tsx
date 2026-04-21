"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Paperclip, Trash2 } from "lucide-react";

import { emitIssueActivityUpdated } from "@/lib/issueActivityEvents";
import { getTranslations, type Locale } from "@/lib/i18n";

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  createdAt: string;
  uploaderId?: string;
  uploader: { name: string };
}

export default function AttachmentUpload({ issueId, locale }: { issueId: string; locale: Locale }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const translations = getTranslations(locale);
  const text = translations.attachmentSection;

  const fetchAttachments = useCallback(async () => {
    try {
      const response = await fetch(`/api/issues/${issueId}/attachments`);
      if (!response.ok) return;
      const data = (await response.json()) as Attachment[];
      setAttachments(data);
    } catch (error) {
      console.error(error);
    }
  }, [issueId]);

  useEffect(() => {
    void fetchAttachments();
  }, [fetchAttachments]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;

    setErrorMsg("");
    const file = event.target.files[0];
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg(text.fileTooLarge);
      event.target.value = "";
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("issueId", issueId);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const newAttachment = (await response.json()) as Attachment;
        setAttachments((current) => [newAttachment, ...current]);
        emitIssueActivityUpdated(issueId);
      } else {
        const errorData = await response.json().catch(() => null);
        setErrorMsg(`${text.uploadFailed}: ${errorData?.error || response.statusText || "Unknown error"}`);
      }
    } catch (error) {
      console.error(error);
      setErrorMsg(text.uploadFailed);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const executeDelete = async (id: string) => {
    setErrorMsg("");
    setConfirmDeleteId(null);

    try {
      const response = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      if (response.ok) {
        setAttachments((current) => current.filter((attachment) => attachment.id !== id));
        emitIssueActivityUpdated(issueId);
      } else {
        const errorData = await response.json().catch(() => null);
        setErrorMsg(`${text.deleteFailed}: ${errorData?.error || response.statusText}`);
      }
    } catch (error) {
      console.error("Delete error:", error);
      setErrorMsg(text.deleteFailed);
    }
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i)) return "IMAGE";
    if (fileName.match(/\.(pdf)$/i)) return "PDF";
    if (fileName.match(/\.(xls|xlsx|csv)$/i)) return "EXCEL";
    if (fileName.match(/\.(doc|docx)$/i)) return "WORD";
    return "OTHER";
  };

  return (
    <div className="mt-8">
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            {text.title} ({attachments.length})
          </h3>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
            {uploading ? text.uploading : text.addFile}
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>

        {errorMsg && (
          <div className="flex items-center justify-between rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg("")} className="ml-4 font-bold hover:text-red-800">
              ×
            </button>
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {attachments.map((file) => {
            const fileType = getFileIcon(file.fileName);

            return (
              <div
                key={file.id}
                className="group relative flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 transition-all hover:border-blue-400 hover:shadow-sm"
              >
                <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="block focus:outline-none">
                  <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-slate-50 transition-colors hover:bg-slate-100">
                    {fileType === "IMAGE" && (
                      <img src={file.fileUrl} alt={file.fileName} className="h-full w-full object-cover" />
                    )}
                    {fileType === "PDF" && <FileText size={32} className="text-red-500" />}
                    {fileType === "EXCEL" && <FileText size={32} className="text-green-600" />}
                    {fileType === "WORD" && <FileText size={32} className="text-blue-600" />}
                    {fileType === "OTHER" && <FileText size={32} className="text-slate-400" />}
                  </div>
                </a>

                <div className="flex items-center justify-between px-1">
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full truncate pr-2 text-xs font-medium text-slate-700 outline-none hover:text-blue-600"
                  >
                    {file.fileName}
                  </a>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setConfirmDeleteId(file.id);
                    }}
                    className="z-10 shrink-0 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-500 group-hover:opacity-100"
                    title={text.delete}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {confirmDeleteId === file.id && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg border border-red-200 bg-white/95 p-2 shadow-sm backdrop-blur-sm">
                    <span className="mb-2 max-w-full truncate text-center text-xs font-bold text-slate-700">
                      {text.confirmDelete}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void executeDelete(file.id);
                        }}
                        className="rounded bg-red-500 px-3 py-1 text-xs text-white shadow-sm hover:bg-red-600"
                      >
                        {text.confirm}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="rounded bg-slate-100 px-3 py-1 text-xs text-slate-600 shadow-sm hover:bg-slate-200"
                      >
                        {text.cancel}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
