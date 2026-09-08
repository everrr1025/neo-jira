type FieldValue = {
  valueBoolean: boolean | null;
  valueNumber: number | null;
  valueText: string | null;
  valueOption: string | null;
};

export type IssueCustomSort = {
  id: string;
  source: "issue" | "plan";
  type: string;
  direction: "asc" | "desc";
};

// Dates are stored as YYYY-MM-DD text, whose lexical order is chronological.
export function sortIssueCustomFieldRows<T extends { id: string; issueFieldValues: FieldValue[]; planFieldValues: FieldValue[] }>(
  rows: T[],
  sort: IssueCustomSort,
) {
  const valueOf = (row: T) => {
    const field = (sort.source === "issue" ? row.issueFieldValues : row.planFieldValues)[0];
    if (!field) return null;
    if (sort.type === "BOOLEAN") return field.valueBoolean;
    if (sort.type === "NUMBER") return field.valueNumber;
    if (sort.type === "SELECT") return field.valueOption || null;
    return field.valueText || null;
  };
  return [...rows].sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    // Keep missing values last in both directions and ties stable across pages.
    if (left == null && right == null) return a.id.localeCompare(b.id);
    if (left == null) return 1;
    if (right == null) return -1;
    const comparison = typeof left === "string" && typeof right === "string"
      ? left.localeCompare(right, "zh-CN")
      : Number(left) - Number(right);
    return comparison === 0 ? a.id.localeCompare(b.id) : comparison * (sort.direction === "asc" ? 1 : -1);
  });
}
