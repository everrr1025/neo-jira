"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Locale } from "@/lib/i18n";
import AddExistingIssuesButton, { type AddExistingIssuesButtonProps } from "./AddExistingIssuesButton";
import CreateIssueButton, { type CreateIssueButtonProps } from "./CreateIssueButton";

type PlanIssueActionButtonProps = {
  locale: Locale;
  createIssue: Omit<CreateIssueButtonProps, "open" | "onOpenChange" | "showTrigger" | "buttonLabel">;
  addExistingIssues: Omit<AddExistingIssuesButtonProps, "open" | "onOpenChange" | "showTrigger">;
};

export default function PlanIssueActionButton({
  locale,
  createIssue,
  addExistingIssues,
}: PlanIssueActionButtonProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [isAddExistingOpen, setIsAddExistingOpen] = useState(false);
  const [addExistingKey, setAddExistingKey] = useState(0);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button">
            <Plus />
            {locale === "zh" ? "问题" : "Issue"}
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onSelect={() => {
              setCreateKey((value) => value + 1);
              setIsCreateOpen(true);
            }}
          >
            {locale === "zh" ? "新建" : "New"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setAddExistingKey((value) => value + 1);
              setIsAddExistingOpen(true);
            }}
          >
            {locale === "zh" ? "添加已有" : "Add existing"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateIssueButton
        key={`create-${createKey}`}
        {...createIssue}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        showTrigger={false}
      />
      <AddExistingIssuesButton
        key={`add-existing-${addExistingKey}`}
        {...addExistingIssues}
        open={isAddExistingOpen}
        onOpenChange={setIsAddExistingOpen}
        showTrigger={false}
      />
    </>
  );
}
