"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { startSprint, completeSprint, deleteSprint } from "@/app/actions/sprints";
import { getTranslations, Locale } from "@/lib/i18n";
import AlertPopup from "./AlertPopup";

export function SprintActionButton({ sprintId, status, locale }: { sprintId: string; status: string; locale: Locale }) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const translations = getTranslations(locale);

  const handleAction = () => {
    setError("");
    startTransition(async () => {
      const action = status === "ACTIVE" ? completeSprint : startSprint;
      const res = await action(sprintId);
      if (!res.success) {
        setError(res.error || translations.sprintAction.actionFailed);
      }
    });
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    const confirmed = window.confirm("Delete this sprint? All issues in it will be moved to backlog.");
    if (!confirmed) return;

    setError("");
    setIsDeleting(true);
    try {
      const res = await deleteSprint(sprintId);
      if (!res.success) {
        setError(res.error || "Failed to delete sprint");
        setIsDeleting(false);
        return;
      }
      window.location.assign("/iterations");
    } catch (err) {
      console.error(err);
      setError("Failed to delete sprint");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {status !== "COMPLETED" && (
          <button
            disabled={isPending}
            onClick={handleAction}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50
              ${status === "ACTIVE"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-white border hover:bg-slate-50 text-slate-700"
              }
            `}
          >
            {isPending && <Loader2 size={16} className="animate-spin" />}
            {status === "ACTIVE" ? translations.sprintAction.completeSprint : translations.sprintAction.startSprint}
          </button>
        )}
        <button
          disabled={isDeleting}
          onClick={handleDelete}
          className="px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 border border-red-200 text-red-600 bg-white hover:bg-red-50"
        >
          {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          {locale === "zh" ? "删除 Sprint" : "Delete Sprint"}
        </button>
      </div>
      <AlertPopup message={error} onClose={() => setError("")} autoCloseMs={5000} />
    </>
  );
}
