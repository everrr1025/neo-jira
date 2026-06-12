import { Prisma } from "@prisma/client";

const ISSUE_VIEW_VALUES = ["all", "backlog", "overdue", "dueSoon", "assignedToMe", "watching"] as const;
type IssueView = (typeof ISSUE_VIEW_VALUES)[number];

type CustomFieldFilterSource = "issue" | "plan";

type CustomFieldFilterDefinition = {
  id: string;
  type: string;
  source: CustomFieldFilterSource;
};

type ParseIssueSearchParamsOptions = {
  lockedPlanId?: string | null;
  currentUserId?: string | null;
  doneStatusKeys?: string[];
  issueFieldDefinitions?: CustomFieldFilterDefinition[];
  planFieldDefinitions?: CustomFieldFilterDefinition[];
};

function isIssueView(value: string): value is IssueView {
  return ISSUE_VIEW_VALUES.includes(value as IssueView);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isDateFieldValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function fieldValueWhere(fieldType: string, op: string, value: string) {
  if (op === "EMPTY") {
    return {
      valueBoolean: null,
      valueNumber: null,
      valueText: null,
      valueOption: null,
    };
  }

  if (op === "NOT_EMPTY") {
    return {
      OR: [
        { valueBoolean: { not: null } },
        { valueNumber: { not: null } },
        { valueText: { not: null } },
        { valueOption: { not: null } },
      ],
    };
  }

  if (fieldType === "BOOLEAN") {
    if (value !== "true" && value !== "false") return null;
    return { valueBoolean: value === "true" };
  }

  if (fieldType === "NUMBER") {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return null;
    if (op === "GT") return { valueNumber: { gt: numberValue } };
    if (op === "GTE") return { valueNumber: { gte: numberValue } };
    if (op === "LT") return { valueNumber: { lt: numberValue } };
    if (op === "LTE") return { valueNumber: { lte: numberValue } };
    return { valueNumber: numberValue };
  }

  if (fieldType === "SELECT") {
    if (!value) return null;
    if (op === "NEQ") return { valueOption: { not: value } };
    return { valueOption: value };
  }

  if (fieldType === "DATE") {
    if (!isDateFieldValue(value)) return null;
    if (op === "GTE") return { valueText: { gte: value } };
    if (op === "LTE") return { valueText: { lte: value } };
    return { valueText: value };
  }

  if (!value) return null;
  if (op === "NEQ") return { valueText: { not: value } };
  return { valueText: { contains: value } };
}

function buildCustomFieldFilters(
  searchParams: Record<string, string | string[] | undefined>,
  definitions: CustomFieldFilterDefinition[] = []
) {
  const filters: Prisma.IssueWhereInput[] = [];

  for (const definition of definitions) {
    const prefix = definition.source === "plan" ? "planField" : "issueField";
    const value = searchParams[`${prefix}_${definition.id}`];
    const op = searchParams[`${prefix}_${definition.id}_op`];
    const stringValue = Array.isArray(value) ? value[0] : value;
    const stringOp = Array.isArray(op) ? op[0] : op;

    if (!stringOp || (!stringValue && stringOp !== "EMPTY" && stringOp !== "NOT_EMPTY")) continue;

    const valueWhere = fieldValueWhere(definition.type, stringOp, stringValue || "");
    if (!valueWhere) continue;

    const relationKey = definition.source === "plan" ? "planFieldValues" : "issueFieldValues";

    if (stringOp === "EMPTY") {
      filters.push({
        OR: [
          {
            [relationKey]: {
              none: {
                fieldDefinitionId: definition.id,
              },
            },
          },
          {
            [relationKey]: {
              some: {
                fieldDefinitionId: definition.id,
                ...valueWhere,
              },
            },
          },
        ],
      } as Prisma.IssueWhereInput);
      continue;
    }

    if (definition.source === "plan") {
      filters.push({
        planFieldValues: {
          some: {
            fieldDefinitionId: definition.id,
            ...valueWhere,
          },
        },
      });
    } else {
      filters.push({
        issueFieldValues: {
          some: {
            fieldDefinitionId: definition.id,
            ...valueWhere,
          },
        },
      });
    }
  }

  return filters;
}

export async function parseIssueSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  projectId: string,
  options: ParseIssueSearchParamsOptions | string | null = {}
) {
  const normalizedOptions: ParseIssueSearchParamsOptions =
    typeof options === "string" ? { lockedPlanId: options } : options || {};
  const {
    lockedPlanId,
    currentUserId,
    doneStatusKeys = ["DONE"],
    issueFieldDefinitions = [],
    planFieldDefinitions = [],
  } = normalizedOptions;

  const getArray = (val: string | string[] | undefined): string[] => {
    if (!val) return [];
    const strVal = Array.isArray(val) ? val[0] : val;
    return strVal.split(",").filter(Boolean);
  };

  const getString = (val: string | string[] | undefined): string => {
    if (!val) return "";
    return Array.isArray(val) ? val[0] : val;
  };

  const status = getArray(searchParams.status);
  const type = getArray(searchParams.type);
  const priority = getArray(searchParams.priority);
  const sprint = getArray(searchParams.sprint);
  const assignee = getArray(searchParams.assignee);
  const watcher = getArray(searchParams.watcher);
  const plan = lockedPlanId ? [lockedPlanId] : getArray(searchParams.plan);
  const search = getString(searchParams.search);
  const dueFilter = getString(searchParams.dueFilter); // ALL, EQ, GTE, LTE
  const dueDate = getString(searchParams.dueDate);
  const duePreset = getString(searchParams.duePreset);
  const rawView = getString(searchParams.view);
  const view = isIssueView(rawView) ? rawView : "all";

  const andFilters: Prisma.IssueWhereInput[] = [];

  if (status.length > 0) andFilters.push({ status: { in: status } });
  if (type.length > 0) andFilters.push({ type: { in: type } });
  if (priority.length > 0) andFilters.push({ priority: { in: priority } });
  
  if (sprint.length > 0 && view !== "backlog") {
    if (sprint.includes("__BACKLOG__") && sprint.length === 1) {
      andFilters.push({ iterationId: null });
    } else if (sprint.includes("__BACKLOG__")) {
      andFilters.push({ OR: [
        { iterationId: { in: sprint.filter((s) => s !== "__BACKLOG__") } },
        { iterationId: null },
      ] });
    } else {
      andFilters.push({ iterationId: { in: sprint } });
    }
  }

  if (plan.length > 0) {
    if (plan.includes("__NO_PLAN__") && plan.length === 1) {
      andFilters.push({ planId: null });
    } else if (plan.includes("__NO_PLAN__")) {
      andFilters.push({ OR: [
        { planId: { in: plan.filter((p) => p !== "__NO_PLAN__") } },
        { planId: null },
      ] });
    } else {
      andFilters.push({ planId: { in: plan } });
    }
  }

  if (assignee.length > 0 && view !== "assignedToMe") {
    const filters: Prisma.IssueWhereInput[] = [];
    const validAssignees = assignee.filter((a) => a !== "ME" && a !== "UNASSIGNED");
    if (validAssignees.length > 0) {
      filters.push({ assigneeId: { in: validAssignees } });
    }
    if (assignee.includes("ME") && currentUserId) {
      filters.push({ assigneeId: currentUserId });
    }
    if (assignee.includes("UNASSIGNED")) {
      filters.push({ assigneeId: null });
    }
    
    if (filters.length > 0) {
      andFilters.push({ OR: filters });
    }
  }

  if (watcher.length > 0 && currentUserId && watcher.includes("ME") && view !== "watching") {
    andFilters.push({ watchers: { some: { id: currentUserId } } });
  }

  if (search) {
    andFilters.push({
      OR: [
        { title: { contains: search } }, // Case-insensitive in supported DBs
        { key: { contains: search } }
      ]
    });
  }

  if (dueFilter && dueFilter !== "ALL" && dueDate && view !== "overdue" && view !== "dueSoon") {
    const date = new Date(dueDate);
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    if (dueFilter === "EQ") {
      andFilters.push({ dueDate: { gte: date, lt: nextDay } });
    } else if (dueFilter === "GTE") {
      andFilters.push({ dueDate: { gte: date } });
    } else if (dueFilter === "LTE") {
      andFilters.push({ dueDate: { lt: nextDay } });
    }
  } else if (duePreset === "NEXT_3_DAYS" && view !== "overdue" && view !== "dueSoon") {
    const today = startOfToday();
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(threeDaysLater.getDate() + 4); // < 4 days later is <= 3 days later
    andFilters.push({ dueDate: { gte: today, lt: threeDaysLater } });
  }

  const today = startOfToday();
  const dueSoonEnd = new Date(today);
  dueSoonEnd.setDate(dueSoonEnd.getDate() + 4);
  const incompleteFilter: Prisma.IssueWhereInput = { NOT: { status: { in: doneStatusKeys } } };

  if (view === "backlog") {
    andFilters.push({ iterationId: null });
  } else if (view === "overdue") {
    andFilters.push({ dueDate: { not: null, lt: today } }, incompleteFilter);
  } else if (view === "dueSoon") {
    andFilters.push({ dueDate: { not: null, gte: today, lt: dueSoonEnd } }, incompleteFilter);
  } else if (view === "assignedToMe" && currentUserId) {
    andFilters.push({ assigneeId: currentUserId });
  } else if (view === "watching" && currentUserId) {
    andFilters.push({ watchers: { some: { id: currentUserId } } });
  }

  andFilters.push(...buildCustomFieldFilters(searchParams, issueFieldDefinitions));
  if (lockedPlanId) {
    andFilters.push(...buildCustomFieldFilters(searchParams, planFieldDefinitions));
  }

  const where: Prisma.IssueWhereInput = {
    projectId,
    ...(andFilters.length > 0 ? { AND: andFilters } : {}),
  };

  const page = parseInt(getString(searchParams.page) || "1", 10) || 1;
  const pageSize = parseInt(getString(searchParams.pageSize) || "10", 10) || 10;
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const sortBy = getString(searchParams.sortBy) || "createdAt";
  const sortDirection = getString(searchParams.sortDirection) === "asc" ? "asc" : "desc";

  // Handle custom sort mappings
  const orderBy: Prisma.IssueOrderByWithRelationInput = {};
  if (sortBy === "sprint") orderBy.iterationId = sortDirection;
  else if (sortBy === "plan") orderBy.planId = sortDirection;
  else if (sortBy === "assignee") orderBy.assigneeId = sortDirection;
  else if (sortBy === "type") orderBy.type = sortDirection;
  else if (sortBy === "priority") orderBy.priority = sortDirection;
  else if (sortBy === "status") orderBy.status = sortDirection; // Note: this is alphabetical, not workflow order
  else if (sortBy === "dueDate") orderBy.dueDate = { sort: sortDirection, nulls: "last" };
  else if (sortBy === "key") orderBy.key = sortDirection;
  else if (sortBy === "title") orderBy.title = sortDirection;
  else orderBy.createdAt = sortDirection;

  return { where, skip, take, orderBy, page, pageSize };
}
