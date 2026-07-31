import { z } from "zod";

import { buildProjectItemsWhere, buildProjectUsersWhere } from "@/lib/activeProjectUtils";
import {
  ISSUE_LIST_PREFERENCE_VERSION,
  SHARED_PREFERENCE_CONTEXT,
  type IssueListInitialPreferences,
  type IssueListPreferenceScope,
  type IssueListLayoutPreference,
  isIssueListFilterKey,
  parseStoredLayout,
} from "@/lib/issueListPreferences";
import prisma from "@/lib/prisma";

const filterPayloadSchema = z.object({ query: z.string().max(12000) });
const csv = (value: string) => value.split(",").filter(Boolean);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMPTY_OPERATORS = ["EMPTY", "NOT_EMPTY"];
const CUSTOM_OPERATORS_BY_TYPE: Record<string, Set<string>> = {
  BOOLEAN: new Set(["EQ", ...EMPTY_OPERATORS]),
  NUMBER: new Set(["EQ", "GT", "GTE", "LT", "LTE", ...EMPTY_OPERATORS]),
  DATE: new Set(["EQ", "GTE", "LTE", ...EMPTY_OPERATORS]),
  SELECT: new Set(["EQ", "NEQ", ...EMPTY_OPERATORS]),
  TEXT: new Set(["CONTAINS", "NEQ", ...EMPTY_OPERATORS]),
  LONG_TEXT: new Set(["CONTAINS", "NEQ", ...EMPTY_OPERATORS]),
};
const STANDARD_COLUMN_IDS = [
  "key",
  "title",
  "parent",
  "children",
  "plan",
  "iteration",
  "status",
  "type",
  "priority",
  "dueDate",
  "assignee",
];

function isValidDateValue(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export async function validateIssueListScope(scope: IssueListPreferenceScope) {
  if (scope.surface === "PLAN") {
    return Boolean(
      await prisma.plan.findFirst({
        where: { id: scope.contextKey, projectId: scope.projectId },
        select: { id: true },
      })
    );
  }
  if (scope.surface === "ITERATION") {
    return Boolean(
      await prisma.iteration.findFirst({
        where: { id: scope.contextKey, projectId: scope.projectId },
        select: { id: true },
      })
    );
  }
  return scope.surface === "ISSUES" && scope.contextKey === SHARED_PREFERENCE_CONTEXT;
}

export async function sanitizeIssueListLayout(
  scope: IssueListPreferenceScope,
  layout: IssueListLayoutPreference
) {
  const [issueFields, planFields] = await Promise.all([
    prisma.issueFieldDefinition.findMany({
      where: { projectId: scope.projectId },
      select: { id: true, type: true },
    }),
    scope.surface === "PLAN"
      ? prisma.planFieldDefinition.findMany({
          where: { planId: scope.contextKey },
          select: { id: true, type: true },
        })
      : Promise.resolve([]),
  ]);
  const allowedStandardColumns = STANDARD_COLUMN_IDS.filter(
    (id) =>
      !(scope.surface === "PLAN" && id === "plan") &&
      !(scope.surface === "ITERATION" && id === "iteration")
  );
  const allowedKeys = new Set([
    ...allowedStandardColumns.map((id) => `column:${id}`),
    ...issueFields.map((field) => `issueField:${field.id}`),
    ...planFields.map((field) => `planField:${field.id}`),
  ]);
  const dateFieldKeys = new Set([
    ...issueFields.filter((field) => field.type === "DATE").map((field) => `issueField:${field.id}`),
    ...planFields.filter((field) => field.type === "DATE").map((field) => `planField:${field.id}`),
  ]);
  const orderedKeys = [...new Set(layout.orderedKeys.filter((key) => allowedKeys.has(key)))];
  const hiddenKeys = [...new Set(layout.hiddenKeys.filter((key) => allowedKeys.has(key)))];
  const widths = Object.fromEntries(
    Object.entries(layout.widths)
      .filter(([key]) => allowedKeys.has(key))
      .map(([key, width]) => [key, Math.min(1200, Math.max(dateFieldKeys.has(key) ? 220 : 80, width))])
  );
  return { orderedKeys, hiddenKeys, widths } satisfies IssueListLayoutPreference;
}

export async function getIssueListInitialPreferences(
  userId: string,
  scope: IssueListPreferenceScope
): Promise<IssueListInitialPreferences> {
  const records = await prisma.issueListPreference.findMany({
    where: {
      userId,
      projectId: scope.projectId,
      surface: scope.surface,
      OR: [
        { kind: "LAYOUT_BASE", contextKey: SHARED_PREFERENCE_CONTEXT },
        { kind: "LAYOUT_CONTEXT", contextKey: scope.contextKey },
      ],
    },
    select: { kind: true, payloadJson: true, schemaVersion: true },
  });

  const base = records.find(
    (record) => record.kind === "LAYOUT_BASE" && record.schemaVersion === ISSUE_LIST_PREFERENCE_VERSION
  );
  const context = records.find(
    (record) => record.kind === "LAYOUT_CONTEXT" && record.schemaVersion === ISSUE_LIST_PREFERENCE_VERSION
  );

  return {
    baseLayout: parseStoredLayout(base?.payloadJson),
    contextLayout: parseStoredLayout(context?.payloadJson),
  };
}

export async function sanitizeIssueListFilterQuery(
  userId: string,
  scope: IssueListPreferenceScope,
  rawQuery: string
) {
  const input = new URLSearchParams(rawQuery);
  const output = new URLSearchParams();
  const [statuses, users, plans, iterations, issueFields, planFields] = await Promise.all([
    prisma.projectWorkflowStatus.findMany({
      where: { projectId: scope.projectId },
      select: { key: true },
    }),
    prisma.user.findMany({
      where: buildProjectUsersWhere(scope.projectId, false),
      select: { id: true },
    }),
    prisma.plan.findMany({
      where: buildProjectItemsWhere(scope.projectId),
      select: { id: true },
    }),
    prisma.iteration.findMany({
      where: buildProjectItemsWhere(scope.projectId),
      select: { id: true },
    }),
    prisma.issueFieldDefinition.findMany({
      where: { projectId: scope.projectId },
      select: { id: true, type: true },
    }),
    scope.surface === "PLAN"
      ? prisma.planFieldDefinition.findMany({
          where: { planId: scope.contextKey },
          select: { id: true, type: true },
        })
      : Promise.resolve([]),
  ]);

  const statusIds = new Set(statuses.map((item) => item.key));
  const userIds = new Set(users.map((item) => item.id));
  const planIds = new Set(plans.map((item) => item.id));
  const iterationIds = new Set(iterations.map((item) => item.id));
  const issueFieldTypes = new Map(issueFields.map((item) => [item.id, item.type]));
  const planFieldTypes = new Map(planFields.map((item) => [item.id, item.type]));
  const keepCsv = (key: string, allowed: Set<string>, extra: string[] = []) => {
    const extraSet = new Set(extra);
    const values = csv(input.get(key) || "").filter((value) => allowed.has(value) || extraSet.has(value));
    if (values.length > 0) output.set(key, values.join(","));
  };

  keepCsv("status", statusIds);
  keepCsv("type", new Set(["TASK", "STORY", "BUG", "EPIC"]));
  keepCsv("priority", new Set(["URGENT", "HIGH", "MEDIUM", "LOW"]));
  if (scope.surface !== "PLAN") keepCsv("plan", planIds, ["__NO_PLAN__"]);
  if (scope.surface !== "ITERATION") keepCsv("sprint", iterationIds, ["__BACKLOG__"]);
  keepCsv("assignee", userIds, ["ME", "UNASSIGNED"]);
  keepCsv("watcher", new Set(["ME"]));

  const view = input.get("view");
  const allowedViews = new Set(["all", "overdue", "dueSoon", "assignedToMe", "watching"]);
  if (scope.surface !== "ITERATION") allowedViews.add("backlog");
  if (view && allowedViews.has(view)) output.set("view", view);

  const dueFilter = input.get("dueFilter");
  const dueDate = input.get("dueDate");
  const duePreset = input.get("duePreset");
  if (dueFilter && new Set(["ALL", "EQ", "GTE", "LTE"]).has(dueFilter)) output.set("dueFilter", dueFilter);
  if (dueDate && isValidDateValue(dueDate)) output.set("dueDate", dueDate);
  if (duePreset && new Set(["NONE", "NEXT_3_DAYS"]).has(duePreset)) output.set("duePreset", duePreset);

  const search = input.get("search")?.trim().slice(0, 200);
  if (search) output.set("search", search);
  const pageSize = input.get("pageSize");
  if (pageSize && ["10", "20", "50"].includes(pageSize)) output.set("pageSize", pageSize);
  const sortBy = input.get("sortBy");
  if (
    sortBy &&
    ["createdAt", "key", "title", "plan", "status", "type", "priority", "dueDate", "sprint", "assignee"].includes(sortBy)
  ) {
    output.set("sortBy", sortBy);
  }
  const sortDirection = input.get("sortDirection");
  if (sortDirection === "asc" || sortDirection === "desc") output.set("sortDirection", sortDirection);

  input.forEach((value, key) => {
    if (!isIssueListFilterKey(key)) return;
    const issueMatch = key.match(/^issueField_([^_]+)(?:_op)?$/);
    const planMatch = key.match(/^planField_([^_]+)(?:_op)?$/);
    const fieldId = issueMatch?.[1] || planMatch?.[1];
    const fieldType = issueMatch
      ? issueFieldTypes.get(fieldId || "")
      : planMatch
        ? planFieldTypes.get(fieldId || "")
        : undefined;
    if (!fieldType) return;
    if (key.endsWith("_op")) {
      if (CUSTOM_OPERATORS_BY_TYPE[fieldType]?.has(value)) output.set(key, value);
    } else if (value.length <= 500) {
      output.set(key, value);
    }
  });

  return output.toString();
}

export async function getSavedIssueListFilterQuery(
  userId: string,
  scope: IssueListPreferenceScope
) {
  const record = await prisma.issueListPreference.findUnique({
    where: {
      userId_projectId_surface_kind_contextKey: {
        userId,
        projectId: scope.projectId,
        surface: scope.surface,
        kind: "FILTERS",
        contextKey: scope.contextKey,
      },
    },
    select: { payloadJson: true, schemaVersion: true },
  });
  if (!record || record.schemaVersion !== ISSUE_LIST_PREFERENCE_VERSION) return "";

  try {
    const payload = filterPayloadSchema.parse(JSON.parse(record.payloadJson));
    return sanitizeIssueListFilterQuery(userId, scope, payload.query);
  } catch {
    return "";
  }
}

export function filterPayloadJson(query: string) {
  return JSON.stringify(filterPayloadSchema.parse({ query }));
}
