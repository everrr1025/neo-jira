"use client";

import { useState, useTransition, useEffect } from "react";
import { updateIssue } from "@/app/actions/issues";
import { Check, Loader2 } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import CommentSection from "./CommentSection";
import AttachmentUpload from "./AttachmentUpload";

export default function IssueDetailClient({ initialIssue, users, iterations = [], currentUserId }: { initialIssue: any, users: any[], iterations?: any[], currentUserId: string }) {
  const [issue, setIssue] = useState(initialIssue);
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  useEffect(() => {
    const desc = issue.description || "";
    const match = desc.match(/(?:\s|^)@([^\s]*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
    } else {
      setMentionQuery(null);
    }
  }, [issue.description]);

  const filteredUsers = mentionQuery !== null && users
    ? users.filter(u => u.name?.toLowerCase().includes(mentionQuery) && u.id !== currentUserId)
    : [];

  const handleMentionInsert = (name: string) => {
    const desc = issue.description || "";
    const match = desc.match(/(?:\s|^)@([^\s]*)$/);
    if (match) {
      const index = desc.lastIndexOf(`@${match[1]}`);
      if (index !== -1) {
        const textBefore = desc.substring(0, index);
        const textAfter = desc.substring(index + match[1].length + 1);
        handleChange("description", textBefore + `@${name} ` + textAfter);
      }
    }
    setMentionQuery(null);
  };

  const handleChange = (field: string, value: any) => {
    setIssue((prev: any) => ({ ...prev, [field]: value }));
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
        alert("Failed to save changes");
      }
    });
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
            placeholder="Issue Summary"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
          <div className="border-2 border-slate-200 rounded-md overflow-hidden focus-within:border-transparent transition-all">
            <RichTextEditor
              value={issue.description || ""}
              onChange={(val) => handleChange("description", val || "")}
              height={300}
            />
          </div>
          {mentionQuery !== null && filteredUsers.length > 0 && (
            <div className="mt-1 bg-white border border-slate-200 shadow-md rounded-lg max-h-40 overflow-y-auto w-full md:w-64 animate-in fade-in zoom-in-95 duration-100 z-10 relative">
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-100">
                Mention someone
              </div>
              {filteredUsers.map(u => (
                <button
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
        
        {/* Save Button */}
        <div className="pt-4 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md font-medium text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Loader2 size={16} className="animate-spin" />}
            Save Changes
          </button>
          
          {successMsg && (
            <span className="text-emerald-600 text-sm font-medium flex items-center gap-1 animate-in fade-in duration-300">
              <Check size={16} /> Saved
            </span>
          )}
        </div>

        {/* Attachment Section */}
        <AttachmentUpload issueId={issue.id} />

        {/* Comment Section */}
        <CommentSection issueId={issue.id} currentUserId={currentUserId} users={users} />
      </div>

      {/* Sidebar Area */}
      <div className="w-full lg:w-80 flex flex-col gap-6">
        <div className="bg-slate-50 p-5 rounded-lg border border-slate-100 flex flex-col gap-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide border-b pb-2">Properties</h3>
          
          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Status</label>
            <select
              value={issue.status}
              onChange={(e) => handleChange("status", e.target.value)}
              className="w-full border border-slate-200 rounded-md p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_TESTING">In Testing</option>
              <option value="DONE">Done</option>
            </select>
          </div>

          {/* Sprint */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Sprint</label>
            <select
              value={issue.iterationId || ""}
              onChange={(e) => handleChange("iterationId", e.target.value || null)}
              className="w-full border border-slate-200 rounded-md p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="">Backlog</option>
              {iterations.map((it) => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Type</label>
            <select
              value={issue.type}
              onChange={(e) => handleChange("type", e.target.value)}
              className="w-full border border-slate-200 rounded-md p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="TASK">Task</option>
              <option value="STORY">Story</option>
              <option value="BUG">Bug</option>
              <option value="EPIC">Epic</option>
            </select>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Priority</label>
            <select
              value={issue.priority}
              onChange={(e) => handleChange("priority", e.target.value)}
              className="w-full border border-slate-200 rounded-md p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          {/* Assignee */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Assignee</label>
            <select
              value={issue.assigneeId || ""}
              onChange={(e) => handleChange("assigneeId", e.target.value || null)}
              className="w-full border border-slate-200 rounded-md p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Due Date</label>
            <input
              type="date"
              value={issue.dueDate ? new Date(issue.dueDate).toISOString().split('T')[0] : ''}
              onChange={(e) => handleChange("dueDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
              className="w-full border border-slate-200 rounded-md p-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            />
          </div>
          
          {/* Reporter (Read Only) */}
          <div className="flex flex-col gap-1.5 pt-2 border-t mt-2">
            <label className="text-xs font-semibold text-slate-500">Reporter</label>
            <div className="flex items-center gap-2 p-1.5">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                {issue.reporter?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-sm font-medium text-slate-700">{issue.reporter?.name || 'Unknown'}</span>
            </div>
          </div>
        </div>
        
        <div className="text-xs text-slate-400 font-medium px-1">
          Created: {new Date(issue.createdAt).toLocaleString()}<br/>
          Updated: {new Date(issue.updatedAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
