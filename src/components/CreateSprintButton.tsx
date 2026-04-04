"use client";

import { useState, useTransition } from "react";
import { createSprint } from "@/app/actions/sprints";
import { Loader2, Plus, X } from "lucide-react";
import { getTranslations, Locale } from "@/lib/i18n";
import AlertPopup from "./AlertPopup";

export function CreateSprintButton({ projects, locale }: { projects: { id: string; name: string; key: string }[]; locale: Locale }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const translations = getTranslations(locale);
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    projectId: projects[0]?.id || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await createSprint(formData);
      if (res.success) {
        setIsOpen(false);
        setFormData({ name: "", startDate: "", endDate: "", projectId: projects[0]?.id || "" });
      } else {
        setError(res.error || translations.createSprint.failedCreateSprint);
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
      >
        <Plus size={16} /> {translations.createSprint.createSprint}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-slate-800">{translations.createSprint.modalTitle}</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{translations.createSprint.project}</label>
                <select
                  required
                  value={formData.projectId}
                  onChange={e => setFormData(p => ({ ...p, projectId: e.target.value }))}
                  className="w-full border-slate-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white"
                >
                  {projects.map(proj => (
                    <option key={proj.id} value={proj.id}>{proj.name} ({proj.key})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{translations.createSprint.sprintName}</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full border-slate-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder={translations.createSprint.sprintNamePlaceholder}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{translations.createSprint.startDate}</label>
                  <input
                    required
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full border-slate-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{translations.createSprint.endDate}</label>
                  <input
                    required
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full border-slate-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                disabled={isPending}
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-md transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isPending && <Loader2 size={16} className="animate-spin" />} {translations.createSprint.createSprint}
              </button>
            </form>
          </div>
        </div>
      )}
      <AlertPopup message={error} onClose={() => setError("")} autoCloseMs={5000} />
    </>
  );
}
