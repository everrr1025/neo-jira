"use client";

import { useState } from "react";
import CreateIssueModal, { type CreateIssueIteration, type CreateIssueUser } from "./CreateIssueModal";
import { getTranslations, Locale } from "@/lib/i18n";

type CreateIssueButtonProps = {
  users?: CreateIssueUser[];
  iterations?: CreateIssueIteration[];
  locale: Locale;
  defaultIterationId?: string;
  defaultDueDate?: string;
};

export default function CreateIssueButton({
  users = [],
  iterations = [],
  locale,
  defaultIterationId,
  defaultDueDate,
}: CreateIssueButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const translations = getTranslations(locale);

  return (
    <>
      <button 
        onClick={() => {
          setModalKey((value) => value + 1);
          setIsModalOpen(true);
        }}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm whitespace-nowrap flex items-center justify-center gap-1"
        title={translations.createIssue.createNewIssue}
      >
        <span className="text-lg leading-none mb-[2px]">+</span> {translations.createIssue.create}
      </button>
      <CreateIssueModal 
        key={modalKey}
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        users={users} 
        iterations={iterations}
        locale={locale}
        defaultIterationId={defaultIterationId}
        defaultDueDate={defaultDueDate}
      />
    </>
  );
}
