"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getIssueTypeLabel, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ParentIssuePickerOption = {
  id: string;
  key: string;
  title: string;
  type: string;
};

type ParentIssuePickerProps = {
  value: string;
  options: ParentIssuePickerOption[];
  locale: Locale;
  disabled?: boolean;
  disabledLabel?: string;
  label?: string;
  emptyLabel?: string;
  searchPlaceholder?: string;
  noResultsLabel?: string;
  onChange: (value: string) => void;
};

export default function ParentIssuePicker({
  value,
  options,
  locale,
  disabled = false,
  disabledLabel,
  label,
  emptyLabel,
  searchPlaceholder,
  noResultsLabel,
  onChange,
}: ParentIssuePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedIssue = options.find((issue) => issue.id === value);
  const parentLabel = label || (locale === "zh" ? "父级问题" : "Parent issue");
  const emptyValueLabel = emptyLabel || (locale === "zh" ? "不关联父级" : "No parent");
  const disabledValueLabel = disabledLabel || emptyValueLabel;
  const searchInputPlaceholder = searchPlaceholder || (locale === "zh" ? "搜索问题" : "Search issues");
  const emptyResultsLabel = noResultsLabel || (locale === "zh" ? "没有匹配的问题" : "No matching issues");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((issue) => {
        const typeLabel = getIssueTypeLabel(issue.type, locale);
        return `${issue.key} ${issue.title} ${typeLabel} ${issue.type}`.toLowerCase().includes(normalizedQuery);
      })
    : options;

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{parentLabel}</Label>
      <Popover
        open={isOpen}
        onOpenChange={(open) => {
          if (disabled) return;
          setIsOpen(open);
          if (!open) setSearchQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("w-full justify-between px-3 text-left font-normal", !selectedIssue && "text-muted-foreground")}
          >
            <span className="min-w-0 truncate">
              {disabled ? disabledValueLabel : selectedIssue ? `${selectedIssue.key} ${selectedIssue.title}` : emptyValueLabel}
            </span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
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
                </button>
              ))
            ) : (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyResultsLabel}</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
