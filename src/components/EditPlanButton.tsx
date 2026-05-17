"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Pencil, X } from "lucide-react";

import { updatePlan } from "@/app/actions/plans";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PLAN_NAME_MAX_LENGTH } from "@/lib/validation";

import AlertPopup from "./AlertPopup";
import LocalizedDateInput from "./LocalizedDateInput";

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

const dateInputClassName =
  "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
      <Button
        type="button"
        variant="outline"
        onClick={handleOpen}
      >
        <Pencil />
        {text.button}
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : handleOpen())}>
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
                <Label htmlFor="edit-plan-name">{text.name}</Label>
                <Input
                  id="edit-plan-name"
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  placeholder={text.namePlaceholder}
                  maxLength={PLAN_NAME_MAX_LENGTH}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-plan-description">{text.description}</Label>
                <Textarea
                  id="edit-plan-description"
                  value={formData.description}
                  onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  className="min-h-24"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-plan-start-date">{text.startDate}</Label>
                  <LocalizedDateInput
                    id="edit-plan-start-date"
                    locale={locale}
                    value={formData.startDate}
                    onChange={(event) => setFormData((current) => ({ ...current, startDate: event.target.value }))}
                    className={dateInputClassName}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-plan-end-date">{text.endDate}</Label>
                  <LocalizedDateInput
                    id="edit-plan-end-date"
                    locale={locale}
                    value={formData.endDate}
                    onChange={(event) => setFormData((current) => ({ ...current, endDate: event.target.value }))}
                    className={dateInputClassName}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t bg-muted/35 px-6 py-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                {text.cancel}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : null}
                {isPending ? text.saving : text.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertPopup message={errorMessage} onClose={() => setErrorMessage("")} autoCloseMs={5000} />
    </>
  );
}
