const EDITABLE_ISSUE_FIELDS = new Set([
  "title",
  "description",
  "status",
  "priority",
  "type",
  "planId",
  "iterationId",
  "assigneeId",
  "parentIssueId",
  "dueDate",
]);

export function getEditableIssueUpdate(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid issue update");
  }

  const entries = Object.entries(data);
  const unsupportedField = entries.find(([field]) => !EDITABLE_ISSUE_FIELDS.has(field));
  if (unsupportedField) {
    throw new Error(`Unsupported issue field: ${unsupportedField[0]}`);
  }

  return Object.fromEntries(entries);
}
