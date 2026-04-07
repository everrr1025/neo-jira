"use client";

import { useState, useTransition } from "react";
import { createIssue } from "@/app/actions/issues";
import { Check, ChevronDown, X } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import AlertPopup from "./AlertPopup";
import { getIssueTypeLabel, getPriorityLabel, getTranslations, Locale } from "@/lib/i18n";

type CreateIssueModalProps = {
  isOpen: boolean;
  onClose: () => void;
  users: CreateIssueUser[];
  iterations: CreateIssueIteration[];
  locale: Locale;
  defaultIterationId?: string;
  defaultDueDate?: string;
};

export type CreateIssueUser = {
  id: string;
  name: string | null;
};

export type CreateIssueIteration = {
  id: string;
  name: string;
  endDate: string | Date;
};

type FormDataState = {
  title: string;
  description: string;
  type: string;
  priority: string;
  iterationId: string;
  assigneeId: string;
  dueDate: string;
};

type DropdownOption = {
  value: string;
  label: string;
};

type DropdownFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
};

function toDateInputValue(dateLike?: string | Date | null) {
  if (!dateLike) return "";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function DropdownField({ id, label, value, onChange, options }: DropdownFieldProps) {
  const selectedOption = options.find((item) => item.value === value);

  const handleSelect = (nextValue: string, target: EventTarget | null) => {
    onChange(nextValue);
    const details = (target as HTMLElement | null)?.closest("details");
    if (details) {
      details.open = false;
    }
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <details className="relative rounded-md border border-slate-200 bg-white">
        <summary
          id={id}
          className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm text-slate-700 [&::-webkit-details-marker]:hidden"
        >
          <span className={selectedOption ? "text-slate-700" : "text-slate-400"}>
            {selectedOption?.label || ""}
          </span>
          <ChevronDown size={14} className="text-slate-500" />
        </summary>
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-44 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          {options.map((option) => (
            <button
              type="button"
              key={option.value || "__empty"}
              onClick={(event) => handleSelect(option.value, event.currentTarget)}
              className={`w-full rounded px-2 py-1.5 text-left text-sm transition-colors flex items-center justify-between ${
                option.value === value ? "bg-white text-blue-700" : "text-slate-700 hover:bg-white"
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

export default function CreateIssueModal({
  isOpen,
  onClose,
  users,
  iterations,
  locale,
  defaultIterationId,
  defaultDueDate,
}: CreateIssueModalProps) {
  const [isPending, startTransition] = useTransition();
  const translations = getTranslations(locale);

  const getInitialFormData = (): FormDataState => {
    const fallbackIteration = iterations.find((item) => item.id === defaultIterationId);
    return {
      title: "",
      description: "",
      type: "TASK",
      priority: "MEDIUM",
      iterationId: fallbackIteration?.id || "",
      assigneeId: "",
      dueDate: defaultDueDate || toDateInputValue(fallbackIteration?.endDate),
    };
  };

  const [formData, setFormData] = useState<FormDataState>(getInitialFormData);
  const [isDueDateManuallyEdited, setIsDueDateManuallyEdited] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const mentionQuery = (() => {
    const match = formData.description.match(/(?:\s|^)@([^\s]*)$/);
    return match ? match[1].toLowerCase() : null;
  })();
  const filteredUsers =
    mentionQuery !== null ? users.filter((user) => user.name?.toLowerCase().includes(mentionQuery)) : [];

  const handleMentionInsert = (name: string) => {
    const desc = formData.description;
    const match = desc.match(/(?:\s|^)@([^\s]*)$/);
    if (match) {
      const index = desc.lastIndexOf(`@${match[1]}`);
      if (index !== -1) {
        const textBefore = desc.substring(0, index);
        const textAfter = desc.substring(index + match[1].length + 1);
        setFormData((prev) => ({ ...prev, description: textBefore + `@${name} ` + textAfter }));
      }
    }
  };

  const handleSprintChange = (iterationId: string) => {
    setFormData((prev) => {
      const selectedIteration = iterations.find((item) => item.id === iterationId);
      const syncedDueDate = selectedIteration ? toDateInputValue(selectedIteration.endDate) : "";
      return {
        ...prev,
        iterationId,
        dueDate: isDueDateManuallyEdited ? prev.dueDate : syncedDueDate,
      };
    });
  };

  if (!isOpen) return null;

  const iterationOptions: DropdownOption[] = [
    { value: "", label: translations.issueList.backlog },
    ...iterations.map((item) => ({ value: item.id, label: item.name })),
  ];
  const assigneeOptions: DropdownOption[] = [
    { value: "", label: translations.issueList.unassigned },
    ...users.map((user) => ({ value: user.id, label: user.name || user.id })),
  ];
  const typeOptions: DropdownOption[] = [
    { value: "TASK", label: getIssueTypeLabel("TASK", locale) },
    { value: "STORY", label: getIssueTypeLabel("STORY", locale) },
    { value: "BUG", label: getIssueTypeLabel("BUG", locale) },
    { value: "EPIC", label: getIssueTypeLabel("EPIC", locale) },
  ];
  const priorityOptions: DropdownOption[] = [
    { value: "LOW", label: getPriorityLabel("LOW", locale) },
    { value: "MEDIUM", label: getPriorityLabel("MEDIUM", locale) },
    { value: "HIGH", label: getPriorityLabel("HIGH", locale) },
    { value: "URGENT", label: getPriorityLabel("URGENT", locale) },
  ];

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
        dueDate: formData.dueDate || null,
      };

      const result = await createIssue(payload);
      if (result.success) {
        setFormData(getInitialFormData());
        setIsDueDateManuallyEdited(false);
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
              <label htmlFor="title" className="text-sm font-medium text-slate-700">
                {translations.createIssue.summary} <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                required
                autoFocus
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
                placeholder={translations.createIssue.summaryPlaceholder}
              />
            </div>

            <div className="flex gap-4">
              <DropdownField
                id="type"
                label={translations.createIssue.issueType}
                value={formData.type}
                onChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
                options={typeOptions}
              />
              <DropdownField
                id="priority"
                label={translations.createIssue.priority}
                value={formData.priority}
                onChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}
                options={priorityOptions}
              />
            </div>

            <div className="flex gap-4">
              <DropdownField
                id="iteration"
                label={translations.createIssue.sprint}
                value={formData.iterationId}
                onChange={handleSprintChange}
                options={iterationOptions}
              />
              <DropdownField
                id="assignee"
                label={translations.createIssue.assignee}
                value={formData.assigneeId}
                onChange={(value) => setFormData((prev) => ({ ...prev, assigneeId: value }))}
                options={assigneeOptions}
              />
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="dueDate" className="text-sm font-medium text-slate-700">
                  {translations.createIssue.dueDate}
                </label>
                <input
                  type="date"
                  id="dueDate"
                  value={formData.dueDate}
                  onChange={(e) => {
                    setIsDueDateManuallyEdited(true);
                    setFormData((prev) => ({ ...prev, dueDate: e.target.value }));
                  }}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 h-64 mb-10 border-b pb-4 relative z-0">
              <label htmlFor="description" className="text-sm font-medium text-slate-700">
                {translations.createIssue.description}
              </label>
              <div className="border border-slate-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-shadow">
                <RichTextEditor
                  value={formData.description}
                  onChange={(value) => setFormData((prev) => ({ ...prev, description: value || "" }))}
                  height={220}
                />
              </div>
              {mentionQuery !== null && filteredUsers.length > 0 && (
                <div className="absolute top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg max-h-40 overflow-y-auto w-full md:w-64 animate-in fade-in zoom-in-95 duration-100 z-[99]">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-100">
                    {translations.createIssue.mentionSomeone}
                  </div>
                  {filteredUsers.map((user) => (
                    <button
                      type="button"
                      key={user.id}
                      onClick={() => handleMentionInsert(user.name || user.id)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                        {user.name?.charAt(0) || "U"}
                      </div>
                      {user.name || user.id}
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
              ) : (
                translations.createIssue.create
              )}
            </button>
          </div>
        </form>
      </div>
      <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
    </div>
  );
}
