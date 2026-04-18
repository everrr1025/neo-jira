import { getIssueStatusLabel, type Locale } from "@/lib/i18n";

export const WORKFLOW_STATUS_CATEGORIES = ["TODO", "IN_PROGRESS", "DONE"] as const;

export type WorkflowStatusCategory = (typeof WORKFLOW_STATUS_CATEGORIES)[number];

export type WorkflowStatusRecord = {
  id: string;
  key: string;
  name: string;
  category: string;
  position: number;
  isInitial: boolean;
};

export type WorkflowTransitionRecord = {
  fromStatusId: string;
  toStatusId: string;
};

export type WorkflowStatusInput = {
  clientId: string;
  id?: string;
  name: string;
  category: WorkflowStatusCategory;
  position: number;
  isInitial: boolean;
};

export type WorkflowTransitionInput = {
  fromClientId: string;
  toClientId: string;
};

export const DEFAULT_WORKFLOW_TEMPLATE = {
  statuses: [
    { key: "TODO", name: "TODO", category: "TODO" as const, position: 0, isInitial: true },
    { key: "IN_PROGRESS", name: "IN_PROGRESS", category: "IN_PROGRESS" as const, position: 1, isInitial: false },
    { key: "IN_TESTING", name: "IN_TESTING", category: "IN_PROGRESS" as const, position: 2, isInitial: false },
    { key: "DONE", name: "DONE", category: "DONE" as const, position: 3, isInitial: false },
  ],
  transitions: [
    { fromKey: "TODO", toKey: "IN_PROGRESS" },
    { fromKey: "IN_PROGRESS", toKey: "TODO" },
    { fromKey: "IN_PROGRESS", toKey: "IN_TESTING" },
    { fromKey: "IN_PROGRESS", toKey: "DONE" },
    { fromKey: "IN_TESTING", toKey: "IN_PROGRESS" },
    { fromKey: "IN_TESTING", toKey: "DONE" },
    { fromKey: "DONE", toKey: "IN_PROGRESS" },
  ],
} as const;

const LEGACY_STATUS_TO_CATEGORY: Record<string, WorkflowStatusCategory> = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  IN_TESTING: "IN_PROGRESS",
  DONE: "DONE",
};

export function sortWorkflowStatuses<T extends { position: number }>(statuses: T[]) {
  return [...statuses].sort((a, b) => a.position - b.position);
}

export function getWorkflowStatusCategory(statusKey: string, workflowStatuses: WorkflowStatusRecord[] = []) {
  const matchedStatus = workflowStatuses.find((status) => status.key === statusKey);
  const category = matchedStatus?.category || LEGACY_STATUS_TO_CATEGORY[statusKey];
  return WORKFLOW_STATUS_CATEGORIES.includes(category as WorkflowStatusCategory)
    ? (category as WorkflowStatusCategory)
    : "TODO";
}

export function isDoneWorkflowStatus(statusKey: string, workflowStatuses: WorkflowStatusRecord[] = []) {
  return getWorkflowStatusCategory(statusKey, workflowStatuses) === "DONE";
}

export function getInitialWorkflowStatusKey(workflowStatuses: WorkflowStatusRecord[] = []) {
  const sortedStatuses = sortWorkflowStatuses(workflowStatuses);
  return sortedStatuses.find((status) => status.isInitial)?.key || sortedStatuses[0]?.key || "TODO";
}

export function getWorkflowStatusName(
  statusKey: string,
  workflowStatuses: WorkflowStatusRecord[] = [],
  locale: Locale
) {
  const matchedStatus = workflowStatuses.find((status) => status.key === statusKey);
  if (!matchedStatus) {
    return getIssueStatusLabel(statusKey, locale);
  }

  if (!matchedStatus.name || matchedStatus.name === matchedStatus.key) {
    return getIssueStatusLabel(matchedStatus.key, locale);
  }

  return matchedStatus.name;
}

export function getWorkflowCategoryLabel(category: WorkflowStatusCategory, locale: Locale) {
  if (locale === "zh") {
    if (category === "TODO") return "待处理";
    if (category === "IN_PROGRESS") return "进行中";
    return "已完成";
  }

  if (category === "TODO") return "To Do";
  if (category === "IN_PROGRESS") return "In Progress";
  return "Done";
}

export function getWorkflowStatusBadgeClass(
  statusKey: string,
  workflowStatuses: WorkflowStatusRecord[] = []
) {
  const category = getWorkflowStatusCategory(statusKey, workflowStatuses);
  if (category === "DONE") return "bg-emerald-100 text-emerald-700";
  if (category === "IN_PROGRESS") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

export function buildWorkflowTransitionMap(
  workflowTransitions: WorkflowTransitionRecord[] = [],
  workflowStatuses: WorkflowStatusRecord[] = []
) {
  const statusIdToKey = new Map(workflowStatuses.map((status) => [status.id, status.key]));
  const transitionMap = new Map<string, Set<string>>();

  for (const transition of workflowTransitions) {
    const fromKey = statusIdToKey.get(transition.fromStatusId);
    const toKey = statusIdToKey.get(transition.toStatusId);
    if (!fromKey || !toKey) continue;

    if (!transitionMap.has(fromKey)) {
      transitionMap.set(fromKey, new Set());
    }
    transitionMap.get(fromKey)?.add(toKey);
  }

  return transitionMap;
}

export function canTransitionWorkflowStatus({
  currentStatus,
  nextStatus,
  workflowStatuses,
  workflowTransitions,
}: {
  currentStatus: string;
  nextStatus: string;
  workflowStatuses: WorkflowStatusRecord[];
  workflowTransitions: WorkflowTransitionRecord[];
}) {
  if (currentStatus === nextStatus) return true;

  const transitionMap = buildWorkflowTransitionMap(workflowTransitions, workflowStatuses);
  const allowedTargets = transitionMap.get(currentStatus);
  return allowedTargets?.has(nextStatus) ?? false;
}

export function buildWorkflowStatusOptions(
  workflowStatuses: WorkflowStatusRecord[],
  locale: Locale
) {
  return sortWorkflowStatuses(workflowStatuses).map((status) => ({
    value: status.key,
    label: getWorkflowStatusName(status.key, workflowStatuses, locale),
  }));
}

function toWorkflowKeySegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();
}

export function buildUniqueWorkflowStatusKey(name: string, existingKeys: Set<string>) {
  const baseKey = toWorkflowKeySegment(name) || "STATUS";
  if (!existingKeys.has(baseKey)) {
    existingKeys.add(baseKey);
    return baseKey;
  }

  let suffix = 2;
  while (existingKeys.has(`${baseKey}_${suffix}`)) {
    suffix += 1;
  }

  const nextKey = `${baseKey}_${suffix}`;
  existingKeys.add(nextKey);
  return nextKey;
}

export function validateWorkflowDraft(
  statuses: WorkflowStatusInput[],
  transitions: WorkflowTransitionInput[]
) {
  if (statuses.length < 2) {
    throw new Error("Workflow must contain at least two statuses");
  }

  const trimmedNames = statuses.map((status) => status.name.trim());
  if (trimmedNames.some((name) => !name)) {
    throw new Error("Workflow status name is required");
  }

  const initialStatuses = statuses.filter((status) => status.isInitial);
  if (initialStatuses.length !== 1) {
    throw new Error("Workflow must have exactly one initial status");
  }

  if (!statuses.some((status) => status.category === "DONE")) {
    throw new Error("Workflow must include at least one done status");
  }

  const validStatusIds = new Set(statuses.map((status) => status.clientId));
  for (const transition of transitions) {
    if (!validStatusIds.has(transition.fromClientId) || !validStatusIds.has(transition.toClientId)) {
      throw new Error("Workflow transition references an invalid status");
    }
  }
}
