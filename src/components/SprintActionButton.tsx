"use client";

import { ReactNode, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Loader2, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { completeSprint, deleteSprint, reopenSprint, startSprint } from "@/app/actions/sprints";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTranslations, Locale, localeDateMap } from "@/lib/i18n";
import AlertPopup from "./AlertPopup";
import { EditSprintModal } from "./EditSprintModal";

type PlannedSprintOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  recommended?: boolean;
};

type SprintData = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type SprintActionButtonProps = {
  sprintId: string;
  status: string;
  locale: Locale;
  plannedSprints: PlannedSprintOption[];
  unfinishedIssueCount: number;
  sprintData: SprintData;
  children?: ReactNode;
};

export function SprintActionButton({
  sprintId,
  status,
  locale,
  plannedSprints,
  unfinishedIssueCount,
  sprintData,
  children,
}: SprintActionButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<"BACKLOG" | "SPRINT">("BACKLOG");
  const [targetSprintId, setTargetSprintId] = useState("");
  const [error, setError] = useState("");
  const translations = getTranslations(locale);
  const text = translations.sprintAction;

  const recommendedSprint = useMemo(
    () => plannedSprints.find((sprint) => sprint.recommended) || null,
    [plannedSprints]
  );

  const openCompleteDialog = () => {
    setIsMenuOpen(false);
    setError("");
    if (unfinishedIssueCount === 0) {
      completeWithTarget("BACKLOG");
      return;
    }

    setMoveTarget(recommendedSprint ? "SPRINT" : "BACKLOG");
    setTargetSprintId(recommendedSprint?.id || plannedSprints[0]?.id || "");
    setIsCompleteOpen(true);
  };

  const runAction = (action: () => Promise<{ success: boolean; error?: string }>) => {
    setIsMenuOpen(false);
    setError("");
    startTransition(async () => {
      const res = await action();
      if (!res.success) {
        setError(res.error || text.actionFailed);
      }
    });
  };

  const completeWithTarget = (nextMoveTarget = moveTarget) => {
    const selectedTargetSprintId = nextMoveTarget === "SPRINT" ? targetSprintId : undefined;
    runAction(() =>
      completeSprint(sprintId, {
        moveUnfinishedTo: nextMoveTarget,
        targetSprintId: selectedTargetSprintId,
      })
    );
    setIsCompleteOpen(false);
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsMenuOpen(false);

    setError("");
    setIsDeleting(true);
    try {
      const res = await deleteSprint(sprintId);
      if (!res.success) {
        setError(res.error || text.deleteFailed);
        setIsDeleting(false);
        return;
      }
      setIsDeleteOpen(false);
      window.location.assign("/iterations");
    } catch (err) {
      console.error(err);
      setError(text.deleteFailed);
      setIsDeleting(false);
    }
  };

  const formatDate = (dateValue: string) => new Date(dateValue).toLocaleDateString(localeDateMap[locale]);

  return (
    <>
      <div className="relative flex items-center gap-2">
        {status === "PLANNED" && (
          <Button
            type="button"
            disabled={isPending}
            onClick={() => runAction(() => startSprint(sprintId, locale))}
          >
            {isPending ? <Loader2 className="animate-spin" /> : null}
            {text.startSprint}
          </Button>
        )}

        {status === "ACTIVE" && (
          <Button
            type="button"
            disabled={isPending}
            onClick={openCompleteDialog}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {isPending ? <Loader2 className="animate-spin" /> : null}
            {text.completeSprint}
          </Button>
        )}

        {children}

        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" disabled={isPending || isDeleting} title={text.moreActions}>
              {isDeleting ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => {
                setIsMenuOpen(false);
                setIsEditOpen(true);
              }}
            >
              <Pencil />
              {locale === "zh" ? "编辑" : "Edit Sprint"}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                setIsMenuOpen(false);
                setIsDeleteOpen(true);
              }}
            >
              <Trash2 />
              {locale === "zh" ? "删除" : text.deleteSprint}
            </DropdownMenuItem>
            {status === "ACTIVE" && (
              <DropdownMenuItem onClick={() => runAction(() => reopenSprint(sprintId))}>
                <RotateCcw />
                {text.moveBackToPlanned}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isCompleteOpen} onOpenChange={(open) => (!open && !isPending ? setIsCompleteOpen(false) : null)}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{text.completeTitle}</DialogTitle>
            <p className="text-sm text-muted-foreground">{text.completeDescription}</p>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm font-medium text-foreground">
              {text.unfinishedCount}: {unfinishedIssueCount}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">{text.moveUnfinishedTo}</p>
              <Label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50">
                <input
                  type="radio"
                  name="move-target"
                  checked={moveTarget === "BACKLOG"}
                  onChange={() => setMoveTarget("BACKLOG")}
                  className="mt-1 h-4 w-4 border-input text-primary focus:ring-ring"
                />
                <span className="text-sm font-medium text-foreground">{text.moveToBacklog}</span>
              </Label>

              <Label
                className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                  plannedSprints.length > 0
                    ? "cursor-pointer hover:bg-muted/50"
                    : "cursor-not-allowed bg-muted/50 text-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="move-target"
                  checked={moveTarget === "SPRINT"}
                  onChange={() => plannedSprints.length > 0 && setMoveTarget("SPRINT")}
                  disabled={plannedSprints.length === 0}
                  className="mt-1 h-4 w-4 border-input text-primary focus:ring-ring"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground">{text.moveToSprint}</span>
                  {plannedSprints.length > 0 ? (
                    <Select
                      value={targetSprintId}
                      onValueChange={(value) => {
                        setTargetSprintId(value);
                        setMoveTarget("SPRINT");
                      }}
                    >
                      <SelectTrigger className="mt-2 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {plannedSprints.map((sprint) => (
                          <SelectItem key={sprint.id} value={sprint.id}>
                            {sprint.name} · {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                            {sprint.recommended ? ` · ${text.recommended}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">{text.noPlannedSprints}</p>
                  )}
                </div>
              </Label>
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/35 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setIsCompleteOpen(false)} disabled={isPending}>
              {text.cancel}
            </Button>
            <Button
              type="button"
              onClick={() => completeWithTarget()}
              disabled={isPending || (moveTarget === "SPRINT" && !targetSprintId)}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {isPending ? text.completing : text.confirmComplete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={(open) => (!open && !isDeleting ? setIsDeleteOpen(false) : null)}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-destructive/5 px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              {locale === "zh" ? "删除迭代" : text.deleteSprint}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <p className="text-sm font-medium text-foreground">
              {locale === "zh"
                ? "确定删除此迭代吗？操作不可撤销，删除迭代不会删除迭代内的 issue，只会取消关联。"
                : "Are you sure you want to delete this sprint? This cannot be undone. Issues will be kept and unlinked."}
            </p>
          </div>
          <DialogFooter className="border-t bg-muted/35 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>
              {locale === "zh" ? "取消" : "Cancel"}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="animate-spin" /> : null}
              {locale === "zh" ? "删除迭代" : text.deleteSprint}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditSprintModal 
        key={`${sprintData.id}-${isEditOpen ? "open" : "closed"}`}
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        sprint={sprintData} 
        locale={locale} 
      />

      <AlertPopup message={error} onClose={() => setError("")} autoCloseMs={5000} />
    </>
  );
}
