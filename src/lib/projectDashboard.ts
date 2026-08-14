const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type IterationTiming =
  | { state: "active"; days: number }
  | { state: "ends-today"; days: 0 }
  | { state: "overdue"; days: number };

export type DashboardIssueTabId = "assigned" | "watched" | "priority" | "overdue" | "due-soon";

export function getIterationTiming(endDate: Date | null, today = new Date()): IterationTiming | null {
  if (!endDate) return null;

  const localToday = new Date(today);
  localToday.setHours(0, 0, 0, 0);

  const localEndDate = new Date(endDate);
  localEndDate.setHours(0, 0, 0, 0);

  const daysUntilEnd = Math.round((localEndDate.getTime() - localToday.getTime()) / DAY_IN_MS);
  if (daysUntilEnd < 0) {
    return { state: "overdue", days: Math.abs(daysUntilEnd) };
  }
  if (daysUntilEnd === 0) {
    return { state: "ends-today", days: 0 };
  }
  return { state: "active", days: daysUntilEnd };
}

export function selectInitialDashboardIssueTab(
  counts: Record<DashboardIssueTabId, number>,
): DashboardIssueTabId {
  const priorityOrder: DashboardIssueTabId[] = [
    "overdue",
    "priority",
    "assigned",
    "due-soon",
    "watched",
  ];

  return priorityOrder.find((tabId) => counts[tabId] > 0) ?? "assigned";
}
