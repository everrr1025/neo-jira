"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { deleteIssue, toggleIssueWatcher, updateIssue } from "@/app/actions/issues";
import { emitIssueActivityUpdated } from "@/lib/issueActivityEvents";
import {
  getIssueTypeLabel,
  getPriorityLabel,
  getTranslations,
  type Locale,
  localeDateMap,
} from "@/lib/i18n";
import {
  buildWorkflowStatusOptions,
  buildWorkflowTransitionMap,
  type WorkflowStatusRecord,
  type WorkflowTransitionRecord,
} from "@/lib/workflows";
import ActivityLogSection from "./ActivityLogSection";
import AlertPopup from "./AlertPopup";
import AttachmentUpload from "./AttachmentUpload";
import CommentSection from "./CommentSection";
import { DropdownField } from "./DropdownField";
import RichTextEditor, { type RichTextEditorHandle } from "./RichTextEditor";

type IssueUser = {
  id: string;
  name: string | null;
  email?: string | null;
  avatar?: string | null;
  role?: string | null;
};

type IssueIteration = {
  id: string;
  name: string;
};

type IssuePlan = {
  id: string;
  name: string;
};

type IssueRecord = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  status: string;
  type: string;
  priority: string;
  assigneeId: string | null;
  planId: string | null;
  iterationId: string | null;
  dueDate: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  reporter: {
    id?: string;
    name: string | null;
    email?: string | null;
    avatar?: string | null;
  } | null;
  watchers: IssueUser[];
};

type IssueWorkflowStatus = WorkflowStatusRecord;
type IssueWorkflowTransition = WorkflowTransitionRecord;

export default function IssueDetailClient({
  initialIssue,
  users,
  plans = [],
  iterations = [],
  workflowStatuses,
  workflowTransitions,
  currentUserId,
  locale,
  canDeleteIssue,
}: {
  initialIssue: IssueRecord;
  users: IssueUser[];
  plans?: IssuePlan[];
  iterations?: IssueIteration[];
  workflowStatuses: IssueWorkflowStatus[];
  workflowTransitions: IssueWorkflowTransition[];
  currentUserId: string;
  locale: Locale;
  canDeleteIssue: boolean;
}) {
  const router = useRouter();
  const [issue, setIssue] = useState(initialIssue);
  const [watchers, setWatchers] = useState(initialIssue.watchers);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(initialIssue.title);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [draftDescription, setDraftDescription] = useState(initialIssue.description || "");
  const descriptionEditorRef = useRef<RichTextEditorHandle>(null);
  const translations = getTranslations(locale);

  const isWatching = useMemo(
    () => watchers.some((watcher) => watcher.id === currentUserId),
    [currentUserId, watchers]
  );

  const statusOptions = useMemo(() => {
    const transitionMap = buildWorkflowTransitionMap(workflowTransitions, workflowStatuses);
    const allowedTargets = transitionMap.get(issue.status);
    const visibleStatuses = workflowStatuses.filter(
      (status) => status.key === issue.status || allowedTargets?.has(status.key)
    );
    return buildWorkflowStatusOptions(visibleStatuses.length > 0 ? visibleStatuses : workflowStatuses, locale);
  }, [issue.status, locale, workflowStatuses, workflowTransitions]);

  const handleAutoSave = <K extends keyof IssueRecord>(field: K, value: IssueRecord[K]) => {
    setIssue((prev) => ({ ...prev, [field]: value }));
    startTransition(async () => {
      const result = await updateIssue(issue.id, { [field]: value });
      if (result.success) {
        emitIssueActivityUpdated(issue.id);
      } else {
        setAlertMessage(translations.issueDetail.failedToSave);
      }
    });
  };

  const normalizeTitle = (value: string) => value.replace(/\s*\n+\s*/g, " ").trim();

  const handleStartEditingTitle = () => {
    setDraftTitle(issue.title);
    setIsEditingTitle(true);
  };

  const handleCancelEditingTitle = () => {
    setDraftTitle(issue.title);
    setIsEditingTitle(false);
  };

  const handleSaveTitle = () => {
    const nextTitle = normalizeTitle(draftTitle);

    if (!nextTitle) {
      handleCancelEditingTitle();
      return;
    }

    if (nextTitle === issue.title) {
      setIsEditingTitle(false);
      return;
    }

    const previousTitle = issue.title;
    setIssue((prev) => ({ ...prev, title: nextTitle }));
    setDraftTitle(nextTitle);
    setIsEditingTitle(false);

    startTransition(async () => {
      const result = await updateIssue(issue.id, { title: nextTitle });
      if (result.success) {
        emitIssueActivityUpdated(issue.id);
      } else {
        setIssue((prev) => ({ ...prev, title: previousTitle }));
        setDraftTitle(previousTitle);
        setAlertMessage(translations.issueDetail.failedToSave);
      }
    });
  };

  const handleToggleWatcher = () => {
    startTransition(async () => {
      const result = await toggleIssueWatcher(issue.id);
      if (result.success) {
        setWatchers(result.watchers || []);
      } else {
        setAlertMessage(result.error || translations.issueDetail.failedToSave);
      }
    });
  };

  const handleDelete = async () => {
    if (!canDeleteIssue || isDeleting) return;

    const confirmed = window.confirm(translations.issueDetail.deleteIssueConfirm);
    if (!confirmed) return;

    setAlertMessage("");
    setIsDeleting(true);
    try {
      const result = await deleteIssue(issue.id);
      if (!result.success) {
        setAlertMessage(result.error || translations.issueDetail.deleteIssue);
        setIsDeleting(false);
        return;
      }

      router.replace("/issues");
      router.refresh();
      setIsDeleting(false);
    } catch (error) {
      console.error(error);
      setAlertMessage(translations.issueDetail.deleteIssue);
      setIsDeleting(false);
    }
  };

  const handleStartEditingDescription = () => {
    setDraftDescription(issue.description || "");
    setIsEditingDescription(true);
  };

  const handleCancelEditingDescription = async () => {
    await descriptionEditorRef.current?.discardPendingUploads();
    setDraftDescription(issue.description || "");
    setIsEditingDescription(false);
  };

  const handleSaveDescription = () => {
    startTransition(async () => {
      const result = await updateIssue(issue.id, { description: draftDescription });
      if (result.success) {
        descriptionEditorRef.current?.commitPendingUploads();
        setIssue((prev) => ({ ...prev, description: draftDescription }));
        setIsEditingDescription(false);
        emitIssueActivityUpdated(issue.id);
      } else {
        setAlertMessage(translations.issueDetail.failedToSave);
      }
    });
  };

  return (
    <div className="flex flex-col gap-8 rounded-xl border bg-white p-6 shadow-sm md:p-8 lg:flex-row">
      <div className="flex-1 space-y-6">
        <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            {isEditingTitle ? (
              <textarea
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    handleCancelEditingTitle();
                  }

                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSaveTitle();
                  }
                }}
                autoFocus
                rows={2}
                className="-ml-2 block w-full min-w-0 resize-none rounded-md border-2 border-blue-500 bg-white px-2 py-1 text-2xl font-bold leading-snug text-slate-900 outline-none transition-all"
                placeholder={translations.issueDetail.issueSummaryPlaceholder}
              />
            ) : (
              <div
                className="group relative -ml-2 block w-full min-w-0"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleStartEditingTitle}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleStartEditingTitle();
                    }
                  }}
                  className="block w-full min-w-0 cursor-text rounded-md border-2 border-transparent px-2 py-1 text-left text-2xl font-bold leading-snug text-slate-900 outline-none transition-all hover:border-slate-200 focus:border-blue-500 focus:bg-white"
                >
                  <span
                    className="block w-full max-w-full overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere]"
                    style={{
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                    }}
                  >
                    {issue.title || translations.issueDetail.issueSummaryPlaceholder}
                  </span>
                </div>

                <div className="pointer-events-none absolute left-2 top-full z-20 mt-2 hidden max-w-md rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-sm font-medium leading-6 text-slate-700 shadow-xl backdrop-blur-sm group-hover:block group-focus-within:block">
                  <div className="max-h-40 overflow-auto break-words [overflow-wrap:anywhere]">{issue.title}</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleToggleWatcher}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                isWatching
                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              title={isWatching ? translations.issueDetail.unwatch : translations.issueDetail.watch}
            >
              {isWatching ? <EyeOff size={16} /> : <Eye size={16} />}
              {isWatching ? translations.issueDetail.watching : translations.issueDetail.watch}
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {watchers.length}
              </span>
            </button>

            {canDeleteIssue && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                title={translations.issueDetail.deleteIssue}
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">{translations.issueDetail.description}</h3>
            {!isEditingDescription ? (
              <button
                onClick={handleStartEditingDescription}
                className="flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-800"
                title={translations.issueDetail.edit}
              >
                {translations.issueDetail.edit}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveDescription}
                  className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  {isPending && <Loader2 size={12} className="animate-spin" />}
                  {translations.issueDetail.save}
                </button>
                <button
                  onClick={() => void handleCancelEditingDescription()}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  {translations.issueDetail.cancel}
                </button>
              </div>
            )}
          </div>
          <div className={isEditingDescription ? "" : "min-h-[200px] rounded-lg border bg-white p-3"}>
            {isEditingDescription ? (
              <RichTextEditor
                ref={descriptionEditorRef}
                value={draftDescription}
                onChange={(value) => setDraftDescription(value || "")}
                height={150}
                mentionUsers={users}
                mentionLabel={translations.issueDetail.mentionSomeone}
                currentUserId={currentUserId}
              />
            ) : (
              <RichTextEditor
                value={issue.description || ""}
                onChange={() => {}}
                height={150}
                mentionUsers={users}
                mentionLabel={translations.issueDetail.mentionSomeone}
                currentUserId={currentUserId}
                readOnly
              />
            )}
          </div>
        </div>

        <AlertPopup message={alertMessage} onClose={() => setAlertMessage("")} autoCloseMs={5000} />

        <AttachmentUpload issueId={issue.id} locale={locale} />
        <CommentSection issueId={issue.id} currentUserId={currentUserId} users={users} locale={locale} />
        <ActivityLogSection issueId={issue.id} users={users} plans={plans} iterations={iterations} locale={locale} />
      </div>

      <div className="flex w-full shrink-0 flex-col gap-6 lg:w-56 xl:w-52">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-100 bg-slate-50 p-5">
          <div className="flex items-center gap-2 border-b pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">
              {translations.issueDetail.properties}
            </h3>
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{issue.key}</span>
          </div>

          <DropdownField
            id="status"
            label={translations.issueDetail.status}
            value={issue.status}
            onChange={(value) => handleAutoSave("status", value)}
            options={statusOptions}
          />

          <DropdownField
            id="plan"
            label={locale === "zh" ? "计划" : "Plan"}
            value={issue.planId || ""}
            onChange={(value) => handleAutoSave("planId", value || null)}
            options={[
              { value: "", label: locale === "zh" ? "未设置计划" : "No plan" },
              ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
            ]}
          />

          <DropdownField
            id="iteration"
            label={translations.issueDetail.sprint}
            value={issue.iterationId || ""}
            onChange={(value) => handleAutoSave("iterationId", value || null)}
            options={[
              { value: "", label: translations.issueList.backlog },
              ...iterations.map((iteration) => ({ value: iteration.id, label: iteration.name })),
            ]}
          />

          <DropdownField
            id="type"
            label={translations.issueDetail.type}
            value={issue.type}
            onChange={(value) => handleAutoSave("type", value)}
            options={[
              { value: "TASK", label: getIssueTypeLabel("TASK", locale) },
              { value: "STORY", label: getIssueTypeLabel("STORY", locale) },
              { value: "BUG", label: getIssueTypeLabel("BUG", locale) },
              { value: "EPIC", label: getIssueTypeLabel("EPIC", locale) },
            ]}
          />

          <DropdownField
            id="priority"
            label={translations.issueDetail.priority}
            value={issue.priority}
            onChange={(value) => handleAutoSave("priority", value)}
            options={[
              { value: "LOW", label: getPriorityLabel("LOW", locale) },
              { value: "MEDIUM", label: getPriorityLabel("MEDIUM", locale) },
              { value: "HIGH", label: getPriorityLabel("HIGH", locale) },
              { value: "URGENT", label: getPriorityLabel("URGENT", locale) },
            ]}
          />

          <DropdownField
            id="assignee"
            label={translations.issueDetail.assignee}
            value={issue.assigneeId || ""}
            onChange={(value) => handleAutoSave("assigneeId", value || null)}
            options={[
              { value: "", label: translations.issueList.unassigned },
              ...users.map((user) => ({ value: user.id, label: user.name || user.id })),
            ]}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">{translations.issueDetail.dueDate}</label>
            <input
              type="date"
              value={issue.dueDate ? new Date(issue.dueDate).toISOString().split("T")[0] : ""}
              onChange={(event) =>
                handleAutoSave("dueDate", event.target.value ? new Date(event.target.value).toISOString() : null)
              }
              className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mt-2 border-t pt-2">
            <label className="text-xs font-semibold text-slate-500">{translations.issueDetail.watchers}</label>
            <div className="mt-2 flex flex-col gap-2">
              {watchers.length > 0 ? (
                watchers.map((watcher) => (
                  <div key={watcher.id} className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                      {watcher.avatar ? (
                        <img src={watcher.avatar} alt={watcher.name || watcher.email || watcher.id} className="h-full w-full object-cover" />
                      ) : (
                        (watcher.name || watcher.email || watcher.id).charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="truncate text-sm font-medium text-slate-700">
                      {watcher.name || watcher.email || watcher.id}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">{translations.issueDetail.noWatchers}</p>
              )}
            </div>
          </div>

          <div className="mt-2 border-t pt-2">
            <label className="text-xs font-semibold text-slate-500">{translations.issueDetail.reporter}</label>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                  {issue.reporter?.avatar ? (
                    <img
                      src={issue.reporter.avatar}
                      alt={issue.reporter.name || issue.reporter.email || issue.reporter.id || translations.issueDetail.unknown}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (issue.reporter?.name || issue.reporter?.email || issue.reporter?.id || translations.issueDetail.unknown)
                      .charAt(0)
                      .toUpperCase()
                  )}
                </div>
                <span className="truncate text-sm font-medium text-slate-700">
                  {issue.reporter?.name || issue.reporter?.email || translations.issueDetail.unknown}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-1 text-xs font-medium text-slate-400">
          {translations.issueDetail.created}: {new Date(issue.createdAt).toLocaleString(localeDateMap[locale])}
          <br />
          {translations.issueDetail.updated}: {new Date(issue.updatedAt).toLocaleString(localeDateMap[locale])}
        </div>
      </div>
    </div>
  );
}
