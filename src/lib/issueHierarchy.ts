export const ISSUE_TYPES = ["TASK", "STORY", "BUG", "EPIC"] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

const ALLOWED_CHILD_TYPES: Record<IssueType, IssueType[]> = {
  EPIC: ["STORY", "TASK", "BUG"],
  STORY: ["TASK", "BUG"],
  TASK: ["BUG"],
  BUG: [],
};

export function isIssueType(value: string): value is IssueType {
  return ISSUE_TYPES.includes(value as IssueType);
}

export function canNestIssueType(parentType: string, childType: string) {
  if (!isIssueType(parentType) || !isIssueType(childType)) return false;
  return ALLOWED_CHILD_TYPES[parentType].includes(childType);
}

export function getAllowedChildIssueTypes(parentType: string) {
  return isIssueType(parentType) ? ALLOWED_CHILD_TYPES[parentType] : [];
}

export function getIssueParentValidationMessage(parentType: string, childType: string, locale: "zh" | "en" = "en") {
  if (canNestIssueType(parentType, childType)) return null;
  return locale === "zh"
    ? "该问题类型不能挂到选定父级下"
    : "This issue type cannot be nested under the selected parent";
}

export function wouldCreateIssueHierarchyCycle(issueId: string, ancestorIds: string[]) {
  const visited = new Set<string>();

  for (const ancestorId of ancestorIds) {
    if (ancestorId === issueId) return true;
    if (visited.has(ancestorId)) return true;
    visited.add(ancestorId);
  }

  return false;
}
