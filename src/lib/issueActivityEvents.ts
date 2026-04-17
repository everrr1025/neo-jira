export const ISSUE_ACTIVITY_UPDATED_EVENT = "issue-activity-updated";

export function emitIssueActivityUpdated(issueId: string) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(ISSUE_ACTIVITY_UPDATED_EVENT, {
      detail: { issueId },
    }),
  );
}
