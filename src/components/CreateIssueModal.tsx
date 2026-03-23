"use client";

import { useState, useTransition } from "react";
import { createIssue } from "@/app/actions/issues";
import { X } from "lucide-react";

type CreateIssueModalProps = {
  isOpen: boolean;
  onClose: () => void;
  users: any[];
  iterations: any[];
};

export default function CreateIssueModal({ isOpen, onClose, users, iterations }: CreateIssueModalProps) {
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "TASK",
    priority: "MEDIUM",
    iterationId: "",
    assigneeId: "",
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    startTransition(async () => {
      const payload = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        iterationId: formData.iterationId || null,
        assigneeId: formData.assigneeId || null,
      };
      
      const result = await createIssue(payload);
      if (result.success) {
        setFormData({ title: "", description: "", type: "TASK", priority: "MEDIUM", iterationId: "", assigneeId: "" });
        onClose();
      } else {
        alert("Failed to create issue: " + result.error);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Create Issue</h2>
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
              <label htmlFor="title" className="text-sm font-medium text-slate-700">Summary <span className="text-red-500">*</span></label>
              <input 
                id="title"
                required
                autoFocus
                value={formData.title}
                onChange={(e) => setFormData(prev => ({...prev, title: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
                placeholder="What needs to be done?"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="type" className="text-sm font-medium text-slate-700">Issue Type</label>
                <select 
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({...prev, type: e.target.value}))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
                >
                  <option value="TASK">Task</option>
                  <option value="STORY">Story</option>
                  <option value="BUG">Bug</option>
                  <option value="EPIC">Epic</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="priority" className="text-sm font-medium text-slate-700">Priority</label>
                <select 
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({...prev, priority: e.target.value}))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="iteration" className="text-sm font-medium text-slate-700">Sprint</label>
                <select 
                  id="iteration"
                  value={formData.iterationId}
                  onChange={(e) => setFormData(prev => ({...prev, iterationId: e.target.value}))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
                >
                  <option value="">Backlog</option>
                  {iterations.map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="assignee" className="text-sm font-medium text-slate-700">Assignee</label>
                <select 
                  id="assignee"
                  value={formData.assigneeId}
                  onChange={(e) => setFormData(prev => ({...prev, assigneeId: e.target.value}))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-sm font-medium text-slate-700">Description</label>
              <textarea 
                id="description"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow resize-none"
                placeholder="Add more details about this issue..."
              />
            </div>

          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 mt-auto">
            <button 
              type="button" 
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isPending || !formData.title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
