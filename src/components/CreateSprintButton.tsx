"use client";

import { useState, useTransition } from "react";
import { createSprint } from "@/app/actions/sprints";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTranslations, Locale } from "@/lib/i18n";
import { ITERATION_NAME_MAX_LENGTH } from "@/lib/validation";
import AlertPopup from "./AlertPopup";
import ShadcnDatePicker from "./ShadcnDatePicker";

type ProjectOption = { id: string; name: string; key: string };

function getDefaultEndDate(startDate: string) {
  if (!startDate) return "";
  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 13);
  return date.toISOString().slice(0, 10);
}

export function CreateSprintButton({ projects, locale }: { projects: ProjectOption[]; locale: Locale }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [isEndDateManuallyEdited, setIsEndDateManuallyEdited] = useState(false);
  const translations = getTranslations(locale);
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    projectId: projects[0]?.id || "",
  });

  const handleClose = () => {
    if (isPending) return;
    setIsOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await createSprint(formData);
      if (res.success) {
        setIsOpen(false);
        setIsEndDateManuallyEdited(false);
        setFormData({ name: "", startDate: "", endDate: "", projectId: projects[0]?.id || "" });
      } else {
        setError(res.error || translations.createSprint.failedCreateSprint);
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <Plus /> {translations.createSprint.createSprint}
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : setIsOpen(true))}>
        <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>{translations.createSprint.modalTitle}</DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleClose}
                disabled={isPending}
                aria-label={translations.createSprint.cancel}
              >
                <X className="size-4" />
              </Button>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6 p-6">
              <div className="flex flex-col gap-1.5">
                <Label>{translations.createSprint.project}</Label>
                <Select
                  value={formData.projectId}
                  onValueChange={(projectId) => setFormData((prev) => ({ ...prev, projectId }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} ({project.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sprint-name">{translations.createSprint.sprintName}</Label>
                <Input
                  id="sprint-name"
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  maxLength={ITERATION_NAME_MAX_LENGTH}
                  placeholder={translations.createSprint.sprintNamePlaceholder}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <ShadcnDatePicker
                  id="sprint-start-date"
                  label={translations.createSprint.startDate}
                  required
                  locale={locale}
                  value={formData.startDate}
                  onChange={(startDate) => {
                    setFormData((prev) => ({
                      ...prev,
                      startDate,
                      endDate: isEndDateManuallyEdited ? prev.endDate : getDefaultEndDate(startDate),
                    }));
                  }}
                />
                <ShadcnDatePicker
                  id="sprint-end-date"
                  label={translations.createSprint.endDate}
                  required
                  locale={locale}
                  value={formData.endDate}
                  onChange={(endDate) => {
                    setIsEndDateManuallyEdited(true);
                    setFormData((prev) => ({ ...prev, endDate }));
                  }}
                />
              </div>
            </div>

            <DialogFooter className="border-t bg-muted/35 px-6 py-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                {translations.createSprint.cancel}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : null}
                {isPending ? translations.createSprint.creating : translations.createSprint.createSprint}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertPopup message={error} onClose={() => setError("")} autoCloseMs={5000} />
    </>
  );
}
