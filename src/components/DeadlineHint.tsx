import { Badge } from "@/components/ui/badge";
import { formatDeadlineTiming, getDeadlineTimingTone, type IterationTiming } from "@/lib/projectDashboard";

export default function DeadlineHint({
  timing,
  locale,
  unfinishedCount,
}: {
  timing: IterationTiming | null;
  locale: "en" | "zh";
  unfinishedCount?: number;
}) {
  if (!timing) return null;

  const tone = getDeadlineTimingTone(timing);
  const unfinishedText = timing.state === "overdue" && unfinishedCount
    ? locale === "zh"
      ? ` · ${unfinishedCount} 个未完成`
      : ` · ${unfinishedCount} unfinished`
    : "";

  return (
    <Badge
      variant="outline"
      className={
        tone === "danger"
          ? "border-red-200 bg-red-50 text-red-700"
          : tone === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-slate-200 bg-slate-50 text-slate-600"
      }
    >
      {formatDeadlineTiming(timing, locale)}{unfinishedText}
    </Badge>
  );
}
