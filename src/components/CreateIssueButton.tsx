"use client";

import { useState } from "react";
import CreateIssueModal from "./CreateIssueModal";
import { getTranslations, Locale } from "@/lib/i18n";

type CreateIssueButtonProps = {
  users?: any[];
  iterations?: any[];
  locale: Locale;
};

export default function CreateIssueButton({ users = [], iterations = [], locale }: CreateIssueButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const translations = getTranslations(locale);

  return (
    <>
      <button 
        onClick={() => setIsModalOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm whitespace-nowrap flex items-center justify-center gap-1"
        title={translations.createIssue.createNewIssue}
      >
        <span className="text-lg leading-none mb-[2px]">+</span> {translations.createIssue.create}
      </button>
      <CreateIssueModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        users={users} 
        iterations={iterations}
        locale={locale}
      />
    </>
  );
}
