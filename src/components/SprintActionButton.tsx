"use client";

import { useTransition, useState } from "react";
import { startSprint, completeSprint } from "@/app/actions/sprints";
import { Loader2 } from "lucide-react";

export function SprintActionButton({ sprintId, status }: { sprintId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleAction = () => {
    setError("");
    startTransition(async () => {
      const action = status === "ACTIVE" ? completeSprint : startSprint;
      const res = await action(sprintId);
      if (!res.success) {
        setError(res.error || "Action failed");
      }
    });
  };

  if (status === "COMPLETED") return null;

  return (
    <div className="flex flex-col items-end gap-1">
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
        {status === "ACTIVE" ? "Complete Sprint" : "Start Sprint"}
      </button>
      {error && (
        <span className="text-xs text-red-500 font-medium max-w-[200px] text-right">{error}</span>
      )}
    </div>
  );
}
