"use client";

import { useState } from "react";
import CreateIssueModal from "./CreateIssueModal";

type CreateIssueButtonProps = {
  users?: any[];
  iterations?: any[];
};

export default function CreateIssueButton({ users = [], iterations = [] }: CreateIssueButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsModalOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm whitespace-nowrap flex items-center justify-center gap-1"
        title="Create new issue"
      >
        <span className="text-lg leading-none mb-[2px]">+</span> Create
      </button>
      <CreateIssueModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        users={users} 
        iterations={iterations} 
      />
    </>
  );
}
