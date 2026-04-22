"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Pencil, X } from "lucide-react";

import { updatePlan } from "@/app/actions/plans";

import AlertPopup from "./AlertPopup";

type EditPlanButtonProps = {
  plan: {
    id: string;
    projectId: string;
    name: string;
    description?: string | null;
    startDate: Date | string;
    endDate: Date | string;
  };
  locale: "en" | "zh";
};

function formatDateInputValue(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

function getEditPlanText(locale: "en" | "zh") {
  if (locale === "zh") {
    return {
      button: "编辑",
      modalTitle: "编辑计划",
      name: "计划名称",
      namePlaceholder: "例如：2026年5-6月政务服务一期上线",
      description: "说明",
      startDate: "开始日期",
      endDate: "结束日期",
      cancel: "取消",
      save: "保存",
      saving: "保存中...",
      failed: "更新计划失败",
    };
  }

  return {
    button: "Edit plan",
    modalTitle: "Edit plan",
    name: "Plan name",
    namePlaceholder: "For example: May-Jun 2026 Government Services Launch",
    description: "Description",
    startDate: "Start date",
    endDate: "End date",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    failed: "Failed to update plan",
  };
}

export default function EditPlanButton({ plan, locale }: EditPlanButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const text = getEditPlanText(locale);
  const initialFormData = useMemo(
    () => ({
      name: plan.name,
      description: plan.description || "",
      startDate: formatDateInputValue(plan.startDate),
      endDate: formatDateInputValue(plan.endDate),
    }),
    [plan.description, plan.endDate, plan.name, plan.startDate]
  );
  const [formData, setFormData] = useState(initialFormData);

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const handleOpen = () => {
    setErrorMessage("");
    setFormData(initialFormData);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isPending) return;
    setIsOpen(false);
    setErrorMessage("");
    resetForm();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updatePlan({
        id: plan.id,
        projectId: plan.projectId,
        name: formData.name,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
      });

      if (!result.success) {
        setErrorMessage(`${text.failed}: ${result.error}`);
        return;
      }

      handleClose();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        <Pencil size={16} />
        {text.button}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-800">{text.modalTitle}</h2>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-plan-name" className="text-sm font-medium text-slate-700">
                  {text.name}
                </label>
                <input
                  id="edit-plan-name"
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  placeholder={text.namePlaceholder}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-plan-description" className="text-sm font-medium text-slate-700">
                  {text.description}
                </label>
                <textarea
                  id="edit-plan-description"
                  value={formData.description}
                  onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-plan-start-date" className="text-sm font-medium text-slate-700">
                    {text.startDate}
                  </label>
                  <input
                    id="edit-plan-start-date"
                    type="date"
                    value={formData.startDate}
                    onChange={(event) => setFormData((current) => ({ ...current, startDate: event.target.value }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-plan-end-date" className="text-sm font-medium text-slate-700">
                    {text.endDate}
                  </label>
                  <input
                    id="edit-plan-end-date"
                    type="date"
                    value={formData.endDate}
                    onChange={(event) => setFormData((current) => ({ ...current, endDate: event.target.value }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  {text.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                  {isPending ? text.saving : text.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
    </>
  );
}
