"use client";

import { useState, useTransition, useEffect } from "react";
import { updateSprint } from "@/app/actions/sprints";
import { Loader2, X } from "lucide-react";
import { getTranslations, Locale } from "@/lib/i18n";
import AlertPopup from "./AlertPopup";

type SprintData = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

export function EditSprintModal({
  isOpen,
  onClose,
  sprint,
  locale,
}: {
  isOpen: boolean;
  onClose: () => void;
  sprint: SprintData;
  locale: Locale;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const translations = getTranslations(locale);
  const [formData, setFormData] = useState({
    name: sprint.name,
    startDate: sprint.startDate.slice(0, 10),
    endDate: sprint.endDate.slice(0, 10),
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: sprint.name,
        startDate: sprint.startDate.split("T")[0],
        endDate: sprint.endDate.split("T")[0],
      });
      setError("");
    }
  }, [isOpen, sprint]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await updateSprint(sprint.id, formData);
      if (res.success) {
        onClose();
      } else {
        setError(res.error || translations.createSprint.failedCreateSprint);
      }
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800">{locale === "zh" ? "编辑迭代" : "Edit Sprint"}</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">{translations.createSprint.sprintName}</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
                placeholder={translations.createSprint.sprintNamePlaceholder}
              />
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-slate-700">{translations.createSprint.startDate}</label>
                <input
                  required
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-slate-700">{translations.createSprint.endDate}</label>
                <input
                  required
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 mt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {translations.createIssue.cancel}
              </button>
              <button
                disabled={isPending}
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isPending && <Loader2 size={16} className="animate-spin" />} {locale === "zh" ? "保存" : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
      <AlertPopup message={error} onClose={() => setError("")} autoCloseMs={5000} />
    </>
  );
}
