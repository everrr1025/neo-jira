const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type IterationTiming =
  | { state: "active"; days: number }
  | { state: "ends-today"; days: 0 }
  | { state: "overdue"; days: number };

export function getDeadlineTimingTone(timing: IterationTiming) {
  if (timing.state === "overdue") return "danger" as const;
  if (timing.state === "ends-today" || timing.days <= 3) return "warning" as const;
  return "neutral" as const;
}

export function formatDeadlineTiming(timing: IterationTiming, locale: "en" | "zh") {
  if (timing.state === "ends-today") return locale === "zh" ? "今天结束" : "Ends today";
  if (timing.state === "overdue") {
    return locale === "zh" ? `已逾期 ${timing.days} 天` : `${timing.days} days overdue`;
  }
  return locale === "zh" ? `剩余 ${timing.days} 天` : `${timing.days} days remaining`;
}

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
