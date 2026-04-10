"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { completeSprint, deleteSprint, reopenSprint, startSprint } from "@/app/actions/sprints";
import { getTranslations, Locale, localeDateMap } from "@/lib/i18n";
import AlertPopup from "./AlertPopup";

type PlannedSprintOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  recommended?: boolean;
};

type SprintActionButtonProps = {
  sprintId: string;
  status: string;
  locale: Locale;
  plannedSprints: PlannedSprintOption[];
  unfinishedIssueCount: number;
};

export function SprintActionButton({
  sprintId,
  status,
  locale,
  plannedSprints,
  unfinishedIssueCount,
}: SprintActionButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<"BACKLOG" | "SPRINT">("BACKLOG");
  const [targetSprintId, setTargetSprintId] = useState("");
  const [error, setError] = useState("");
  const translations = getTranslations(locale);
  const text = translations.sprintAction;

  const recommendedSprint = useMemo(
    () => plannedSprints.find((sprint) => sprint.recommended) || null,
    [plannedSprints]
  );

  const openCompleteDialog = () => {
    setError("");
    if (unfinishedIssueCount === 0) {
      completeWithTarget("BACKLOG");
      return;
    }

    setMoveTarget(recommendedSprint ? "SPRINT" : "BACKLOG");
    setTargetSprintId(recommendedSprint?.id || plannedSprints[0]?.id || "");
    setIsCompleteOpen(true);
  };

  const runAction = (action: () => Promise<{ success: boolean; error?: string }>) => {
    setError("");
    startTransition(async () => {
      const res = await action();
      if (!res.success) {
        setError(res.error || text.actionFailed);
      }
    });
  };

  const completeWithTarget = (nextMoveTarget = moveTarget) => {
    const selectedTargetSprintId = nextMoveTarget === "SPRINT" ? targetSprintId : undefined;
    runAction(() =>
      completeSprint(sprintId, {
        moveUnfinishedTo: nextMoveTarget,
        targetSprintId: selectedTargetSprintId,
      })
    );
    setIsCompleteOpen(false);
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    const confirmed = window.confirm(text.deleteConfirm);
    if (!confirmed) return;

    setError("");
    setIsDeleting(true);
    try {
      const res = await deleteSprint(sprintId);
      if (!res.success) {
        setError(res.error || text.deleteFailed);
        setIsDeleting(false);
        return;
      }
      window.location.assign("/iterations");
    } catch (err) {
      console.error(err);
      setError(text.deleteFailed);
      setIsDeleting(false);
    }
  };

  const formatDate = (dateValue: string) => new Date(dateValue).toLocaleDateString(localeDateMap[locale]);

  if (status === "COMPLETED") {
    return <AlertPopup message={error} onClose={() => setError("")} autoCloseMs={5000} />;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {status === "PLANNED" && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => runAction(() => startSprint(sprintId))}
              className="flex items-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {isPending && <Loader2 size={16} className="animate-spin" />}
              {text.startSprint}
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {text.deleteSprint}
            </button>
          </>
        )}

        {status === "ACTIVE" && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={openCompleteDialog}
              className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending && <Loader2 size={16} className="animate-spin" />}
              {text.completeSprint}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => runAction(() => reopenSprint(sprintId))}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw size={16} />
              {text.moveBackToPlanned}
            </button>
          </>
        )}
      </div>

      {isCompleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-800">{text.completeTitle}</h2>
              <p className="mt-1 text-sm text-slate-500">{text.completeDescription}</p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                {text.unfinishedCount}: {unfinishedIssueCount}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">{text.moveUnfinishedTo}</p>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 transition-colors hover:bg-slate-50">
                  <input
                    type="radio"
                    name="move-target"
                    checked={moveTarget === "BACKLOG"}
                    onChange={() => setMoveTarget("BACKLOG")}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-sm font-medium text-slate-700">{text.moveToBacklog}</span>
                </label>

                <label
                  className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                    plannedSprints.length > 0
                      ? "cursor-pointer border-slate-200 hover:bg-slate-50"
                      : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="move-target"
                    checked={moveTarget === "SPRINT"}
                    onChange={() => plannedSprints.length > 0 && setMoveTarget("SPRINT")}
                    disabled={plannedSprints.length === 0}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-slate-700">{text.moveToSprint}</span>
                    {plannedSprints.length > 0 ? (
                      <select
                        value={targetSprintId}
                        onChange={(event) => {
                          setTargetSprintId(event.target.value);
                          setMoveTarget("SPRINT");
                        }}
                        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                      >
                        {plannedSprints.map((sprint) => (
                          <option key={sprint.id} value={sprint.id}>
                            {sprint.name} · {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                            {sprint.recommended ? ` · ${text.recommended}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">{text.noPlannedSprints}</p>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsCompleteOpen(false)}
                disabled={isPending}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={() => completeWithTarget()}
                disabled={isPending || (moveTarget === "SPRINT" && !targetSprintId)}
                className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending && <Loader2 size={16} className="animate-spin" />}
                {isPending ? text.completing : text.confirmComplete}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertPopup message={error} onClose={() => setError("")} autoCloseMs={5000} />
    </>
  );
}
