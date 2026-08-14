"use client";

import { useState, useTransition } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import { completePlan, reopenPlan, startPlan } from "@/app/actions/plans";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AlertPopup from "./AlertPopup";

export default function PlanLifecycleActions({
  planId,
  status,
  totalIssues,
  unfinishedIssues,
  blockingIssueKeys,
  locale,
}: {
  planId: string;
  status: string;
  totalIssues: number;
  unfinishedIssues: number;
  blockingIssueKeys: string[];
  locale: "en" | "zh";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [error, setError] = useState("");
  const canComplete = totalIssues > 0 && unfinishedIssues === 0;

  const run = (action: () => Promise<{ success: boolean; error?: string }>) => {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error || (locale === "zh" ? "操作失败" : "Action failed"));
        return;
      }
      setIsCompleteOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      {status === "PLANNED" ? (
        <Button type="button" disabled={isPending} onClick={() => run(() => startPlan(planId))}>
          {isPending ? <Loader2 className="animate-spin" /> : <Play />}
          {locale === "zh" ? "开始计划" : "Start plan"}
        </Button>
      ) : null}
      {status === "ACTIVE" ? (
        <Button type="button" disabled={isPending} className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setIsCompleteOpen(true)}>
          {locale === "zh" ? "完成计划" : "Complete plan"}
        </Button>
      ) : null}
      {status === "COMPLETED" || status === "CANCELLED" ? (
        <Button type="button" disabled={isPending} onClick={() => run(() => reopenPlan(planId))}>
          {isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
          {locale === "zh" ? "重新打开" : "Reopen plan"}
        </Button>
      ) : null}

      <Dialog open={isCompleteOpen} onOpenChange={(open) => !open && !isPending && setIsCompleteOpen(false)}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{locale === "zh" ? "完成计划" : "Complete plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-6 py-5 text-sm">
            <p>{locale === "zh" ? `问题总数：${totalIssues}，未完成：${unfinishedIssues}` : `Total issues: ${totalIssues}; unfinished: ${unfinishedIssues}`}</p>
            {!canComplete ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
                {totalIssues === 0
                  ? (locale === "zh" ? "空计划不能完成，请先关联至少一个问题。" : "An empty plan cannot be completed.")
                  : (locale === "zh" ? `请先完成：${blockingIssueKeys.join("、")}` : `Complete these issues first: ${blockingIssueKeys.join(", ")}`)}
              </div>
            ) : (
              <p className="text-muted-foreground">{locale === "zh" ? "完成后问题状态和计划关联将被锁定。" : "Issue statuses and plan links will be locked after completion."}</p>
            )}
          </div>
          <DialogFooter className="border-t bg-muted/35 px-6 py-4">
            <Button variant="outline" onClick={() => setIsCompleteOpen(false)} disabled={isPending}>{locale === "zh" ? "返回" : "Back"}</Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={!canComplete || isPending} onClick={() => run(() => completePlan(planId))}>
              {isPending ? <Loader2 className="animate-spin" /> : null}{locale === "zh" ? "确认完成" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertPopup message={error} onClose={() => setError("")} autoCloseMs={5000} />
    </>
  );
}
