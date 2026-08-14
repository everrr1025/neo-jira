"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deletePlan } from "@/app/actions/plans";
import { Button } from "@/components/ui/button";
import { getProjectPath, parseProjectPath } from "@/lib/projectRoutes";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isTerminalPlanStatus } from "@/lib/planLifecycle";

import AlertPopup from "./AlertPopup";

type DeletePlanButtonProps = {
  planId: string;
  projectId: string;
  locale: "en" | "zh";
  status?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
};

function getDeletePlanText(locale: "en" | "zh") {
  if (locale === "zh") {
    return {
      button: "删除",
      title: "删除计划",
      confirm: "确定删除此计划吗？操作不可撤销，计划下的问题不会被删除，只会取消关联。",
      failed: "删除计划失败",
      cancel: "取消",
    };
  }

  return {
    button: "Delete",
    title: "Delete Plan",
    confirm: "Are you sure you want to delete this plan? This cannot be undone. Issues will be kept and unlinked.",
    failed: "Failed to delete plan",
    cancel: "Cancel",
  };
}

export default function DeletePlanButton({
  planId,
  projectId,
  locale,
  status,
  open,
  onOpenChange,
  showTrigger = true,
}: DeletePlanButtonProps) {
  const router = useRouter();
  const projectRoute = parseProjectPath(usePathname());
  const [errorMessage, setErrorMessage] = useState("");
  const [internalIsDialogOpen, setInternalIsDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const text = getDeletePlanText(locale);
  const isDialogOpen = open ?? internalIsDialogOpen;

  const setIsDialogOpen = (nextOpen: boolean) => {
    if (open === undefined) setInternalIsDialogOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const handleDelete = () => {
    if (isPending) return;

    setErrorMessage("");
    startTransition(async () => {
      const result = await deletePlan({ id: planId, projectId });
      if (!result.success) {
        setErrorMessage(result.error || text.failed);
        return;
      }

      setIsDialogOpen(false);
      router.push(
        projectRoute
          ? getProjectPath(projectRoute.departmentId, projectRoute.projectId, "plans")
          : "/plans",
      );
      router.refresh();
    });
  };

  return (
    <>
      {showTrigger ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsDialogOpen(true)}
          disabled={isPending}
          className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {text.button}
        </Button>
      ) : null}

      <Dialog open={isDialogOpen} onOpenChange={(open) => (!open && !isPending ? setIsDialogOpen(false) : null)}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-destructive/5 px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              {text.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <p className="text-sm font-medium text-foreground">
              {isTerminalPlanStatus(status)
                ? (locale === "zh" ? "删除后该计划及其成果记录不可恢复，关联问题将保留并解除计划关联。" : "The plan and its result record cannot be recovered. Issues will remain and be unlinked.")
                : text.confirm}
            </p>
          </div>
          <DialogFooter className="border-t bg-muted/35 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isPending}>
              {text.cancel}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {text.title}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
    </>
  );
}
