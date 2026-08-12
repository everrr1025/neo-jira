"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Info, Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  addBacklogIssuesToSprint,
  addUnplannedIssuesToPlan,
  searchBacklogIssuesForSprint,
  searchUnplannedIssuesForPlan,
} from "@/app/actions/issues";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getIssueTypeLabel,
  getPriorityLabel,
  getTranslations,
  Locale,
} from "@/lib/i18n";
import AlertPopup from "./AlertPopup";
import {
  getWorkflowStatusBadgeClass,
  getWorkflowStatusName,
  isDoneWorkflowStatus,
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

export type AddExistingIssuesButtonProps = {
  target: { type: "iteration" | "plan"; id: string; name: string };
  issues: BacklogIssueOption[];
  initialHasMore: boolean;
  locale: Locale;
  workflowStatuses: WorkflowStatusRecord[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
};

export default function AddExistingIssuesButton({
  target,
  issues,
  initialHasMore,
  locale,
  workflowStatuses,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: AddExistingIssuesButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [visibleIssues, setVisibleIssues] = useState(issues);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const requestIdRef = useRef(0);
  const skipNextSearchRef = useRef(false);
  const router = useRouter();
  const translations = getTranslations(locale);
  const text = translations.addExistingIssues;
  const isPlanTarget = target.type === "plan";
  const targetText = isPlanTarget
    ? {
        scopeDescription:
          locale === "zh"
            ? "仅显示当前项目中尚未加入任何计划的问题。"
            : "Only issues in the current project that are not in a plan are shown.",
        empty:
          locale === "zh" ? "当前项目中没有可添加到计划的问题。" : "There are no issues available to add to this plan.",
        all: locale === "zh" ? "全部状态" : "All statuses",
        submit: locale === "zh" ? "添加到计划" : "Add to plan",
      }
    : {
        scopeDescription: text.scopeDescription,
        empty: text.empty,
        all: text.allUnfinished,
        submit: text.addToSprint,
      };
  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = (open: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(open);
    onOpenChange?.(open);
  };

  const statusFilters = useMemo(
    () => [
      "ALL",
      ...sortWorkflowStatuses(workflowStatuses)
        .filter((status) => isPlanTarget || !isDoneWorkflowStatus(status.key, workflowStatuses))
        .map((status) => status.key),
    ],
    [isPlanTarget, workflowStatuses]
  );
  const emptyMessage =
    statusFilter === "ALL"
      ? targetText.empty
      : text.emptyForStatus.replace(
          "{status}",
          getWorkflowStatusName(statusFilter, workflowStatuses, locale)
        );
  const loadIssues = async (reset: boolean) => {
    const requestId = ++requestIdRef.current;
    setIsLoadingIssues(true);
    setErrorMessage("");

    const searchOptions = {
      query: search,
      status: statusFilter,
      offset: reset ? 0 : visibleIssues.length,
    };
    const result = isPlanTarget
      ? await searchUnplannedIssuesForPlan(target.id, searchOptions)
      : await searchBacklogIssuesForSprint(target.id, searchOptions);

    if (requestId !== requestIdRef.current) return;
    setIsLoadingIssues(false);

    if (!result.success) {
      setErrorMessage(`${text.failed}: ${result.error}`);
      return;
    }

    setVisibleIssues((current) => {
      if (reset) return result.issues;
      const existingIds = new Set(current.map((issue) => issue.id));
      return [...current, ...result.issues.filter((issue) => !existingIds.has(issue.id))];
    });
    setHasMore(result.hasMore);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    requestIdRef.current += 1;
    const timer = window.setTimeout(() => {
      void loadIssues(true);
    }, 300);
    return () => window.clearTimeout(timer);
    // loadIssues intentionally uses the latest search criteria after the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, search, statusFilter]);

  const openModal = () => {
    setSearch("");
    setStatusFilter("ALL");
    setVisibleIssues(issues);
    setHasMore(initialHasMore);
    setSelectedIds([]);
    setErrorMessage("");
    skipNextSearchRef.current = true;
    setIsOpen(true);
  };

  const closeModal = () => {
    if (isPending) return;
    requestIdRef.current += 1;
    setIsLoadingIssues(false);
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
      const result = isPlanTarget
        ? await addUnplannedIssuesToPlan(target.id, selectedIds)
        : await addBacklogIssuesToSprint(target.id, selectedIds);
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
      {showTrigger ? (
        <Button
          type="button"
          variant="outline"
          onClick={openModal}
        >
          {text.button}
        </Button>
      ) : null}

      <Dialog open={isOpen} onOpenChange={(open) => (!open ? closeModal() : setIsOpen(true))}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[min(44rem,88vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[57.6rem]"
        >
          <DialogHeader className="border-b px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{text.modalTitle} {target.name}</span>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={targetText.scopeDescription}
                        >
                          <Info className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={6} className="max-w-xs">
                        {targetText.scopeDescription}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </DialogTitle>
              </div>
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

          <div className="flex flex-col gap-3 border-b px-6 py-3 md:flex-row md:items-center">
            <div className="relative shrink-0 md:w-80">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={text.searchPlaceholder}
                className="pl-9"
              />
              {isLoadingIssues ? (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : null}
            </div>

            <div className="flex min-w-0 flex-nowrap gap-2 overflow-x-auto pb-1 md:pb-0">
              {statusFilters.map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={statusFilter === status ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className="h-8"
                >
                  {status === "ALL" ? targetText.all : getWorkflowStatusName(status, workflowStatuses, locale)}
                </Button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {visibleIssues.length > 0 ? (
              <div className="divide-y rounded-md border">
                {visibleIssues.map((issue) => {
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
                {hasMore ? (
                  <div className="flex justify-center p-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void loadIssues(false)}
                      disabled={isLoadingIssues}
                    >
                      {isLoadingIssues ? <Loader2 className="animate-spin" /> : null}
                      {isLoadingIssues ? text.loading : text.loadMore}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : isLoadingIssues ? (
              <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" /> {text.loading}
              </div>
            ) : (
              <div className="flex min-h-[180px] items-center justify-center rounded-md border border-dashed px-4 text-center text-sm font-medium text-muted-foreground">
                {emptyMessage}
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
              <Button type="button" onClick={handleSubmit} disabled={isPending || selectedIds.length === 0}>
                {isPending ? <Loader2 className="animate-spin" /> : null}
                {isPending ? text.adding : targetText.submit}
              </Button>
            </div>
          </DialogFooter>
          <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
        </DialogContent>
      </Dialog>
    </>
  );
}
