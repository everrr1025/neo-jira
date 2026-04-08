"use client";

import { useState, useTransition } from "react";
import { deleteIssue, updateIssue } from "@/app/actions/issues";
import { Check, Loader2, Trash2 } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import CommentSection from "./CommentSection";
import AttachmentUpload from "./AttachmentUpload";
import AlertPopup from "./AlertPopup";
import { useRouter } from "next/navigation";
import {
  getIssueStatusLabel,
  getIssueTypeLabel,
  getPriorityLabel,
  getTranslations,
  Locale,
  localeDateMap,
} from "@/lib/i18n";

type IssueUser = {
  id: string;
  name: string | null;
  role?: string | null;
};

type IssueIteration = {
  id: string;
  name: string;
};

type IssueRecord = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  status: string;
  type: string;
  priority: string;
  assigneeId: string | null;
  iterationId: string | null;
  dueDate: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  reporter: {
    name: string | null;
  } | null;
};

export default function IssueDetailClient({
  initialIssue,
  users,
  iterations = [],
  currentUserId,
  locale,
  canDeleteIssue,
}: {
  initialIssue: IssueRecord;
  users: IssueUser[];
  iterations?: IssueIteration[];
  currentUserId: string;
  locale: Locale;
  canDeleteIssue: boolean;
}) {
  const router = useRouter();
  const [issue, setIssue] = useState(initialIssue);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const translations = getTranslations(locale);

  const handleChange = <K extends keyof IssueRecord>(field: K, value: IssueRecord[K]) => {
    setIssue((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const dataToSave = {
        title: issue.title,
        description: issue.description,
        status: issue.status,
        type: issue.type,
        priority: issue.priority,
        assigneeId: issue.assigneeId,
        iterationId: issue.iterationId || null,
        dueDate: issue.dueDate || null,
      };
      
      const result = await updateIssue(issue.id, dataToSave);
      if (result.success) {
        setSuccessMsg(true);
        setTimeout(() => setSuccessMsg(false), 3000);
      } else {
        setAlertMessage(translations.issueDetail.failedToSave);
      }
    });
  };

  const handleDelete = async () => {
    if (!canDeleteIssue || isDeleting) return;

    const confirmed = window.confirm("Are you sure you want to delete this issue? This cannot be undone.");
    if (!confirmed) return;

    setAlertMessage("");
    setIsDeleting(true);
    try {
      const result = await deleteIssue(issue.id);
      if (!result.success) {
        setAlertMessage(result.error || "Failed to delete issue");
        setIsDeleting(false);
        return;
      }

      router.replace("/issues");
      router.refresh();
      setIsDeleting(false);
    } catch (error) {
      console.error(error);
      setAlertMessage("Failed to delete issue");
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 bg-white p-6 md:p-8 rounded-xl border shadow-sm">
      {/* Main Content Area */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 uppercase tracking-widest mb-2">
          <span>{issue.key}</span>
        </div>
        
        {/* Title */}
        <div>
          <input
            type="text"
            value={issue.title}
            onChange={(e) => handleChange("title", e.target.value)}
            className="w-full text-2xl font-bold text-slate-900 border-2 border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded-md px-2 py-1 -ml-2 transition-all outline-none"
            placeholder={translations.issueDetail.issueSummaryPlaceholder}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">{translations.issueDetail.description}</label>
          <div>
            <RichTextEditor
              value={issue.description || ""}
              onChange={(val) => handleChange("description", val || "")}
              height={340}
              mentionUsers={users}
              mentionLabel={translations.issueDetail.mentionSomeone}
              currentUserId={currentUserId}
            />
          </div>
        </div>
        
        {/* Save Button */}
        <div className="pt-4 flex flex-wrap items-center gap-4">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md font-medium text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Loader2 size={16} className="animate-spin" />}
            {translations.issueDetail.saveChanges}
          </button>
          
          {successMsg && (
            <span className="text-emerald-600 text-sm font-medium flex items-center gap-1 animate-in fade-in duration-300">
              <Check size={16} /> {translations.issueDetail.saved}
            </span>
          )}

          {canDeleteIssue && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-md font-medium text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {locale === "zh" ? "删除 Issue" : "Delete Issue"}
            </button>
          )}
        </div>

        <AlertPopup message={alertMessage} onClose={() => setAlertMessage("")} autoCloseMs={5000} />

        {/* Attachment Section */}
        <AttachmentUpload issueId={issue.id} locale={locale} />

        {/* Comment Section */}
        <CommentSection issueId={issue.id} currentUserId={currentUserId} users={users} locale={locale} />
      </div>

      {/* Sidebar Area */}
      <div className="w-full lg:w-80 flex flex-col gap-6">
        <div className="bg-slate-50 p-5 rounded-lg border border-slate-100 flex flex-col gap-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide border-b pb-2">{translations.issueDetail.properties}</h3>
          
          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">{translations.issueDetail.status}</label>
            <select
              value={issue.status}
              onChange={(e) => handleChange("status", e.target.value)}
              className="w-full border border-slate-200 rounded-md p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="TODO">{getIssueStatusLabel("TODO", locale)}</option>
              <option value="IN_PROGRESS">{getIssueStatusLabel("IN_PROGRESS", locale)}</option>
              <option value="IN_TESTING">{getIssueStatusLabel("IN_TESTING", locale)}</option>
              <option value="DONE">{getIssueStatusLabel("DONE", locale)}</option>
            </select>
          </div>

          {/* Sprint */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">{translations.issueDetail.sprint}</label>
            <select
              value={issue.iterationId || ""}
              onChange={(e) => handleChange("iterationId", e.target.value || null)}
              className="w-full border border-slate-200 rounded-md p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="">{translations.issueList.backlog}</option>
              {iterations.map((it) => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">{translations.issueDetail.type}</label>
            <select
              value={issue.type}
              onChange={(e) => handleChange("type", e.target.value)}
              className="w-full border border-slate-200 rounded-md p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="TASK">{getIssueTypeLabel("TASK", locale)}</option>
              <option value="STORY">{getIssueTypeLabel("STORY", locale)}</option>
              <option value="BUG">{getIssueTypeLabel("BUG", locale)}</option>
              <option value="EPIC">{getIssueTypeLabel("EPIC", locale)}</option>
            </select>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">{translations.issueDetail.priority}</label>
            <select
              value={issue.priority}
              onChange={(e) => handleChange("priority", e.target.value)}
              className="w-full border border-slate-200 rounded-md p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="LOW">{getPriorityLabel("LOW", locale)}</option>
              <option value="MEDIUM">{getPriorityLabel("MEDIUM", locale)}</option>
              <option value="HIGH">{getPriorityLabel("HIGH", locale)}</option>
              <option value="URGENT">{getPriorityLabel("URGENT", locale)}</option>
            </select>
          </div>

          {/* Assignee */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">{translations.issueDetail.assignee}</label>
            <select
              value={issue.assigneeId || ""}
              onChange={(e) => handleChange("assigneeId", e.target.value || null)}
              className="w-full border border-slate-200 rounded-md p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="">{translations.issueList.unassigned}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">{translations.issueDetail.dueDate}</label>
            <input
              type="date"
              value={issue.dueDate ? new Date(issue.dueDate).toISOString().split('T')[0] : ''}
              onChange={(e) => handleChange("dueDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
              className="w-full border border-slate-200 rounded-md p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            />
          </div>
          
          {/* Reporter (Read Only) */}
          <div className="flex flex-col gap-1.5 pt-2 border-t mt-2">
            <label className="text-xs font-semibold text-slate-500">{translations.issueDetail.reporter}</label>
            <div className="flex items-center gap-2 p-1.5">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                {issue.reporter?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-sm font-medium text-slate-700">{issue.reporter?.name || translations.issueDetail.unknown}</span>
            </div>
          </div>
        </div>
        
        <div className="text-xs text-slate-400 font-medium px-1">
          {translations.issueDetail.created}: {new Date(issue.createdAt).toLocaleString(localeDateMap[locale])}<br/>
          {translations.issueDetail.updated}: {new Date(issue.updatedAt).toLocaleString(localeDateMap[locale])}
        </div>
      </div>
    </div>
  );
}
