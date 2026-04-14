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
import { DropdownField } from "./DropdownField";

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
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const translations = getTranslations(locale);

  const handleChange = <K extends keyof IssueRecord>(field: K, value: IssueRecord[K]) => {
    setIssue((prev) => ({ ...prev, [field]: value }));
  };

  const handleAutoSave = <K extends keyof IssueRecord>(field: K, value: IssueRecord[K]) => {
    setIssue((prev) => ({ ...prev, [field]: value }));
    startTransition(async () => {
      const result = await updateIssue(issue.id, { [field]: value });
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
        <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-500 uppercase tracking-widest mb-2">
          <div className="flex items-center gap-3">
            <span>{issue.key}</span>
            {successMsg && (
              <span className="text-emerald-600 text-xs font-medium flex items-center gap-1 animate-in fade-in duration-300 normal-case tracking-normal">
                <Check size={14} /> {translations.issueDetail.saved}
              </span>
            )}
            {isPending && !successMsg && (
              <span className="text-blue-600 text-xs font-medium flex items-center gap-1 animate-in fade-in duration-300 normal-case tracking-normal">
                <Loader2 size={14} className="animate-spin" /> Saving...
              </span>
            )}
          </div>
          
          {canDeleteIssue && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors flex items-center disabled:opacity-50"
              title={locale === "zh" ? "删除 Issue" : "Delete Issue"}
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          )}
        </div>
        
        {/* Title */}
        <div>
          <input
            type="text"
            value={issue.title}
            onChange={(e) => handleChange("title", e.target.value)}
            onBlur={(e) => handleAutoSave("title", e.target.value)}
            className="w-full text-2xl font-bold text-slate-900 border-2 border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded-md px-2 py-1 -ml-2 transition-all outline-none"
            placeholder={translations.issueDetail.issueSummaryPlaceholder}
          />
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-bold text-slate-700">{translations.issueDetail.description}</label>
            {!isEditingDescription ? (
              <button
                onClick={() => setIsEditingDescription(true)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                title={locale === "zh" ? "编辑描述" : "Edit description"}
              >
                {locale === "zh" ? "编辑" : "Edit"}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    handleAutoSave("description", issue.description);
                    setIsEditingDescription(false);
                  }}
                  className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1 shadow-sm"
                >
                  {isPending && <Loader2 size={12} className="animate-spin" />}
                  {locale === "zh" ? "保存" : "Save"}
                </button>
                <button
                  onClick={() => setIsEditingDescription(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                >
                  {locale === "zh" ? "取消" : "Cancel"}
                </button>
              </div>
            )}
          </div>
          <div className={isEditingDescription ? "" : "rounded-lg border bg-white p-3"}>
            <RichTextEditor
              value={issue.description || ""}
              onChange={(val) => handleChange("description", val || "")}
              height={340}
              mentionUsers={users}
              mentionLabel={translations.issueDetail.mentionSomeone}
              currentUserId={currentUserId}
              readOnly={!isEditingDescription}
            />
          </div>
        </div>
        


        <AlertPopup message={alertMessage} onClose={() => setAlertMessage("")} autoCloseMs={5000} />

        {/* Attachment Section */}
        <AttachmentUpload issueId={issue.id} locale={locale} />

        {/* Comment Section */}
        <CommentSection issueId={issue.id} currentUserId={currentUserId} users={users} locale={locale} />
      </div>

      {/* Sidebar Area */}
      <div className="w-full shrink-0 flex flex-col gap-6 lg:w-56 xl:w-52">
        <div className="bg-slate-50 p-5 rounded-lg border border-slate-100 flex flex-col gap-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide border-b pb-2">{translations.issueDetail.properties}</h3>
          
          {/* Status */}
          <DropdownField
            id="status"
            label={translations.issueDetail.status}
            value={issue.status}
            onChange={(val) => handleAutoSave("status", val)}
            options={[
              { value: "TODO", label: getIssueStatusLabel("TODO", locale) },
              { value: "IN_PROGRESS", label: getIssueStatusLabel("IN_PROGRESS", locale) },
              { value: "IN_TESTING", label: getIssueStatusLabel("IN_TESTING", locale) },
              { value: "DONE", label: getIssueStatusLabel("DONE", locale) },
            ]}
          />

          {/* Sprint */}
          <DropdownField
            id="iteration"
            label={translations.issueDetail.sprint}
            value={issue.iterationId || ""}
            onChange={(val) => handleAutoSave("iterationId", val || null)}
            options={[
              { value: "", label: translations.issueList.backlog },
              ...iterations.map((it) => ({ value: it.id, label: it.name })),
            ]}
          />

          {/* Type */}
          <DropdownField
            id="type"
            label={translations.issueDetail.type}
            value={issue.type}
            onChange={(val) => handleAutoSave("type", val)}
            options={[
              { value: "TASK", label: getIssueTypeLabel("TASK", locale) },
              { value: "STORY", label: getIssueTypeLabel("STORY", locale) },
              { value: "BUG", label: getIssueTypeLabel("BUG", locale) },
              { value: "EPIC", label: getIssueTypeLabel("EPIC", locale) },
            ]}
          />

          {/* Priority */}
          <DropdownField
            id="priority"
            label={translations.issueDetail.priority}
            value={issue.priority}
            onChange={(val) => handleAutoSave("priority", val)}
            options={[
              { value: "LOW", label: getPriorityLabel("LOW", locale) },
              { value: "MEDIUM", label: getPriorityLabel("MEDIUM", locale) },
              { value: "HIGH", label: getPriorityLabel("HIGH", locale) },
              { value: "URGENT", label: getPriorityLabel("URGENT", locale) },
            ]}
          />

          {/* Assignee */}
          <DropdownField
            id="assignee"
            label={translations.issueDetail.assignee}
            value={issue.assigneeId || ""}
            onChange={(val) => handleAutoSave("assigneeId", val || null)}
            options={[
              { value: "", label: translations.issueList.unassigned },
              ...users.map((u) => ({ value: u.id, label: u.name || u.id })),
            ]}
          />

          {/* Due Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">{translations.issueDetail.dueDate}</label>
            <input
              type="date"
              value={issue.dueDate ? new Date(issue.dueDate).toISOString().split('T')[0] : ''}
              onChange={(e) => handleAutoSave("dueDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
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
