export const PLAN_STATUSES = ["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const TERMINAL_PLAN_STATUSES = new Set<PlanStatus>(["COMPLETED", "CANCELLED"]);

export function isPlanStatus(value: string): value is PlanStatus {
  return PLAN_STATUSES.includes(value as PlanStatus);
}

export function isTerminalPlanStatus(value?: string | null): value is "COMPLETED" | "CANCELLED" {
  return value === "COMPLETED" || value === "CANCELLED";
}

export function canTransitionPlanStatus(current: string, next: PlanStatus) {
  if (current === "PLANNED") return next === "ACTIVE" || next === "CANCELLED";
  if (current === "ACTIVE") return next === "COMPLETED" || next === "CANCELLED";
  return (current === "COMPLETED" || current === "CANCELLED") && next === "ACTIVE";
}

export function getPlanStatusOrder(status: string) {
  return status === "ACTIVE" ? 0 : status === "PLANNED" ? 1 : status === "COMPLETED" ? 2 : 3;
}

export function getPlanStatusPresentation(status: string, locale: "en" | "zh") {
  const values = {
    PLANNED: {
      label: locale === "zh" ? "未开始" : "Not started",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    ACTIVE: {
      label: locale === "zh" ? "进行中" : "Active",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    },
    COMPLETED: {
      label: locale === "zh" ? "已完成" : "Completed",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    CANCELLED: {
      label: locale === "zh" ? "已取消" : "Cancelled",
      className: "border-slate-200 bg-slate-100 text-slate-600",
    },
  } as const;
  return values[isPlanStatus(status) ? status : "PLANNED"];
}

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getPlanDateHint(
  plan: { status: string; startDate: Date | string; endDate: Date | string },
  locale: "en" | "zh",
  now = new Date(),
) {
  if (isTerminalPlanStatus(plan.status)) return null;
  const today = startOfLocalDay(now);
  const target = startOfLocalDay(new Date(plan.status === "PLANNED" ? plan.startDate : plan.endDate));
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (plan.status === "PLANNED") {
    if (days > 0) return locale === "zh" ? `距开始 ${days} 天` : `Starts in ${days} days`;
    if (days === 0) return locale === "zh" ? "今天开始" : "Starts today";
    return locale === "zh" ? `计划开始日已过 ${Math.abs(days)} 天` : `Start date passed ${Math.abs(days)} days ago`;
  }

  if (days > 0) return locale === "zh" ? `剩余 ${days} 天` : `${days} days remaining`;
  if (days === 0) return locale === "zh" ? "今天结束" : "Ends today";
  return locale === "zh" ? `已逾期 ${Math.abs(days)} 天` : `${Math.abs(days)} days overdue`;
}

export function getTerminalPlanIssueMessage(status: string, locale: "en" | "zh") {
  if (status === "CANCELLED") {
    return locale === "zh"
      ? "当前问题关联到已取消计划，请先重新打开计划"
      : "This issue belongs to a cancelled plan. Reopen the plan first.";
  }
  return locale === "zh"
    ? "当前问题关联到已完成计划，请先重新打开计划"
    : "This issue belongs to a completed plan. Reopen the plan first.";
}

export function partitionPlanIssues<T extends { status: string }>(issues: T[], doneStatusKeys: string[]) {
  const doneStatuses = new Set(doneStatusKeys);
  const completed: T[] = [];
  const unfinished: T[] = [];
  for (const issue of issues) {
    (doneStatuses.has(issue.status) ? completed : unfinished).push(issue);
  }
  return { completed, unfinished };
}
