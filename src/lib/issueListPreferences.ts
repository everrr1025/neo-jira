import { z } from "zod";

export const ISSUE_LIST_PREFERENCE_VERSION = 1;
export const SHARED_PREFERENCE_CONTEXT = "_";

export const issueListSurfaces = ["ISSUES", "PLAN", "ITERATION"] as const;
export type IssueListSurface = (typeof issueListSurfaces)[number];

export type IssueListPreferenceScope = {
  projectId: string;
  surface: IssueListSurface;
  contextKey: string;
};

export const issueListLayoutSchema = z.object({
  orderedKeys: z.array(z.string().min(1).max(160)).max(160),
  hiddenKeys: z.array(z.string().min(1).max(160)).max(160),
  widths: z.record(z.string(), z.number().finite().min(60).max(1200)),
});

export type IssueListLayoutPreference = z.infer<typeof issueListLayoutSchema>;

export type IssueListInitialPreferences = {
  baseLayout: IssueListLayoutPreference | null;
  contextLayout: IssueListLayoutPreference | null;
};

const STATIC_FILTER_KEYS = new Set([
  "status",
  "type",
  "priority",
  "plan",
  "sprint",
  "assignee",
  "watcher",
  "view",
  "dueFilter",
  "dueDate",
  "duePreset",
  "search",
  "pageSize",
  "sortBy",
  "sortDirection",
]);

export function isIssueListFilterKey(key: string) {
  return (
    STATIC_FILTER_KEYS.has(key) ||
    key.startsWith("issueField_") ||
    key.startsWith("planField_")
  );
}

export function hasExplicitIssueListParams(
  params: Record<string, string | string[] | undefined>
) {
  return Object.keys(params).some((key) => key === "page" || isIssueListFilterKey(key));
}

export function searchParamsRecordToUrlSearchParams(
  params: Record<string, string | string[] | undefined>
) {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(key, item);
    } else if (value !== undefined) {
      result.set(key, value);
    }
  }
  return result;
}

export function buildPersistedIssueListQuery(params: URLSearchParams) {
  const stored = new URLSearchParams();
  params.forEach((value, key) => {
    if (isIssueListFilterKey(key) && value) stored.set(key, value);
  });
  return stored.toString();
}

export function parseStoredLayout(raw: string | null | undefined): IssueListLayoutPreference | null {
  if (!raw) return null;
  try {
    return issueListLayoutSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function normalizeLayoutPreference(
  preference: IssueListLayoutPreference | null,
  availableKeys: string[],
  defaultWidths: Record<string, number>
): IssueListLayoutPreference {
  const available = new Set(availableKeys);
  const orderedKeys = preference?.orderedKeys.filter((key) => available.has(key)) ?? [];
  for (const key of availableKeys) {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  }

  const hiddenKeys = preference?.hiddenKeys.filter((key) => available.has(key)) ?? [];
  const widths: Record<string, number> = {};
  for (const key of availableKeys) {
    const storedWidth = preference?.widths[key];
    widths[key] =
      typeof storedWidth === "number" && storedWidth >= 60 && storedWidth <= 1200
        ? storedWidth
        : defaultWidths[key];
  }

  return { orderedKeys, hiddenKeys, widths };
}

export function mergePlanContextLayout(
  base: IssueListLayoutPreference,
  context: IssueListLayoutPreference | null,
  availableKeys: string[],
  defaultWidths: Record<string, number>
) {
  if (!context) return normalizeLayoutPreference(base, availableKeys, defaultWidths);

  const available = new Set(availableKeys);
  const baseKeys = base.orderedKeys.filter((key) => available.has(key) && !key.startsWith("planField:"));
  const contextKeys = context.orderedKeys.filter((key) => available.has(key));
  let baseIndex = 0;
  const orderedKeys = contextKeys.map((key) =>
    key.startsWith("planField:") ? key : (baseKeys[baseIndex++] ?? key)
  );

  for (; baseIndex < baseKeys.length; baseIndex += 1) orderedKeys.push(baseKeys[baseIndex]);
  for (const key of availableKeys) {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  }

  const hiddenKeys = [
    ...base.hiddenKeys.filter((key) => available.has(key) && !key.startsWith("planField:")),
    ...context.hiddenKeys.filter((key) => available.has(key) && key.startsWith("planField:")),
  ];
  const widths = { ...defaultWidths, ...base.widths };
  for (const [key, width] of Object.entries(context.widths)) {
    if (key.startsWith("planField:") && available.has(key)) widths[key] = width;
  }

  return normalizeLayoutPreference({ orderedKeys, hiddenKeys, widths }, availableKeys, defaultWidths);
}

export function splitLayoutForStorage(layout: IssueListLayoutPreference) {
  const isPlanField = (key: string) => key.startsWith("planField:");
  return {
    base: {
      orderedKeys: layout.orderedKeys.filter((key) => !isPlanField(key)),
      hiddenKeys: layout.hiddenKeys.filter((key) => !isPlanField(key)),
      widths: Object.fromEntries(Object.entries(layout.widths).filter(([key]) => !isPlanField(key))),
    },
    context: {
      orderedKeys: layout.orderedKeys,
      hiddenKeys: layout.hiddenKeys.filter(isPlanField),
      widths: Object.fromEntries(Object.entries(layout.widths).filter(([key]) => isPlanField(key))),
    },
  } satisfies { base: IssueListLayoutPreference; context: IssueListLayoutPreference };
}

export function replaceVisibleKeyOrder(allKeys: string[], previousVisible: string[], nextVisible: string[]) {
  const previousVisibleSet = new Set(previousVisible);
  let index = 0;
  return allKeys.map((key) => (previousVisibleSet.has(key) ? nextVisible[index++] : key));
}
