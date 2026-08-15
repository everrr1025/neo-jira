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
import ShadcnDatePicker from "./ShadcnDatePicker";

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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
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

export default function EditPlanButton({ plan, locale, open, onOpenChange, showTrigger = true }: EditPlanButtonProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const isOpen = open ?? internalIsOpen;
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

  const setIsOpen = (nextOpen: boolean) => {
    if (open === undefined) setInternalIsOpen(nextOpen);
    onOpenChange?.(nextOpen);
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
      {showTrigger ? (
        <Button
          type="button"
          variant="outline"
          onClick={handleOpen}
        >
          <Pencil />
          {text.button}
        </Button>
      ) : null}

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
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="edit-plan-name">{text.name}</Label>
                  <span id="edit-plan-name-limit" className="text-xs text-muted-foreground">
                    {locale === "zh" ? `最多 ${PLAN_NAME_MAX_LENGTH} 个字符` : `${PLAN_NAME_MAX_LENGTH} characters maximum`} · {formData.name.length}/{PLAN_NAME_MAX_LENGTH}
                  </span>
                </div>
                <Input
                  id="edit-plan-name"
                  aria-describedby="edit-plan-name-limit"
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
                <ShadcnDatePicker
                  id="edit-plan-start-date"
                  label={text.startDate}
                  locale={locale}
                  value={formData.startDate}
                  onChange={(startDate) => setFormData((current) => ({ ...current, startDate }))}
                />

                <ShadcnDatePicker
                  id="edit-plan-end-date"
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
