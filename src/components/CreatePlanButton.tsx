"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";

import { createPlan } from "@/app/actions/plans";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PLAN_NAME_MAX_LENGTH } from "@/lib/validation";

import AlertPopup from "./AlertPopup";
import ShadcnDatePicker from "./ShadcnDatePicker";

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
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
      >
        {text.button}
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : setIsOpen(true))}>
        <DialogContent showCloseButton={false} className="max-w-2xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{text.modalTitle}</DialogTitle>
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

          <form onSubmit={handleSubmit}>
            <div className="space-y-5 p-6">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-name">{text.name}</Label>
                <Input
                  id="plan-name"
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  placeholder={text.namePlaceholder}
                  maxLength={PLAN_NAME_MAX_LENGTH}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-description">{text.description}</Label>
                <Textarea
                  id="plan-description"
                  value={formData.description}
                  onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  className="min-h-24"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ShadcnDatePicker
                  id="plan-start-date"
                  label={text.startDate}
                  locale={locale}
                  value={formData.startDate}
                  onChange={(startDate) => setFormData((current) => ({ ...current, startDate }))}
                />

                <ShadcnDatePicker
                  id="plan-end-date"
                  label={text.endDate}
                  locale={locale}
                  value={formData.endDate}
                  onChange={(endDate) => setFormData((current) => ({ ...current, endDate }))}
                />
              </div>
            </div>

            <DialogFooter className="border-t bg-muted/35 px-6 py-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                {text.cancel}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : null}
                {isPending ? text.creating : text.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
    </>
  );
}
