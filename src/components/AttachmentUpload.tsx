"use client";

import { useState, useEffect } from "react";
import { Paperclip, Loader2, FileText } from "lucide-react";
import { getTranslations, Locale } from "@/lib/i18n";

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  createdAt: string;
  uploader: { name: string };
}

export default function AttachmentUpload({ issueId, locale }: { issueId: string; locale: Locale }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const translations = getTranslations(locale);

  useEffect(() => {
    fetchAttachments();
  }, [issueId]);

  const fetchAttachments = async () => {
    try {
      const res = await fetch(`/api/issues/${issueId}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setAttachments(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploading(true);
    const file = e.target.files[0];
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
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
      e.target.value = ''; // reset
    }
  };

  return (
    <div className="mt-8 border-t pt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-slate-800">{translations.attachmentSection.title} ({attachments.length})</h3>
        <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 shadow-sm border border-slate-200">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
          {uploading ? translations.attachmentSection.uploading : translations.attachmentSection.addFile}
          <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
        </label>
      </div>

      {attachments.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          {attachments.map((file) => {
            const isImage = file.fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i);
            return (
              <a key={file.id} href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="border border-slate-200 rounded-lg p-2 flex flex-col gap-2 hover:border-blue-400 hover:shadow-sm transition-all group bg-white">
                <div className="h-24 w-full bg-slate-50 flex flex-col items-center justify-center rounded-md overflow-hidden relative border border-slate-100">
                  {isImage ? (
                    <img src={file.fileUrl} alt={file.fileName} className="object-cover w-full h-full" />
                  ) : (
                    <FileText size={32} className="text-slate-400" />
                  )}
                </div>
                <div className="text-xs truncate font-medium text-slate-700 group-hover:text-blue-600">
                  {file.fileName}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
