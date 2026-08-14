"use client";

import { AlertTriangle, Loader2, MoreHorizontal, Pencil, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cancelPlan } from "@/app/actions/plans";
import AlertPopup from "@/components/AlertPopup";
import DeletePlanButton from "@/components/DeletePlanButton";
import EditPlanButton from "@/components/EditPlanButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isTerminalPlanStatus } from "@/lib/planLifecycle";

type PlanMoreActionsProps = {
  plan: {
    id: string;
    projectId: string;
    name: string;
    description?: string | null;
    startDate: Date | string;
    endDate: Date | string;
    status: string;
  };
  locale: "en" | "zh";
  totalIssues: number;
  unfinishedIssues: number;
};

export default function PlanMoreActions({ plan, locale, totalIssues, unfinishedIssues }: PlanMoreActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [error, setError] = useState("");
  const canEdit = !isTerminalPlanStatus(plan.status);
  const canCancel = plan.status === "PLANNED" || plan.status === "ACTIVE";

  const handleCancel = () => {
    setError("");
    startTransition(async () => {
      const result = await cancelPlan(plan.id);
      if (!result.success) {
        setError(result.error || (locale === "zh" ? "操作失败" : "Action failed"));
        return;
      }
      setIsCancelOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title={locale === "zh" ? "更多" : "More actions"}
            aria-label={locale === "zh" ? "更多" : "More actions"}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {canEdit ? (
            <DropdownMenuItem onSelect={() => setIsEditOpen(true)}>
              <Pencil />
              {locale === "zh" ? "编辑" : "Edit plan"}
            </DropdownMenuItem>
          ) : null}
          {canCancel ? (
            <DropdownMenuItem onSelect={() => setIsCancelOpen(true)}>
              <XCircle />
              {locale === "zh" ? "取消" : "Cancel"}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onSelect={() => setIsDeleteOpen(true)}>
            <Trash2 />
            {locale === "zh" ? "删除" : "Delete plan"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {canEdit ? (
        <EditPlanButton
          plan={plan}
          locale={locale}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          showTrigger={false}
        />
      ) : null}
      <DeletePlanButton
        planId={plan.id}
        projectId={plan.projectId}
        locale={locale}
        status={plan.status}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        showTrigger={false}
      />

      <Dialog open={isCancelOpen} onOpenChange={(open) => (!open && !isPending ? setIsCancelOpen(false) : null)}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-amber-50 px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              {locale === "zh" ? "取消计划" : "Cancel plan"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 px-6 py-5 text-sm">
            <p>
              {locale === "zh"
                ? `将保留 ${totalIssues - unfinishedIssues} 个已完成问题，释放 ${unfinishedIssues} 个未完成问题。`
                : `${totalIssues - unfinishedIssues} completed issues will remain; ${unfinishedIssues} unfinished issues will be released.`}
            </p>
            <p className="text-muted-foreground">
              {locale === "zh"
                ? "被释放问题的计划字段值会同时清除。"
                : "Plan field values for released issues will be removed."}
            </p>
          </div>
          <DialogFooter className="border-t bg-muted/35 px-6 py-4">
            <Button variant="outline" onClick={() => setIsCancelOpen(false)} disabled={isPending}>
              {locale === "zh" ? "返回" : "Back"}
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleCancel}>
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {locale === "zh" ? "确认取消" : "Confirm cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertPopup message={error} onClose={() => setError("")} autoCloseMs={5000} />
    </>
  );
}
