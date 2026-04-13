"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { addBacklogIssuesToSprint } from "@/app/actions/issues";
import {
  getIssueStatusLabel,
  getIssueTypeLabel,
  getPriorityLabel,
  getTranslations,
  Locale,
} from "@/lib/i18n";
import AlertPopup from "./AlertPopup";
import CreateIssueButton from "./CreateIssueButton";
import { type CreateIssueIteration, type CreateIssueUser } from "./CreateIssueModal";

export type BacklogIssueOption = {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  assignee: { name: string | null } | null;
};

type AddExistingIssuesButtonProps = {
  sprintId: string;
  sprintName: string;
  issues: BacklogIssueOption[];
  locale: Locale;
  users: CreateIssueUser[];
  iterations: CreateIssueIteration[];
  currentUserId?: string;
  defaultDueDate?: string;
};

const STATUS_FILTERS = ["ALL", "TODO", "IN_PROGRESS", "IN_TESTING", "DONE"] as const;
const STATUS_ORDER: Record<string, number> = {
  TODO: 0,
  IN_PROGRESS: 1,
  IN_TESTING: 2,
  DONE: 3,
};

export default function AddExistingIssuesButton({
  sprintId,
  sprintName,
  issues,
  locale,
  users,
  iterations,
  currentUserId,
  defaultDueDate,
}: AddExistingIssuesButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const translations = getTranslations(locale);
  const text = translations.addExistingIssues;

  const sortedIssues = useMemo(
    () =>
      [...issues].sort((a, b) => {
        const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
        if (statusDiff !== 0) return statusDiff;
        return a.key.localeCompare(b.key);
      }),
    [issues]
  );

  const filteredIssues = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return sortedIssues.filter((issue) => {
      if (statusFilter !== "ALL" && issue.status !== statusFilter) return false;
      if (!normalizedSearch) return true;

      return [
        issue.key,
        issue.title,
        issue.assignee?.name || translations.issueList.unassigned,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [search, sortedIssues, statusFilter, translations.issueList.unassigned]);

  const openModal = () => {
    setSearch("");
    setStatusFilter("ALL");
    setSelectedIds([]);
    setErrorMessage("");
    setIsOpen(true);
  };

  const closeModal = () => {
    if (isPending) return;
    setIsOpen(false);
  };

  const toggleIssue = (issueId: string) => {
    setSelectedIds((current) =>
      current.includes(issueId) ? current.filter((id) => id !== issueId) : [...current, issueId]
    );
  };

  const handleSubmit = () => {
    if (selectedIds.length === 0) return;

    setErrorMessage("");
    startTransition(async () => {
      const result = await addBacklogIssuesToSprint(sprintId, selectedIds);
      if (result.success) {
        setSelectedIds([]);
        setIsOpen(false);
        router.refresh();
      } else {
        setErrorMessage(`${text.failed}: ${result.error}`);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        {text.button}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-800">
                {text.modalTitle} {sprintName}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 border-b border-slate-100 px-6 py-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={text.searchPlaceholder}
                  className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition-shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      statusFilter === status
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {status === "ALL" ? text.allUnfinished : getIssueStatusLabel(status, locale)}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {filteredIssues.length > 0 ? (
                <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                  {filteredIssues.map((issue) => {
                    const assigneeName = issue.assignee?.name || translations.issueList.unassigned;
                    const checked = selectedIds.includes(issue.id);

                    return (
                      <label
                        key={issue.id}
                        className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleIssue(issue.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">{issue.key}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                              {getIssueTypeLabel(issue.type, locale)}
                            </span>
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                              {getIssueStatusLabel(issue.status, locale)}
                            </span>
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                              {getPriorityLabel(issue.priority, locale)}
                            </span>
                            <span className="text-xs font-medium text-slate-500">{assigneeName}</span>
                          </div>
                          <p className="mt-1 truncate text-sm font-medium text-slate-800">{issue.title}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[180px] items-center justify-center rounded-md border border-dashed border-slate-200 px-4 text-center text-sm font-medium text-slate-400">
                  {text.empty}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
              <span className="text-sm font-medium text-slate-500">
                {text.selected} {selectedIds.length} {text.selectedSuffix}
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isPending}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  {translations.createIssue.cancel}
                </button>
                <CreateIssueButton
                  users={users}
                  iterations={iterations}
                  locale={locale}
                  currentUserId={currentUserId}
                  defaultIterationId={sprintId}
                  defaultDueDate={defaultDueDate}
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isPending || selectedIds.length === 0}
                  className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending && <Loader2 size={16} className="animate-spin" />}
                  {isPending ? text.adding : text.addToSprint}
                </button>
              </div>
            </div>
          </div>
          <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
        </div>
      )}
    </>
  );
}
