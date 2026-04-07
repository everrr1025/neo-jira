"use client";

import { useState, useTransition } from "react";
import { createSprint } from "@/app/actions/sprints";
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { getTranslations, Locale } from "@/lib/i18n";
import AlertPopup from "./AlertPopup";

type ProjectOption = { id: string; name: string; key: string };

type DropdownOption = {
  value: string;
  label: string;
};

type DropdownFieldProps = {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
};

function FloatingDropdownField({ label, value, options, onChange }: DropdownFieldProps) {
  const selectedOption = options.find((item) => item.value === value);

  const handleSelect = (nextValue: string, target: EventTarget | null) => {
    onChange(nextValue);
    const details = (target as HTMLElement | null)?.closest("details");
    if (details) {
      details.open = false;
    }
  };

  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
      <details className="relative rounded-md border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm text-slate-700 [&::-webkit-details-marker]:hidden">
          <span>{selectedOption?.label || ""}</span>
          <ChevronDown size={14} className="text-slate-500" />
        </summary>
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-44 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={(event) => handleSelect(option.value, event.currentTarget)}
              className={`w-full rounded px-2 py-1.5 text-left text-sm transition-colors flex items-center justify-between ${
                option.value === value ? "bg-slate-100 text-blue-700" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={14} className="text-blue-600" />}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

function getDefaultEndDate(startDate: string) {
  if (!startDate) return "";
  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 13);
  return date.toISOString().slice(0, 10);
}

export function CreateSprintButton({ projects, locale }: { projects: ProjectOption[]; locale: Locale }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [isEndDateManuallyEdited, setIsEndDateManuallyEdited] = useState(false);
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
        setIsEndDateManuallyEdited(false);
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
              <FloatingDropdownField
                label={translations.createSprint.project}
                value={formData.projectId}
                onChange={(projectId) => setFormData((prev) => ({ ...prev, projectId }))}
                options={projects.map((proj) => ({ value: proj.id, label: `${proj.name} (${proj.key})` }))}
              />

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
                    onChange={(e) => {
                      const startDate = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        startDate,
                        endDate: isEndDateManuallyEdited ? prev.endDate : getDefaultEndDate(startDate),
                      }));
                    }}
                    className="w-full border-slate-200 border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{translations.createSprint.endDate}</label>
                  <input
                    required
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => {
                      setIsEndDateManuallyEdited(true);
                      setFormData((prev) => ({ ...prev, endDate: e.target.value }));
                    }}
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
