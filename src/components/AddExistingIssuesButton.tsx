"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { addBacklogIssuesToSprint } from "@/app/actions/issues";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  getIssueTypeLabel,
  getPriorityLabel,
  getTranslations,
  Locale,
} from "@/lib/i18n";
import AlertPopup from "./AlertPopup";
import CreateIssueButton from "./CreateIssueButton";
import { type CreateIssueIteration, type CreateIssuePlan, type CreateIssueUser } from "./CreateIssueModal";
import {
  getWorkflowStatusBadgeClass,
  getWorkflowStatusName,
  sortWorkflowStatuses,
  type WorkflowStatusRecord,
} from "@/lib/workflows";

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
  workflowStatuses: WorkflowStatusRecord[];
  users: CreateIssueUser[];
  plans: CreateIssuePlan[];
  iterations: CreateIssueIteration[];
  currentUserId?: string;
  defaultDueDate?: string;
};

export default function AddExistingIssuesButton({
  sprintId,
  sprintName,
  issues,
  locale,
  workflowStatuses,
  users,
  plans,
  iterations,
  currentUserId,
  defaultDueDate,
}: AddExistingIssuesButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const translations = getTranslations(locale);
  const text = translations.addExistingIssues;

  const statusFilters = useMemo(
    () => ["ALL", ...sortWorkflowStatuses(workflowStatuses).map((status) => status.key)],
    [workflowStatuses]
  );
  const statusOrder = useMemo(
    () =>
      Object.fromEntries(sortWorkflowStatuses(workflowStatuses).map((status, index) => [status.key, index])),
    [workflowStatuses]
  );

  const sortedIssues = useMemo(
    () =>
      [...issues].sort((a, b) => {
        const statusDiff = ((statusOrder[a.status] as number | undefined) ?? 99) - ((statusOrder[b.status] as number | undefined) ?? 99);
        if (statusDiff !== 0) return statusDiff;
        return a.key.localeCompare(b.key);
      }),
    [issues, statusOrder]
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
      <Button
        type="button"
        variant="outline"
        onClick={openModal}
      >
        {text.button}
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => (!open ? closeModal() : setIsOpen(true))}>
        <DialogContent showCloseButton={false} className="flex max-h-[88vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>
                {text.modalTitle} {sprintName}
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closeModal}
                disabled={isPending}
                aria-label={translations.createIssue.cancel}
              >
                <X className="size-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 border-b px-6 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={text.searchPlaceholder}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {statusFilters.map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={statusFilter === status ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className="h-8"
                >
                  {status === "ALL" ? text.allUnfinished : getWorkflowStatusName(status, workflowStatuses, locale)}
                </Button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {filteredIssues.length > 0 ? (
              <div className="divide-y rounded-md border">
                {filteredIssues.map((issue) => {
                  const assigneeName = issue.assignee?.name || translations.issueList.unassigned;
                  const checked = selectedIds.includes(issue.id);

                  return (
                    <label
                      key={issue.id}
                      className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleIssue(issue.id)}
                        className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-ring"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">{issue.key}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                            {getIssueTypeLabel(issue.type, locale)}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getWorkflowStatusBadgeClass(issue.status, workflowStatuses)}`}>
                            {getWorkflowStatusName(issue.status, workflowStatuses, locale)}
                          </span>
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            {getPriorityLabel(issue.priority, locale)}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">{assigneeName}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-foreground">{issue.title}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[180px] items-center justify-center rounded-md border border-dashed px-4 text-center text-sm font-medium text-muted-foreground">
                {text.empty}
              </div>
            )}
          </div>

          <DialogFooter className="items-center justify-between border-t bg-muted/35 px-6 py-4 sm:justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {text.selected} {selectedIds.length} {text.selectedSuffix}
              </span>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={closeModal} disabled={isPending}>
                  {translations.createIssue.cancel}
                </Button>
                <CreateIssueButton
                  users={users}
                  plans={plans}
                  iterations={iterations}
                  locale={locale}
                  currentUserId={currentUserId}
                  canManagePlans
                  defaultIterationId={sprintId}
                  defaultDueDate={defaultDueDate}
                />
                <Button type="button" onClick={handleSubmit} disabled={isPending || selectedIds.length === 0}>
                  {isPending ? <Loader2 className="animate-spin" /> : null}
                  {isPending ? text.adding : text.addToSprint}
                </Button>
              </div>
          </DialogFooter>
          <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
        </DialogContent>
      </Dialog>
    </>
  );
}
