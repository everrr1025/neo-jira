"use client";

import { useState } from "react";
import { Check, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getIssueTypeLabel, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getWorkflowStatusName, type WorkflowStatusRecord } from "@/lib/workflows";
import IssueRelationRow from "./IssueRelationRow";

export type ParentIssuePickerOption = {
  id: string;
  key: string;
  title: string;
  type: string;
  status?: string;
};

type ParentIssuePickerProps = {
  value: string;
  options: ParentIssuePickerOption[];
  locale: Locale;
  disabled?: boolean;
  disabledLabel?: string;
  label?: string;
  labelClassName?: string;
  emptyLabel?: string;
  searchPlaceholder?: string;
  noResultsLabel?: string;
  workflowStatuses?: WorkflowStatusRecord[];
  onChange: (value: string) => void;
};

export default function ParentIssuePicker({
  value,
  options,
  locale,
  disabled = false,
  disabledLabel,
  label,
  labelClassName,
  emptyLabel,
  searchPlaceholder,
  noResultsLabel,
  workflowStatuses = [],
  onChange,
}: ParentIssuePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedIssue = options.find((issue) => issue.id === value);
  const parentLabel = label || (locale === "zh" ? "父级问题" : "Parent issue");
  const emptyValueLabel = emptyLabel || (locale === "zh" ? "不关联父级" : "No parent");
  const searchInputPlaceholder = searchPlaceholder || (locale === "zh" ? "搜索问题" : "Search issues");
  const emptyResultsLabel = noResultsLabel || (locale === "zh" ? "没有匹配的问题" : "No matching issues");
  const linkLabel = locale === "zh" ? "关联" : "Link";
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((issue) => {
        const typeLabel = getIssueTypeLabel(issue.type, locale);
        return `${issue.key} ${issue.title} ${typeLabel} ${issue.type}`.toLowerCase().includes(normalizedQuery);
      })
    : options;

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (disabled) return;
        setIsOpen(open);
        if (!open) setSearchQuery("");
      }}
    >
      <PopoverAnchor asChild>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label className={cn("text-lg font-semibold text-foreground", labelClassName)}>{parentLabel}</Label>
            <PopoverTrigger asChild>
              <Button type="button" variant="link" size="sm" disabled={disabled} className="h-auto px-0">
                {disabled ? disabledLabel || linkLabel : linkLabel}
              </Button>
            </PopoverTrigger>
          </div>
          {selectedIssue ? (
            selectedIssue.status ? (
              <IssueRelationRow
                issue={{ ...selectedIssue, status: selectedIssue.status }}
                locale={locale}
                workflowStatuses={workflowStatuses}
                className="rounded-lg border bg-card px-4"
              />
            ) : (
              <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-card px-4 py-2">
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">{selectedIssue.key}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{selectedIssue.title}</span>
                <span className="shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                  {getIssueTypeLabel(selectedIssue.type, locale)}
                </span>
              </div>
            )
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/35 px-4 py-6 text-sm text-muted-foreground">
              {emptyValueLabel}
            </div>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="end">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={searchInputPlaceholder}
            className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent"
            onClick={() => {
              onChange("");
              setIsOpen(false);
              setSearchQuery("");
            }}
          >
            <Check className={cn("size-4", value ? "opacity-0" : "opacity-100")} />
            <span className="truncate text-muted-foreground">{emptyValueLabel}</span>
          </button>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((issue) => (
              <button
                key={issue.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent"
                onClick={() => {
                  onChange(issue.id);
                  setIsOpen(false);
                  setSearchQuery("");
                }}
              >
                <Check className={cn("size-4 shrink-0", value === issue.id ? "opacity-100" : "opacity-0")} />
                <span className="min-w-0 flex-1 truncate">
                  {issue.key} {issue.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{getIssueTypeLabel(issue.type, locale)}</span>
                {issue.status ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {workflowStatuses.length > 0
                      ? getWorkflowStatusName(issue.status, workflowStatuses, locale)
                      : issue.status}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyResultsLabel}</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
