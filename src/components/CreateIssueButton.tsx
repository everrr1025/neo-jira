"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import CreateIssueModal, {
  type CreateIssueIteration,
  type CreateIssueParentIssue,
  type CreateIssuePlan,
  type CreateIssueUser,
} from "./CreateIssueModal";
import { getTranslations, Locale } from "@/lib/i18n";

export type CreateIssueButtonProps = {
  users?: CreateIssueUser[];
  plans?: CreateIssuePlan[];
  iterations?: CreateIssueIteration[];
  locale: Locale;
  currentUserId?: string;
  canManagePlans?: boolean;
  parentIssues?: CreateIssueParentIssue[];
  defaultPlanId?: string;
  defaultIterationId?: string;
  defaultDueDate?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  buttonLabel?: string;
};

export default function CreateIssueButton({
  users = [],
  plans = [],
  iterations = [],
  locale,
  currentUserId,
  canManagePlans = false,
  parentIssues = [],
  defaultPlanId,
  defaultIterationId,
  defaultDueDate,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  buttonLabel,
}: CreateIssueButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const translations = getTranslations(locale);
  const isModalOpen = controlledOpen ?? internalOpen;
  const setIsModalOpen = (open: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(open);
    onOpenChange?.(open);
  };

  return (
    <>
      {showTrigger ? (
        <Button
          type="button"
          onClick={() => {
            setModalKey((value) => value + 1);
            setIsModalOpen(true);
          }}
          title={translations.createIssue.createNewIssue}
        >
          <Plus className="size-4" />
          {buttonLabel ?? translations.createIssue.create}
        </Button>
      ) : null}
      <CreateIssueModal 
        key={modalKey}
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        users={users} 
        plans={plans}
        iterations={iterations}
        locale={locale}
        currentUserId={currentUserId}
        canManagePlans={canManagePlans}
        parentIssues={parentIssues}
        defaultPlanId={defaultPlanId}
        defaultIterationId={defaultIterationId}
        defaultDueDate={defaultDueDate}
      />
    </>
  );
}
