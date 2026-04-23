"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";

import { createPlan } from "@/app/actions/plans";
import { PLAN_NAME_MAX_LENGTH } from "@/lib/validation";

import AlertPopup from "./AlertPopup";
import LocalizedDateInput from "./LocalizedDateInput";

type CreatePlanButtonProps = {
  projectId: string;
  locale: "en" | "zh";
};

function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCreatePlanText(locale: "en" | "zh") {
  if (locale === "zh") {
    return {
      button: "创建计划",
      modalTitle: "创建计划",
      name: "计划名称",
      namePlaceholder: "例如：2026年5-6月政务服务一期上线",
      description: "说明",
      dateRange: "时间范围",
      startDate: "开始日期",
      endDate: "结束日期",
      cancel: "取消",
      create: "创建",
      creating: "创建中...",
      failed: "创建计划失败",
    };
  }

  return {
    button: "Create plan",
    modalTitle: "Create plan",
    name: "Plan name",
    namePlaceholder: "For example: May-Jun 2026 Government Services Launch",
    description: "Description",
    dateRange: "Date range",
    startDate: "Start date",
    endDate: "End date",
    cancel: "Cancel",
    create: "Create",
    creating: "Creating...",
    failed: "Failed to create plan",
  };
}

export default function CreatePlanButton({ projectId, locale }: CreatePlanButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const text = getCreatePlanText(locale);
  const today = useMemo(() => new Date(), []);
  const sixtyDaysLater = useMemo(() => {
    const next = new Date(today);
    next.setDate(next.getDate() + 60);
    return next;
  }, [today]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: formatDateInputValue(today),
    endDate: formatDateInputValue(sixtyDaysLater),
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      startDate: formatDateInputValue(today),
      endDate: formatDateInputValue(sixtyDaysLater),
    });
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
      const result = await createPlan({
        projectId,
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
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
      >
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
                <label htmlFor="plan-name" className="text-sm font-medium text-slate-700">
                  {text.name}
                </label>
                <input
                  id="plan-name"
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  placeholder={text.namePlaceholder}
                  maxLength={PLAN_NAME_MAX_LENGTH}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="plan-description" className="text-sm font-medium text-slate-700">
                  {text.description}
                </label>
                <textarea
                  id="plan-description"
                  value={formData.description}
                  onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="plan-start-date" className="text-sm font-medium text-slate-700">
                    {text.startDate}
                  </label>
                  <LocalizedDateInput
                    id="plan-start-date"
                    locale={locale}
                    value={formData.startDate}
                    onChange={(event) => setFormData((current) => ({ ...current, startDate: event.target.value }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="plan-end-date" className="text-sm font-medium text-slate-700">
                    {text.endDate}
                  </label>
                  <LocalizedDateInput
                    id="plan-end-date"
                    locale={locale}
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
                  {isPending ? text.creating : text.create}
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
