"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deletePlan } from "@/app/actions/plans";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import AlertPopup from "./AlertPopup";

type DeletePlanButtonProps = {
  planId: string;
  projectId: string;
  locale: "en" | "zh";
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

export default function DeletePlanButton({ planId, projectId, locale }: DeletePlanButtonProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const text = getDeletePlanText(locale);

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
      router.push("/plans");
      router.refresh();
    });
  };

  return (
    <>
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => (!open && !isPending ? setIsDialogOpen(false) : null)}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-destructive/5 px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              {text.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <p className="text-sm font-medium text-foreground">{text.confirm}</p>
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
