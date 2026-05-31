"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import CreateIssueModal, {
  type CreateIssueIteration,
  type CreateIssuePlan,
  type CreateIssueUser,
} from "./CreateIssueModal";
import { getTranslations, Locale } from "@/lib/i18n";

type CreateIssueButtonProps = {
  users?: CreateIssueUser[];
  plans?: CreateIssuePlan[];
  iterations?: CreateIssueIteration[];
  locale: Locale;
  currentUserId?: string;
  canManagePlans?: boolean;
  defaultPlanId?: string;
  defaultIterationId?: string;
  defaultDueDate?: string;
};

export default function CreateIssueButton({
  users = [],
  plans = [],
  iterations = [],
  locale,
  currentUserId,
  canManagePlans = false,
  defaultPlanId,
  defaultIterationId,
  defaultDueDate,
}: CreateIssueButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const translations = getTranslations(locale);

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setModalKey((value) => value + 1);
          setIsModalOpen(true);
        }}
        title={translations.createIssue.createNewIssue}
      >
        <Plus className="size-4" />
        {translations.createIssue.create}
      </Button>
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
        defaultPlanId={defaultPlanId}
        defaultIterationId={defaultIterationId}
        defaultDueDate={defaultDueDate}
      />
    </>
  );
}
