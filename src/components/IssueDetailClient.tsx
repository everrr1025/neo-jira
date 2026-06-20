"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bug, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { deleteIssue, toggleIssueWatcher, updateIssue, updateIssueFieldValue } from "@/app/actions/issues";
import { emitIssueActivityUpdated } from "@/lib/issueActivityEvents";
import { canNestIssueType, getAllowedChildIssueTypes } from "@/lib/issueHierarchy";
import {
  getIssueTypeLabel,
  getPriorityLabel,
  getTranslations,
  type Locale,
} from "@/lib/i18n";
import { formatFullDateTime, formatRelativeTime } from "@/lib/timeFormat";
import { ISSUE_TITLE_MAX_LENGTH } from "@/lib/validation";
import {
  buildWorkflowStatusOptions,
  buildWorkflowTransitionMap,
  getWorkflowStatusBadgeClass,
  getWorkflowStatusName,
  isDoneWorkflowStatus,
  type WorkflowStatusRecord,
  type WorkflowTransitionRecord,
} from "@/lib/workflows";
import ActivityLogSection from "./ActivityLogSection";
import AlertPopup from "./AlertPopup";
import AttachmentUpload from "./AttachmentUpload";
import CommentSection from "./CommentSection";
import CreateIssueModal from "./CreateIssueModal";
import { DropdownField } from "./DropdownField";
import LocalizedDateInput from "./LocalizedDateInput";
import ParentIssuePicker from "./ParentIssuePicker";
import RichTextEditor, { type RichTextEditorHandle } from "./RichTextEditor";
import ShadcnDatePicker from "./ShadcnDatePicker";
import { NumberInput } from "./ui/number-input";

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
  endDate: string | Date;
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
  projectId: string;
  parentIssueId: string | null;
  parentIssue: {
    id: string;
    key: string;
    title: string;
    type: string;
  } | null;
  childIssues: ChildIssueRecord[];
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
  issueFieldValues?: IssueFieldValue[];
};

type ChildIssueRecord = {
  id: string;
  key: string;
  title: string;
  type: string;
  status: string;
  dueDate: string | Date | null;
  assignee: {
    name: string | null;
  } | null;
};

type ParentIssueOption = {
  id: string;
  key: string;
  title: string;
  type: string;
  parentIssueId: string | null;
};

type IssueFieldDefinition = {
  id: string;
  projectId: string;
  key: string;
  name: string;
  type: string;
  required: boolean;
  position: number;
  optionsJson: string | null;
};

type IssueFieldValue = {
  id: string;
  fieldDefinitionId: string;
  valueBoolean: boolean | null;
  valueNumber: number | null;
  valueText: string | null;
  valueOption: string | null;
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
  canManagePlans,
  issueFieldDefinitions = [],
  canManageIssueFields,
  parentIssueOptions = [],
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
  canManagePlans: boolean;
  issueFieldDefinitions?: IssueFieldDefinition[];
  canManageIssueFields: boolean;
  parentIssueOptions?: ParentIssueOption[];
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
  const [isIssueFieldsExpanded, setIsIssueFieldsExpanded] = useState(true);
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [childModalKey, setChildModalKey] = useState(0);
  const descriptionEditorRef = useRef<RichTextEditorHandle>(null);
  const translations = getTranslations(locale);
  const noPlanLabel = locale === "zh" ? "未设置计划" : "No plan";
  const issueFieldsLabel = locale === "zh" ? "扩展字段" : "Custom fields";
  const noIssueFieldsLabel = locale === "zh" ? "暂无扩展字段" : "No custom fields";
  const parentIssueLabel = locale === "zh" ? "父级问题" : "Parent issue";
  const searchParentIssuePlaceholder = locale === "zh" ? "搜索 key、标题或类型" : "Search key, title, or type";
  const noParentCandidatesLabel = locale === "zh" ? "没有可关联的父级问题" : "No available parent issues";
  const childIssuesLabel = locale === "zh" ? "子项" : "Child issues";
  const addChildLabel = locale === "zh" ? "新增子项" : "Add child";
  const addBugLabel = locale === "zh" ? "提缺陷" : "Report bug";
  const noChildIssuesLabel = locale === "zh" ? "暂无子项" : "No child issues";
  const childProgressLabel = locale === "zh" ? "完成率" : "Progress";
  const overdueLabel = locale === "zh" ? "逾期" : "Overdue";
  const assigneeUsers = useMemo(() => users.filter((user) => user.role !== "ADMIN"), [users]);
  const allowedChildTypes = getAllowedChildIssueTypes(issue.type);
  const canCreateChildIssues = allowedChildTypes.length > 0;
  const parentIssueOptionById = useMemo(
    () => new Map(parentIssueOptions.map((option) => [option.id, option] as const)),
    [parentIssueOptions]
  );
  const isDescendantIssue = (candidate: ParentIssueOption) => {
    let ancestorId = candidate.parentIssueId;
    const visitedIds = new Set<string>([candidate.id]);

    while (ancestorId) {
      if (ancestorId === issue.id) return true;
      if (visitedIds.has(ancestorId)) return true;
      visitedIds.add(ancestorId);
      ancestorId = parentIssueOptionById.get(ancestorId)?.parentIssueId || null;
    }

    return false;
  };
  const parentIssueCandidates = parentIssueOptions
    .filter((candidate) => candidate.id !== issue.id)
    .filter((candidate) => canNestIssueType(candidate.type, issue.type))
    .filter((candidate) => !isDescendantIssue(candidate));
  const childDoneCount = issue.childIssues.filter((childIssue) => isDoneWorkflowStatus(childIssue.status, workflowStatuses)).length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const overdueChildCount = issue.childIssues.filter((childIssue) => {
    if (!childIssue.dueDate || isDoneWorkflowStatus(childIssue.status, workflowStatuses)) return false;
    return new Date(childIssue.dueDate) < todayStart;
  }).length;
  const childProgress = issue.childIssues.length > 0 ? Math.round((childDoneCount / issue.childIssues.length) * 100) : 0;
  const childModalParentLabel = `${issue.key} ${issue.title}`;
  const defaultChildType = allowedChildTypes.includes("TASK") ? "TASK" : allowedChildTypes[0];

  const isWatching = useMemo(
    () => watchers.some((watcher) => watcher.id === currentUserId),
    [currentUserId, watchers]
  );

  useEffect(() => {
    setIssue(initialIssue);
    setWatchers(initialIssue.watchers);
  }, [initialIssue]);

  const statusOptions = useMemo(() => {
    const transitionMap = buildWorkflowTransitionMap(workflowTransitions, workflowStatuses);
    const allowedTargets = transitionMap.get(issue.status);
    const visibleStatuses = workflowStatuses.filter(
      (status) => status.key === issue.status || allowedTargets?.has(status.key)
    );
    return buildWorkflowStatusOptions(visibleStatuses.length > 0 ? visibleStatuses : workflowStatuses, locale);
  }, [issue.status, locale, workflowStatuses, workflowTransitions]);

  const getFieldOptions = (field: IssueFieldDefinition) => {
    if (!field.optionsJson) return [];

    try {
      const parsed = JSON.parse(field.optionsJson);
      return Array.isArray(parsed) ? parsed.filter((option): option is string => typeof option === "string") : [];
    } catch {
      return [];
    }
  };

  const getFieldValueForDisplay = (field: IssueFieldDefinition, value?: IssueFieldValue) => {
    if (!value) return "";
    if (field.type === "BOOLEAN") return value.valueBoolean ? "true" : "false";
    if (field.type === "NUMBER") {
      return value.valueNumber === null || value.valueNumber === undefined ? "" : String(value.valueNumber);
    }
    if (field.type === "SELECT") return value.valueOption || "";
    return value.valueText || "";
  };

  const handleIssueFieldValueUpdate = (
    field: IssueFieldDefinition,
    value: string | number | boolean | null
  ) => {
    const valueData: IssueFieldValue = {
      id: issue.issueFieldValues?.find((item) => item.fieldDefinitionId === field.id)?.id || `draft-${field.id}`,
      fieldDefinitionId: field.id,
      valueBoolean: field.type === "BOOLEAN" ? Boolean(value) : null,
      valueNumber: field.type === "NUMBER" && value !== "" && value !== null ? Number(value) : null,
      valueText:
        field.type === "TEXT" || field.type === "LONG_TEXT" || field.type === "DATE"
          ? typeof value === "string"
            ? value
            : value === null
              ? null
              : String(value)
          : null,
      valueOption: field.type === "SELECT" ? (typeof value === "string" && value ? value : null) : null,
    };

    const existingValues = issue.issueFieldValues || [];
    const nextValues = existingValues.some((item) => item.fieldDefinitionId === field.id)
      ? existingValues.map((item) => (item.fieldDefinitionId === field.id ? valueData : item))
      : [...existingValues, valueData];
    setIssue((prev) => ({ ...prev, issueFieldValues: nextValues }));

    startTransition(async () => {
      const result = await updateIssueFieldValue({
        issueId: issue.id,
        fieldDefinitionId: field.id,
        value,
      });
      if (!result.success) {
        setAlertMessage(result.error || translations.issueDetail.failedToSave);
      }
    });
  };

  const handleAutoSave = <K extends keyof IssueRecord>(field: K, value: IssueRecord[K]) => {
    const previousValue = issue[field];
    setIssue((prev) => ({ ...prev, [field]: value }));
    startTransition(async () => {
      const result = await updateIssue(issue.id, { [field]: value });
      if (result.success) {
        emitIssueActivityUpdated(issue.id);
      } else {
        setIssue((prev) => ({ ...prev, [field]: previousValue }));
        setAlertMessage(result.error || translations.issueDetail.failedToSave);
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

  const openChildModal = () => {
    setChildModalKey((value) => value + 1);
    setIsChildModalOpen(true);
  };

  const closeChildModal = () => {
    setIsChildModalOpen(false);
    router.refresh();
  };

  const openBugModal = () => {
    setChildModalKey((value) => value + 1);
    setIsBugModalOpen(true);
  };

  const closeBugModal = () => {
    setIsBugModalOpen(false);
    router.refresh();
  };

  const handleParentIssueChange = (parentIssueId: string) => {
    if ((parentIssueId || null) === issue.parentIssueId) return;

    const previousParentIssue = issue.parentIssue;
    const previousParentIssueId = issue.parentIssueId;
    const selectedParentIssue = parentIssueId ? parentIssueOptionById.get(parentIssueId) || null : null;
    const nextParentIssue = selectedParentIssue
      ? {
          id: selectedParentIssue.id,
          key: selectedParentIssue.key,
          title: selectedParentIssue.title,
          type: selectedParentIssue.type,
        }
      : null;

    setIssue((prev) => ({ ...prev, parentIssueId: parentIssueId || null, parentIssue: nextParentIssue }));
    startTransition(async () => {
      const result = await updateIssue(issue.id, { parentIssueId: parentIssueId || null });
      if (result.success) {
        emitIssueActivityUpdated(issue.id);
        router.refresh();
      } else {
        setIssue((prev) => ({
          ...prev,
          parentIssueId: previousParentIssueId,
          parentIssue: previousParentIssue,
        }));
        setAlertMessage(result.error || translations.issueDetail.failedToSave);
      }
    });
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
    <>
    <div className="flex flex-col gap-8 rounded-xl border bg-white p-6 shadow-sm md:p-8 lg:flex-row">
      <div className="flex-1 space-y-6">
        <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            {isEditingTitle ? (
              <textarea
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={handleSaveTitle}
                maxLength={ISSUE_TITLE_MAX_LENGTH}
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
              className={`inline-flex items-center gap-1.5 rounded-md border p-1.5 text-sm font-medium transition-colors ${
                isWatching
                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              title={isWatching ? translations.issueDetail.unwatch : translations.issueDetail.watch}
            >
              {isWatching ? <EyeOff size={16} /> : <Eye size={16} />}
              <span className="text-xs font-semibold">
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
          <div className={isEditingDescription ? "" : "min-h-[200px] rounded-lg bg-slate-50 px-4 py-3"}>
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

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <ParentIssuePicker
              value={issue.parentIssueId || ""}
              options={parentIssueCandidates}
              locale={locale}
              disabled={issue.type === "EPIC" || isPending}
              disabledLabel={issue.type === "EPIC" ? (locale === "zh" ? "史诗不能关联父级问题" : "Epics cannot have a parent issue") : undefined}
              label={parentIssueLabel}
              searchPlaceholder={searchParentIssuePlaceholder}
              noResultsLabel={noParentCandidatesLabel}
              onChange={handleParentIssueChange}
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{childIssuesLabel}</h3>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                  <span>{issue.childIssues.length}</span>
                  <span>{childProgressLabel}: {childProgress}%</span>
                  <span>{childDoneCount}/{issue.childIssues.length}</span>
                  <span>{overdueLabel}: {overdueChildCount}</span>
                </div>
              </div>
              {canCreateChildIssues ? (
                <div className="flex flex-wrap gap-2">
                  {allowedChildTypes.includes("BUG") ? (
                    <button
                      type="button"
                      onClick={openBugModal}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <Bug size={14} />
                      {addBugLabel}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={openChildModal}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                  >
                    <Plus size={14} />
                    {addChildLabel}
                  </button>
                </div>
              ) : null}
            </div>

            {issue.childIssues.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="h-1 bg-slate-100">
                  <div className="h-full bg-emerald-500" style={{ width: `${childProgress}%` }} />
                </div>
                <div className="divide-y divide-slate-100">
                  {issue.childIssues.map((childIssue) => (
                    <Link
                      key={childIssue.id}
                      href={`/issues/${childIssue.id}`}
                      className="grid gap-2 px-4 py-3 transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_120px_120px]"
                    >
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-500">{childIssue.key}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                            {getIssueTypeLabel(childIssue.type, locale)}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getWorkflowStatusBadgeClass(childIssue.status, workflowStatuses)}`}>
                            {getWorkflowStatusName(childIssue.status, workflowStatuses, locale)}
                          </span>
                        </div>
                        <div className="truncate text-sm font-semibold text-slate-800">{childIssue.title}</div>
                      </div>
                      <div className="text-sm font-medium text-slate-600 md:text-right">
                        {childIssue.assignee?.name || translations.issueList.unassigned}
                      </div>
                      <div className="text-sm font-medium text-slate-500 md:text-right">
                        {childIssue.dueDate ? new Date(childIssue.dueDate).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US") : ""}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                {noChildIssuesLabel}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-slate-800">{issueFieldsLabel}</h3>
            <button
              type="button"
              onClick={() => setIsIssueFieldsExpanded((current) => !current)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
              aria-label={isIssueFieldsExpanded ? (locale === "zh" ? "收起扩展字段" : "Collapse custom fields") : (locale === "zh" ? "展开扩展字段" : "Expand custom fields")}
              title={isIssueFieldsExpanded ? (locale === "zh" ? "收起扩展字段" : "Collapse custom fields") : (locale === "zh" ? "展开扩展字段" : "Expand custom fields")}
            >
              {isIssueFieldsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          {isIssueFieldsExpanded && issueFieldDefinitions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              {noIssueFieldsLabel}
            </div>
          ) : null}
          {isIssueFieldsExpanded && issueFieldDefinitions.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              {issueFieldDefinitions.map((field) => {
                const fieldValue = issue.issueFieldValues?.find((value) => value.fieldDefinitionId === field.id);
                const displayValue = getFieldValueForDisplay(field, fieldValue);
                const isLongText = field.type === "LONG_TEXT";
                const fieldSpanClass =
                  field.type === "BOOLEAN" || field.type === "NUMBER"
                    ? "md:col-span-1"
                    : isLongText
                      ? "md:col-span-4"
                      : "md:col-span-2";
                const fieldShellClass = `rounded-lg border border-slate-200 bg-white p-3 ${
                  fieldSpanClass
                }`;

                if (field.type === "BOOLEAN") {
                  return (
                    <label key={field.id} className={`${fieldShellClass} flex items-center gap-2`}>
                      <input
                        type="checkbox"
                        checked={fieldValue?.valueBoolean || false}
                        onChange={(event) => handleIssueFieldValueUpdate(field, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-semibold text-slate-700">{field.name}</span>
                    </label>
                  );
                }

                if (field.type === "SELECT") {
                  return (
                    <div key={field.id} className={`${fieldShellClass} flex flex-col gap-1.5`}>
                      <span className="text-xs font-semibold text-slate-500">{field.name}</span>
                      <DropdownField
                        id={`issue-field-${field.id}`}
                        label={field.name}
                        value={displayValue}
                        onChange={(value) => handleIssueFieldValueUpdate(field, value || null)}
                        hideLabel
                        options={[
                          { value: "", label: locale === "zh" ? "未选择" : "Not set" },
                          ...getFieldOptions(field).map((option) => ({ value: option, label: option })),
                        ]}
                      />
                    </div>
                  );
                }

                if (isLongText) {
                  return (
                    <label key={field.id} className={`${fieldShellClass} flex flex-col gap-1.5`}>
                      <span className="text-xs font-semibold text-slate-500">{field.name}</span>
                      <textarea
                        key={`${field.id}-${displayValue}`}
                        defaultValue={displayValue}
                        rows={3}
                        onBlur={(event) => handleIssueFieldValueUpdate(field, event.target.value)}
                        className="w-full resize-y rounded-md border border-slate-200 bg-white p-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  );
                }

                if (field.type === "DATE") {
                  return (
                    <div key={field.id} className={`${fieldShellClass} flex flex-col gap-1.5 [&_label]:text-xs [&_label]:font-semibold [&_label]:text-slate-500`}>
                      <ShadcnDatePicker
                        id={`issue-field-${field.id}`}
                        label={field.name}
                        locale={locale}
                        value={displayValue}
                        onChange={(value) => handleIssueFieldValueUpdate(field, value || null)}
                      />
                    </div>
                  );
                }

                return (
                  <label key={field.id} className={`${fieldShellClass} flex flex-col gap-1.5`}>
                    <span className="text-xs font-semibold text-slate-500">{field.name}</span>
                    {field.type === "NUMBER" ? (
                      <NumberInput
                        key={`${field.id}-${displayValue}`}
                        defaultValue={displayValue}
                        onBlur={(event) => handleIssueFieldValueUpdate(field, event.currentTarget.value)}
                        onStepValueChange={(value) => handleIssueFieldValueUpdate(field, value)}
                        inputClassName="border-slate-200 bg-white text-sm font-medium text-slate-700 focus-visible:ring-blue-500"
                      />
                    ) : (
                      <input
                        key={`${field.id}-${displayValue}`}
                        type="text"
                        defaultValue={displayValue}
                        onBlur={(event) => handleIssueFieldValueUpdate(field, event.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </label>
                );
              })}
            </div>
          ) : null}
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

          {canManagePlans ? (
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
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">{locale === "zh" ? "计划" : "Plan"}</label>
              <div
                className="rounded-md border border-slate-200 bg-white p-2 text-sm font-medium text-slate-700 break-words"
                title={issue.planId ? plans.find((plan) => plan.id === issue.planId)?.name || issue.planId : noPlanLabel}
              >
                {issue.planId ? plans.find((plan) => plan.id === issue.planId)?.name || issue.planId : noPlanLabel}
              </div>
            </div>
          )}

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
              ...assigneeUsers.map((user) => ({ value: user.id, label: user.name || user.id })),
            ]}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">{translations.issueDetail.dueDate}</label>
            <LocalizedDateInput
              locale={locale}
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
          {translations.issueDetail.created}:{" "}
          <span title={formatFullDateTime(issue.createdAt, locale)}>
            {formatRelativeTime(issue.createdAt, locale)}
          </span>
          <br />
          {translations.issueDetail.updated}:{" "}
          <span title={formatFullDateTime(issue.updatedAt, locale)}>
            {formatRelativeTime(issue.updatedAt, locale)}
          </span>
        </div>
      </div>
    </div>
    {canCreateChildIssues ? (
      <CreateIssueModal
        key={`child-${childModalKey}`}
        isOpen={isChildModalOpen}
        onClose={closeChildModal}
        users={users}
        plans={plans}
        iterations={iterations}
        locale={locale}
        currentUserId={currentUserId}
        canManagePlans={canManagePlans}
        defaultParentIssueId={issue.id}
        parentIssueLabel={childModalParentLabel}
        defaultType={defaultChildType}
        allowedTypes={allowedChildTypes}
      />
    ) : null}
    {allowedChildTypes.includes("BUG") ? (
      <CreateIssueModal
        key={`bug-${childModalKey}`}
        isOpen={isBugModalOpen}
        onClose={closeBugModal}
        users={users}
        plans={plans}
        iterations={iterations}
        locale={locale}
        currentUserId={currentUserId}
        canManagePlans={canManagePlans}
        defaultParentIssueId={issue.id}
        parentIssueLabel={childModalParentLabel}
        defaultType="BUG"
        allowedTypes={["BUG"]}
      />
    ) : null}
    </>
  );
}
