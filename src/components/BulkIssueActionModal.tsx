"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import AlertPopup from "./AlertPopup";

export type BulkIssueActionType =
  | "assignPlan"
  | "removePlan"
  | "assignIteration"
  | "removeIteration"
  | "assignAssignee";

type BulkIssueActionModalProps = {
  isOpen: boolean;
  actionType: BulkIssueActionType | null;
  selectedCount: number;
  plans: { id: string; name: string }[];
  iterations: { id: string; name: string }[];
  users: { id: string; name: string | null }[];
  locale: "en" | "zh";
  onClose: () => void;
  onSubmit: (action: { type: BulkIssueActionType; targetId?: string | null }) => Promise<string | null>;
};

function getBulkIssueActionText(locale: "en" | "zh") {
  if (locale === "zh") {
    return {
      addToPlan: "加入计划",
      removeFromPlan: "移出计划",
      addToSprint: "加入迭代",
      removeFromSprint: "移出迭代",
      updateAssignee: "修改负责人",
      plan: "计划",
      sprint: "迭代",
      assignee: "负责人",
      unassigned: "未分配",
      noPlan: "未设置计划",
      selectedCount: "已选择",
      itemsSuffix: "项问题",
      cancel: "取消",
      confirm: "确认",
      removePlanHint: "确认将所选问题从当前计划中移除。",
      removeSprintHint: "确认将所选问题移出当前迭代并放回待办池。",
    };
  }

  return {
    addToPlan: "Add To Plan",
    removeFromPlan: "Remove From Plan",
    addToSprint: "Add To Sprint",
    removeFromSprint: "Remove From Sprint",
    updateAssignee: "Update Assignee",
    plan: "Plan",
    sprint: "Sprint",
    assignee: "Assignee",
    unassigned: "Unassigned",
    noPlan: "No plan",
    selectedCount: "Selected",
    itemsSuffix: "issues",
    cancel: "Cancel",
    confirm: "Confirm",
    removePlanHint: "Remove the selected issues from their current plan.",
    removeSprintHint: "Remove the selected issues from this sprint and return them to the backlog.",
  };
}

const emptySelectValue = "__empty__";

function toSelectValue(value: string) {
  return value || emptySelectValue;
}

function fromSelectValue(value: string) {
  return value === emptySelectValue ? "" : value;
}

export default function BulkIssueActionModal({
  isOpen,
  actionType,
  selectedCount,
  plans,
  iterations,
  users,
  locale,
  onClose,
  onSubmit,
}: BulkIssueActionModalProps) {
  const [targetId, setTargetId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const text = getBulkIssueActionText(locale);

  const currentAction = actionType;

  const handleClose = () => {
    if (isPending) return;
    setTargetId("");
    setErrorMessage("");
    onClose();
  };

  const title = useMemo(() => {
    if (currentAction === "assignPlan") return text.addToPlan;
    if (currentAction === "removePlan") return text.removeFromPlan;
    if (currentAction === "assignIteration") return text.addToSprint;
    if (currentAction === "removeIteration") return text.removeFromSprint;
    if (currentAction === "assignAssignee") return text.updateAssignee;
    return "";
  }, [currentAction, text]);

  const options = useMemo(() => {
    if (currentAction === "assignPlan") {
      return plans.map((plan) => ({ value: plan.id, label: plan.name }));
    }

    if (currentAction === "assignIteration") {
      return iterations.map((iteration) => ({ value: iteration.id, label: iteration.name }));
    }

    if (currentAction === "assignAssignee") {
      return [
        { value: "", label: text.unassigned },
        ...users.map((user) => ({ value: user.id, label: user.name || user.id })),
      ];
    }

    return [];
  }, [currentAction, iterations, plans, text.unassigned, users]);

  if (!isOpen || !currentAction) return null;

  const handleConfirm = () => {
    if ((currentAction === "assignPlan" || currentAction === "assignIteration") && !targetId) {
      setErrorMessage(locale === "zh" ? "请选择目标项。" : "Please select a target.");
      return;
    }

    startTransition(async () => {
      const nextError = await onSubmit({
        type: currentAction,
        targetId:
          currentAction === "removePlan" || currentAction === "removeIteration" ? undefined : targetId || null,
      });

      if (nextError) {
        setErrorMessage(nextError);
        return;
      }

      handleClose();
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : null)}>
        <DialogContent showCloseButton={false} className="max-w-lg gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle>{title}</DialogTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {text.selectedCount} {selectedCount} {text.itemsSuffix}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleClose}
                disabled={isPending}
                aria-label={text.cancel}
              >
                <X className="size-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-5 px-6 py-5">
            {currentAction === "removePlan" || currentAction === "removeIteration" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {currentAction === "removePlan" ? text.removePlanHint : text.removeSprintHint}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bulk-target">
                  {currentAction === "assignPlan"
                    ? text.plan
                    : currentAction === "assignIteration"
                      ? text.sprint
                      : text.assignee}
                </Label>
                <Select value={toSelectValue(targetId)} onValueChange={(value) => setTargetId(fromSelectValue(value))}>
                  <SelectTrigger id="bulk-target" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.value || emptySelectValue} value={toSelectValue(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="border-t bg-muted/35 px-6 py-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              {text.cancel}
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {text.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
    </>
  );
}
