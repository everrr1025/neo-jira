"use client";

import { useState, useTransition, useEffect } from "react";
import { createIssue } from "@/app/actions/issues";
import { X } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import AlertPopup from "./AlertPopup";
import { getIssueTypeLabel, getPriorityLabel, getTranslations, Locale } from "@/lib/i18n";

type CreateIssueModalProps = {
  isOpen: boolean;
  onClose: () => void;
  users: any[];
  iterations: any[];
  locale: Locale;
};

export default function CreateIssueModal({ isOpen, onClose, users, iterations, locale }: CreateIssueModalProps) {
  const [isPending, startTransition] = useTransition();
  const translations = getTranslations(locale);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "TASK",
    priority: "MEDIUM",
    iterationId: "",
    assigneeId: "",
    dueDate: "",
  });

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const desc = formData.description;
    const match = desc.match(/(?:\s|^)@([^\s]*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
    } else {
      setMentionQuery(null);
    }
  }, [formData.description]);

  useEffect(() => {
    if (!isOpen && errorMessage) {
      setErrorMessage("");
    }
  }, [isOpen, errorMessage]);

  const filteredUsers = mentionQuery !== null
    ? users.filter(u => u.name?.toLowerCase().includes(mentionQuery))
    : [];

  const handleMentionInsert = (name: string) => {
    const desc = formData.description;
    const match = desc.match(/(?:\s|^)@([^\s]*)$/);
    if (match) {
      const index = desc.lastIndexOf(`@${match[1]}`);
      if (index !== -1) {
        const textBefore = desc.substring(0, index);
        const textAfter = desc.substring(index + match[1].length + 1);
        setFormData(prev => ({ ...prev, description: textBefore + `@${name} ` + textAfter }));
      }
    }
    setMentionQuery(null);
  };

  if (!isOpen) return null;

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
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
      };
      
      const result = await createIssue(payload);
      if (result.success) {
        setFormData({ title: "", description: "", type: "TASK", priority: "MEDIUM", iterationId: "", assigneeId: "", dueDate: "" });
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
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            
            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-sm font-medium text-slate-700">{translations.createIssue.summary} <span className="text-red-500">*</span></label>
              <input 
                id="title"
                required
                autoFocus
                value={formData.title}
                onChange={(e) => setFormData(prev => ({...prev, title: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
                placeholder={translations.createIssue.summaryPlaceholder}
              />
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="type" className="text-sm font-medium text-slate-700">{translations.createIssue.issueType}</label>
                <select 
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({...prev, type: e.target.value}))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
                >
                  <option value="TASK">{getIssueTypeLabel("TASK", locale)}</option>
                  <option value="STORY">{getIssueTypeLabel("STORY", locale)}</option>
                  <option value="BUG">{getIssueTypeLabel("BUG", locale)}</option>
                  <option value="EPIC">{getIssueTypeLabel("EPIC", locale)}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="priority" className="text-sm font-medium text-slate-700">{translations.createIssue.priority}</label>
                <select 
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({...prev, priority: e.target.value}))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
                >
                  <option value="LOW">{getPriorityLabel("LOW", locale)}</option>
                  <option value="MEDIUM">{getPriorityLabel("MEDIUM", locale)}</option>
                  <option value="HIGH">{getPriorityLabel("HIGH", locale)}</option>
                  <option value="URGENT">{getPriorityLabel("URGENT", locale)}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="iteration" className="text-sm font-medium text-slate-700">{translations.createIssue.sprint}</label>
                <select 
                  id="iteration"
                  value={formData.iterationId}
                  onChange={(e) => setFormData(prev => ({...prev, iterationId: e.target.value}))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
                >
                  <option value="">{translations.issueList.backlog}</option>
                  {iterations.map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="assignee" className="text-sm font-medium text-slate-700">{translations.createIssue.assignee}</label>
                <select 
                  id="assignee"
                  value={formData.assigneeId}
                  onChange={(e) => setFormData(prev => ({...prev, assigneeId: e.target.value}))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
                >
                  <option value="">{translations.issueList.unassigned}</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="dueDate" className="text-sm font-medium text-slate-700">{translations.createIssue.dueDate}</label>
                <input 
                  type="date"
                  id="dueDate"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({...prev, dueDate: e.target.value}))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 h-64 mb-10 border-b pb-4 relative z-0">
              <label htmlFor="description" className="text-sm font-medium text-slate-700">{translations.createIssue.description}</label>
              <div className="border border-slate-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-shadow">
                <RichTextEditor 
                  value={formData.description}
                  onChange={(val) => setFormData(prev => ({...prev, description: val || ""}))}
                  height={220}
                />
              </div>
              {mentionQuery !== null && filteredUsers.length > 0 && (
                <div className="absolute top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg max-h-40 overflow-y-auto w-full md:w-64 animate-in fade-in zoom-in-95 duration-100 z-[99]">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-100">
                    {translations.createIssue.mentionSomeone}
                  </div>
                  {filteredUsers.map(u => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => handleMentionInsert(u.name)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                        {u.name?.charAt(0) || "U"}
                      </div>
                      {u.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 mt-auto">
            <button 
              type="button" 
              onClick={onClose}
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
              ) : translations.createIssue.create}
            </button>
          </div>
        </form>
      </div>
      <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
    </div>
  );
}
