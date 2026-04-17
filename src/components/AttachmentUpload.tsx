"use client";

import { useState, useEffect, useCallback } from "react";
import { Paperclip, Loader2, FileText, Trash2 } from "lucide-react";
import { getTranslations, Locale } from "@/lib/i18n";
import { emitIssueActivityUpdated } from "@/lib/issueActivityEvents";

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

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/issues/${issueId}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setAttachments(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [issueId]);

  useEffect(() => {
    void fetchAttachments();
  }, [fetchAttachments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setErrorMsg("");
    const file = e.target.files[0];
    
    // 50MB Size Limit Check
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg("文件大小不能超过 50MB");
      e.target.value = '';
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("issueId", issueId);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      if (res.ok) {
        const newAttachment = await res.json();
        setAttachments([newAttachment, ...attachments]);
        emitIssueActivityUpdated(issueId);
      } else {
        const errorData = await res.json().catch(() => null);
        setErrorMsg(`上传失败: ${errorData?.error || res.statusText || '未知错误'}`);
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("上传失败，请检查网络连接");
    } finally {
      setUploading(false);
      e.target.value = ''; // reset
    }
  };

  const executeDelete = async (id: string) => {
    setErrorMsg("");
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/attachments/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAttachments(attachments.filter(a => a.id !== id));
        emitIssueActivityUpdated(issueId);
      } else {
        const errorData = await res.json().catch(() => null);
        setErrorMsg(`删除失败: ${errorData?.error || res.statusText}`);
      }
    } catch (error) {
      console.error("Delete error:", error);
      setErrorMsg("删除失败，请检查网络");
    }
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

  return (
    <div className="mt-8">
      <div className="flex flex-col mb-4 gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-800">{translations.attachmentSection.title} ({attachments.length})</h3>
          <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 border border-slate-200">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
            {uploading ? translations.attachmentSection.uploading : translations.attachmentSection.addFile}
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>
        {errorMsg && (
          <div className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-md transition-all flex justify-between items-center">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg("")} className="hover:text-red-800 font-bold ml-4">✕</button>
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          {attachments.map((file) => {
            const fileType = getFileIcon(file.fileName);
            
            return (
              <div key={file.id} className="relative border border-slate-200 rounded-lg p-2 flex flex-col gap-2 hover:border-blue-400 hover:shadow-sm transition-all group bg-white">
                <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="block focus:outline-none">
                  <div className="h-24 w-full bg-slate-50 flex flex-col items-center justify-center rounded-md overflow-hidden relative border border-slate-100 hover:bg-slate-100 transition-colors">
                    {fileType === "IMAGE" && (
                      <img src={file.fileUrl} alt={file.fileName} className="object-cover w-full h-full" />
                    )}
                    {fileType === "PDF" && <FileText size={32} className="text-red-500" />}
                    {fileType === "EXCEL" && <FileText size={32} className="text-green-600" />}
                    {fileType === "WORD" && <FileText size={32} className="text-blue-600" />}
                    {fileType === "OTHER" && <FileText size={32} className="text-slate-400" />}
                  </div>
                </a>
                <div className="flex justify-between items-center px-1">
                  <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs truncate font-medium text-slate-700 hover:text-blue-600 pr-2 block w-full outline-none">
                    {file.fileName}
                  </a>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(file.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity rounded-md hover:bg-slate-100 z-10 shrink-0"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Inline Delete Confirmation Layer */}
                {confirmDeleteId === file.id && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 rounded-lg flex flex-col items-center justify-center p-2 border border-red-200 shadow-sm animate-in fade-in duration-150">
                    <span className="text-xs font-bold text-slate-700 mb-2 truncate max-w-full text-center">确定删除?</span>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); executeDelete(file.id); }}
                        className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded shadow-sm focus:outline-none"
                      >
                        确认
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null); }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs px-3 py-1 rounded shadow-sm focus:outline-none"
                      >
                        取消
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
