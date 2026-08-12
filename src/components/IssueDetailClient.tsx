"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { deleteIssue, toggleIssueWatcher, updateIssue, updateIssueFieldValue } from "@/app/actions/issues";
import { emitIssueActivityUpdated } from "@/lib/issueActivityEvents";
import { canNestIssueType, getAllowedChildIssueTypes } from "@/lib/issueHierarchy";
import { resolveIssueReturnTo } from "@/lib/issueNavigation";
import {
  getIssueTypeLabel,
  getPriorityLabel,
  getTranslations,
  type Locale,
} from "@/lib/i18n";
import { formatFullDateTime, formatRelativeTime } from "@/lib/timeFormat";
import { ISSUE_TITLE_MAX_LENGTH } from "@/lib/validation";
import { getProjectPath, parseProjectPath } from "@/lib/projectRoutes";
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
import CreateIssueModal from "./CreateIssueModal";
import IssueRelationRow from "./IssueRelationRow";
import ParentIssuePicker from "./ParentIssuePicker";
import RichTextEditor, { type RichTextEditorHandle } from "./RichTextEditor";
import ShadcnDatePicker from "./ShadcnDatePicker";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { NumberInput } from "./ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";

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
    status: string;
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
  status: string;
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
const emptySelectValue = "__empty__";

type SelectOption = {
  value: string;
  label: string;
};

function PropertySelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <Select value={value || emptySelectValue} onValueChange={(nextValue) => onChange(nextValue === emptySelectValue ? "" : nextValue)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={`${id}-${option.value || emptySelectValue}`} value={option.value || emptySelectValue}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AutoGrowTextarea({
  defaultValue,
  onBlur,
}: {
  defaultValue: string;
  onBlur: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "36px";
    textarea.style.height = `${Math.max(36, textarea.scrollHeight)}px`;
  };

  useEffect(() => {
    resize();
  }, [defaultValue]);

  return (
    <Textarea
      ref={textareaRef}
      defaultValue={defaultValue}
      rows={1}
      onInput={resize}
      onBlur={(event) => onBlur(event.target.value)}
      className="min-h-9 resize-none overflow-hidden"
    />
  );
}

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
  parentIssueOptions?: ParentIssueOption[];
}) {
  const router = useRouter();
  const projectRoute = parseProjectPath(usePathname());
  const searchParams = useSearchParams();
  const returnTo = resolveIssueReturnTo(searchParams.get("returnTo"));
  const [issue, setIssue] = useState(initialIssue);
  const [watchers, setWatchers] = useState(initialIssue.watchers);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(initialIssue.title);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [draftDescription, setDraftDescription] = useState(initialIssue.description || "");
  const [isIssueFieldsExpanded, setIsIssueFieldsExpanded] = useState(true);
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [childModalKey, setChildModalKey] = useState(0);
  const descriptionEditorRef = useRef<RichTextEditorHandle>(null);
  const translations = getTranslations(locale);
  const noPlanLabel = locale === "zh" ? "未设置计划" : "No plan";
  const issueFieldsLabel = locale === "zh" ? "扩展字段" : "Custom fields";
  const noIssueFieldsLabel = locale === "zh" ? "暂无扩展字段" : "No custom fields";
  const searchParentIssuePlaceholder = locale === "zh" ? "搜索 key、标题或类型" : "Search key, title, or type";
  const noParentCandidatesLabel = locale === "zh" ? "没有可关联的父级问题" : "No available parent issues";
  const childIssuesLabel = locale === "zh" ? "子项" : "Child issues";
  const parentItemLabel = locale === "zh" ? "父项" : "Parent item";
  const noParentItemLabel = locale === "zh" ? "暂无父项" : "No parent item";
  const addChildLabel = locale === "zh" ? "新建" : "New";
  const noChildIssuesLabel = locale === "zh" ? "暂无子项" : "No child issues";
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
  const childModalParentLabel = `${issue.key} ${issue.title}`;

  const isWatching = useMemo(
    () => watchers.some((watcher) => watcher.id === currentUserId),
    [currentUserId, watchers]
  );

  useEffect(() => {
    setIssue(initialIssue);
    setWatchers(initialIssue.watchers);
  }, [initialIssue]);

  useEffect(() => {
    if (!isEditingDescription) return;
    window.requestAnimationFrame(() => descriptionEditorRef.current?.focus());
  }, [isEditingDescription]);

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

  const handleTypeChange = (value: string) => {
    const previousType = issue.type;
    const previousParentIssue = issue.parentIssue;
    const previousParentIssueId = issue.parentIssueId;
    const nextPatch = value === "EPIC" ? { type: value, parentIssueId: null } : { type: value };
    setIssue((prev) => ({
      ...prev,
      type: value,
      ...(value === "EPIC" ? { parentIssueId: null, parentIssue: null } : {}),
    }));
    startTransition(async () => {
      const result = await updateIssue(issue.id, nextPatch);
      if (result.success) {
        emitIssueActivityUpdated(issue.id);
        if (value === "EPIC") router.refresh();
      } else {
        setIssue((prev) => ({
          ...prev,
          type: previousType,
          parentIssueId: previousParentIssueId,
          parentIssue: previousParentIssue,
        }));
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

      router.replace(returnTo);
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

  const handleBack = () => {
    if (window.history.length <= 1) {
      router.push(
        projectRoute
          ? getProjectPath(projectRoute.departmentId, projectRoute.projectId, "issues")
          : "/issues",
      );
      return;
    }
    router.back();
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
          status: selectedParentIssue.status,
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
    if (isSavingDescription) return;

    if (draftDescription === (issue.description || "")) {
      setIsEditingDescription(false);
      return;
    }

    setIsSavingDescription(true);
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
      setIsSavingDescription(false);
    });
  };

  return (
    <>
    <Card className="gap-0 overflow-visible border-0 bg-transparent py-0 shadow-sm">
      <CardContent className="flex flex-col gap-8 p-0 lg:flex-row">
      <div className="flex-1 space-y-6">
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleBack}
            className="absolute -left-10 mt-1 shrink-0"
            title={translations.issueDetail.back}
            aria-label={translations.issueDetail.back}
          >
            <ArrowLeft className="size-4" />
          </Button>
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
                className="-ml-2 block w-full min-w-0 resize-none rounded-md border-2 border-blue-500 bg-white px-2 py-1 text-xl font-bold leading-snug text-slate-900 outline-none transition-all"
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
                  className="block w-full min-w-0 cursor-text rounded-md border-2 border-transparent px-2 py-1 text-left text-xl font-bold leading-snug text-slate-900 outline-none transition-all hover:border-slate-200 focus:border-blue-500 focus:bg-white"
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

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              onClick={handleToggleWatcher}
              variant="ghost"
              size="icon-sm"
              className={
                isWatching
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "text-muted-foreground"
              }
              title={isWatching ? translations.issueDetail.unwatch : translations.issueDetail.watch}
            >
              {isWatching ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>

            {canDeleteIssue && (
              <Button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-red-50 hover:text-red-500"
                title={translations.issueDetail.deleteIssue}
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </Button>
            )}
          </div>
        </div>

        <div>
          <div
            role={isEditingDescription ? undefined : "button"}
            tabIndex={isEditingDescription ? undefined : 0}
            onFocus={isEditingDescription ? undefined : handleStartEditingDescription}
            onClick={isEditingDescription ? undefined : handleStartEditingDescription}
            className={
              isEditingDescription
                ? ""
                : "min-h-[200px] rounded-lg border bg-white px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            }
          >
            {isEditingDescription ? (
              <RichTextEditor
                ref={descriptionEditorRef}
                value={draftDescription}
                onChange={(value) => setDraftDescription(value || "")}
                height={150}
                mentionUsers={users}
                mentionLabel={translations.issueDetail.mentionSomeone}
                currentUserId={currentUserId}
                onBlur={handleSaveDescription}
                onEscapeKeyDown={() => void handleCancelEditingDescription()}
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
          <div>
            <ParentIssuePicker
              value={issue.parentIssueId || ""}
              options={parentIssueCandidates}
              locale={locale}
              disabled={issue.type === "EPIC" || isPending}
              disabledLabel={issue.type === "EPIC" ? (locale === "zh" ? "史诗不能关联父级问题" : "Epics cannot have a parent issue") : undefined}
              label={parentItemLabel}
              emptyLabel={noParentItemLabel}
              searchPlaceholder={searchParentIssuePlaceholder}
              noResultsLabel={noParentCandidatesLabel}
              workflowStatuses={workflowStatuses}
              onChange={handleParentIssueChange}
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-foreground">{childIssuesLabel}</h3>
              {canCreateChildIssues ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={openChildModal}
                    variant="link"
                    size="sm"
                    className="px-0"
                  >
                    {addChildLabel}
                  </Button>
                </div>
              ) : null}
            </div>

            {issue.childIssues.length > 0 ? (
              <Card className="gap-0 overflow-hidden py-0">
                <div className="divide-y">
                  {issue.childIssues.map((childIssue) => (
                    <IssueRelationRow
                      key={childIssue.id}
                      issue={childIssue}
                      locale={locale}
                      workflowStatuses={workflowStatuses}
                      className="rounded-none px-4"
                    />
                  ))}
                </div>
              </Card>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/35 px-4 py-6 text-sm text-muted-foreground">
                {noChildIssuesLabel}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-foreground">{issueFieldsLabel}</h3>
            <Button
              type="button"
              onClick={() => setIsIssueFieldsExpanded((current) => !current)}
              variant="outline"
              size="icon-sm"
              aria-label={isIssueFieldsExpanded ? (locale === "zh" ? "收起扩展字段" : "Collapse custom fields") : (locale === "zh" ? "展开扩展字段" : "Expand custom fields")}
              title={isIssueFieldsExpanded ? (locale === "zh" ? "收起扩展字段" : "Collapse custom fields") : (locale === "zh" ? "展开扩展字段" : "Expand custom fields")}
            >
              {isIssueFieldsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
          </div>
          {isIssueFieldsExpanded && issueFieldDefinitions.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/35 px-4 py-6 text-sm text-muted-foreground">
              {noIssueFieldsLabel}
            </div>
          ) : null}
          {isIssueFieldsExpanded && issueFieldDefinitions.length > 0 ? (
            <Card className="gap-0 overflow-hidden py-0">
              <div className="divide-y">
              {issueFieldDefinitions.map((field) => {
                const fieldValue = issue.issueFieldValues?.find((value) => value.fieldDefinitionId === field.id);
                const displayValue = getFieldValueForDisplay(field, fieldValue);
                const isLongText = field.type === "LONG_TEXT";
                const rowClassName = "grid min-h-14 gap-3 px-4 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-center";
                const labelClassName = "text-sm font-medium text-muted-foreground";

                if (field.type === "BOOLEAN") {
                  return (
                    <div key={field.id} className={rowClassName}>
                      <span className={labelClassName}>{field.name}</span>
                      <Checkbox
                        checked={fieldValue?.valueBoolean || false}
                        onCheckedChange={(checked) => handleIssueFieldValueUpdate(field, checked === true)}
                      />
                    </div>
                  );
                }

                if (field.type === "SELECT") {
                  return (
                    <div key={field.id} className={rowClassName}>
                      <span className={labelClassName}>{field.name}</span>
                      <Select
                        value={displayValue || emptySelectValue}
                        onValueChange={(value) => handleIssueFieldValueUpdate(field, value === emptySelectValue ? null : value)}
                      >
                        <SelectTrigger id={`issue-field-${field.id}`} className="w-full">
                          <SelectValue placeholder={locale === "zh" ? "未选择" : "Not set"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={emptySelectValue}>{locale === "zh" ? "未选择" : "Not set"}</SelectItem>
                          {getFieldOptions(field).map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                if (isLongText) {
                  return (
                    <label key={field.id} className={rowClassName}>
                      <span className={labelClassName}>{field.name}</span>
                      <AutoGrowTextarea
                        key={`${field.id}-${displayValue}`}
                        defaultValue={displayValue}
                        onBlur={(value) => handleIssueFieldValueUpdate(field, value)}
                      />
                    </label>
                  );
                }

                if (field.type === "DATE") {
                  return (
                    <div key={field.id} className={`${rowClassName} [&_label]:sr-only`}>
                      <span className={labelClassName}>{field.name}</span>
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
                  <label key={field.id} className={rowClassName}>
                    <span className={labelClassName}>{field.name}</span>
                    {field.type === "NUMBER" ? (
                      <NumberInput
                        key={`${field.id}-${displayValue}`}
                        defaultValue={displayValue}
                        onBlur={(event) => handleIssueFieldValueUpdate(field, event.currentTarget.value)}
                        onStepValueChange={(value) => handleIssueFieldValueUpdate(field, value)}
                      />
                    ) : (
                      <Input
                        key={`${field.id}-${displayValue}`}
                        type="text"
                        defaultValue={displayValue}
                        onBlur={(event) => handleIssueFieldValueUpdate(field, event.target.value)}
                      />
                    )}
                  </label>
                );
              })}
              </div>
            </Card>
          ) : null}
        </div>

        <AlertPopup message={alertMessage} onClose={() => setAlertMessage("")} autoCloseMs={5000} />

        <AttachmentUpload issueId={issue.id} locale={locale} />
        <CommentSection issueId={issue.id} currentUserId={currentUserId} users={users} locale={locale} />
        <ActivityLogSection issueId={issue.id} users={users} plans={plans} iterations={iterations} locale={locale} />
      </div>

      <div className="flex w-full shrink-0 flex-col gap-6 lg:w-56 xl:w-52">
        <Card className="gap-4 py-5">
          <CardContent className="flex flex-col gap-4 px-5">

          <PropertySelect
            id="status"
            label={translations.issueDetail.status}
            value={issue.status}
            onChange={(value) => handleAutoSave("status", value)}
            options={statusOptions}
          />

          {canManagePlans ? (
            <PropertySelect
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
              <label className="text-sm font-medium text-muted-foreground">{locale === "zh" ? "计划" : "Plan"}</label>
              <div
                className="rounded-md border bg-background p-2 text-sm font-medium break-words"
                title={issue.planId ? plans.find((plan) => plan.id === issue.planId)?.name || issue.planId : noPlanLabel}
              >
                {issue.planId ? plans.find((plan) => plan.id === issue.planId)?.name || issue.planId : noPlanLabel}
              </div>
            </div>
          )}

          <PropertySelect
            id="iteration"
            label={translations.issueDetail.sprint}
            value={issue.iterationId || ""}
            onChange={(value) => handleAutoSave("iterationId", value || null)}
            options={[
              { value: "", label: translations.issueList.backlog },
              ...iterations.map((iteration) => ({ value: iteration.id, label: iteration.name })),
            ]}
          />

          <PropertySelect
            id="type"
            label={translations.issueDetail.type}
            value={issue.type}
            onChange={handleTypeChange}
            options={[
              { value: "TASK", label: getIssueTypeLabel("TASK", locale) },
              { value: "STORY", label: getIssueTypeLabel("STORY", locale) },
              { value: "BUG", label: getIssueTypeLabel("BUG", locale) },
              { value: "EPIC", label: getIssueTypeLabel("EPIC", locale) },
            ]}
          />

          <PropertySelect
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

          <PropertySelect
            id="assignee"
            label={translations.issueDetail.assignee}
            value={issue.assigneeId || ""}
            onChange={(value) => handleAutoSave("assigneeId", value || null)}
            options={[
              { value: "", label: translations.issueList.unassigned },
              ...assigneeUsers.map((user) => ({ value: user.id, label: user.name || user.id })),
            ]}
          />

          <ShadcnDatePicker
            id="due-date"
            label={translations.issueDetail.dueDate}
            locale={locale}
            value={issue.dueDate ? new Date(issue.dueDate).toISOString().split("T")[0] : ""}
            onChange={(value) => handleAutoSave("dueDate", value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null)}
            labelClassName="text-sm font-medium text-muted-foreground"
            contentAlign="end"
          />

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
          </CardContent>
        </Card>

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
      </CardContent>
    </Card>
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
        allowedTypes={allowedChildTypes}
      />
    ) : null}
    </>
  );
}
