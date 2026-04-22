"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deletePlan } from "@/app/actions/plans";

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
      <button
        type="button"
        onClick={() => setIsDialogOpen(true)}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        {text.button}
      </button>

      {isDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="border-b border-rose-100 bg-rose-50/50 px-6 py-4">
              <h2 className="flex items-center gap-2 text-xl font-bold text-rose-600">
                <AlertTriangle size={24} />
                {text.title}
              </h2>
            </div>
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm font-medium text-slate-700">{text.confirm}</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                disabled={isPending}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                {text.title}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
    </>
  );
}
