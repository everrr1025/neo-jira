"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";

import AlertPopup from "./AlertPopup";
import { DropdownField } from "./DropdownField";

export type BulkIssueActionType = "assignPlan" | "removePlan" | "assignIteration" | "assignAssignee";

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
    };
  }

  return {
    addToPlan: "Add To Plan",
    removeFromPlan: "Remove From Plan",
    addToSprint: "Add To Sprint",
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
  };
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

  useEffect(() => {
    if (!isOpen) return;
    setTargetId("");
    setErrorMessage("");
  }, [currentAction, isOpen]);

  const title = useMemo(() => {
    if (currentAction === "assignPlan") return text.addToPlan;
    if (currentAction === "removePlan") return text.removeFromPlan;
    if (currentAction === "assignIteration") return text.addToSprint;
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
        targetId: currentAction === "removePlan" ? undefined : targetId || null,
      });

      if (nextError) {
        setErrorMessage(nextError);
        return;
      }

      onClose();
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
        <div className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {text.selectedCount} {selectedCount} {text.itemsSuffix}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            {currentAction === "removePlan" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {text.removePlanHint}
              </div>
            ) : (
              <DropdownField
                id="bulk-target"
                label={
                  currentAction === "assignPlan"
                    ? text.plan
                    : currentAction === "assignIteration"
                      ? text.sprint
                      : text.assignee
                }
                value={targetId}
                onChange={setTargetId}
                options={options}
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {text.cancel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              {text.confirm}
            </button>
          </div>
        </div>
      </div>
      <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
    </>
  );
}
