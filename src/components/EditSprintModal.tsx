"use client";

import { useState, useTransition } from "react";
import { updateSprint } from "@/app/actions/sprints";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTranslations, Locale } from "@/lib/i18n";
import { ITERATION_NAME_MAX_LENGTH } from "@/lib/validation";
import AlertPopup from "./AlertPopup";
import ShadcnDatePicker from "./ShadcnDatePicker";

type SprintData = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

export function EditSprintModal({
  isOpen,
  onClose,
  sprint,
  locale,
}: {
  isOpen: boolean;
  onClose: () => void;
  sprint: SprintData;
  locale: Locale;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const translations = getTranslations(locale);
  const [formData, setFormData] = useState({
    name: sprint.name,
    startDate: sprint.startDate.split("T")[0],
    endDate: sprint.endDate.split("T")[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await updateSprint(sprint.id, formData);
      if (res.success) {
        onClose();
      } else {
        setError(res.error || translations.createSprint.failedCreateSprint);
      }
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => (!open && !isPending ? onClose() : null)}>
        <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{locale === "zh" ? "编辑迭代" : "Edit iteration"}</DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                disabled={isPending}
                aria-label={translations.createIssue.cancel}
              >
                <X className="size-4" />
              </Button>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-5 p-6">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="edit-sprint-name">{translations.createSprint.sprintName}</Label>
                  <span id="edit-sprint-name-limit" className="text-xs text-muted-foreground">
                    {locale === "zh" ? `最多 ${ITERATION_NAME_MAX_LENGTH} 个字符` : `${ITERATION_NAME_MAX_LENGTH} characters maximum`} · {formData.name.length}/{ITERATION_NAME_MAX_LENGTH}
                  </span>
                </div>
                <Input
                  id="edit-sprint-name"
                  aria-describedby="edit-sprint-name-limit"
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  maxLength={ITERATION_NAME_MAX_LENGTH}
                  placeholder={translations.createSprint.sprintNamePlaceholder}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ShadcnDatePicker
                  id="edit-sprint-start-date"
                  label={translations.createSprint.startDate}
                  required
                  locale={locale}
                  value={formData.startDate}
                  contentSide="top"
                  onChange={(startDate) => setFormData((prev) => ({ ...prev, startDate }))}
                />
                <ShadcnDatePicker
                  id="edit-sprint-end-date"
                  label={translations.createSprint.endDate}
                  required
                  locale={locale}
                  value={formData.endDate}
                  contentSide="top"
                  onChange={(endDate) => setFormData((prev) => ({ ...prev, endDate }))}
                />
              </div>
            </div>

            <DialogFooter className="border-t bg-muted/35 px-6 py-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                {translations.createIssue.cancel}
              </Button>
              <Button disabled={isPending} type="submit">
                {isPending ? <Loader2 className="animate-spin" /> : null}
                {locale === "zh" ? "保存" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertPopup message={error} onClose={() => setError("")} autoCloseMs={5000} />
    </>
  );
}
