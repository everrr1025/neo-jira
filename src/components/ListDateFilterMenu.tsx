"use client";

import { useId, useState } from "react";
import { ListFilter } from "lucide-react";

import ShadcnDatePicker from "@/components/ShadcnDatePicker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Locale } from "@/lib/i18n";
import type { ListDateFilterWithBetween } from "@/lib/listDateFilter";

export default function ListDateFilterMenu({
  label,
  value,
  date,
  endDate = "",
  locale,
  labels,
  onChange,
}: {
  label: string;
  value: ListDateFilterWithBetween;
  date: string;
  endDate?: string;
  locale: Locale;
  labels: { all: string; equals: string; onOrAfter: string; onOrBefore: string; between?: string; startDate?: string; endDate?: string };
  onChange: (value: ListDateFilterWithBetween, date: string, endDate: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const datePickerId = useId();
  const options = [
    { value: "ALL" as const, label: labels.all },
    { value: "EQ" as const, label: labels.equals },
    { value: "GTE" as const, label: labels.onOrAfter },
    { value: "LTE" as const, label: labels.onOrBefore },
    ...(labels.between ? [{ value: "BETWEEN" as const, label: labels.between }] : []),
  ];
  const selectedLabel = options.find((option) => option.value === value)?.label || labels.all;
  const active = value !== "ALL";
  const summary = value === "BETWEEN"
    ? [selectedLabel, [date, endDate].filter(Boolean).join(" – ")].filter(Boolean).join(" ")
    : [selectedLabel, date].filter(Boolean).join(" ");

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={active ? "outline" : "ghost"}
          size={active ? "sm" : "icon-xs"}
          className={active
            ? "h-5 min-w-0 max-w-32 bg-background px-1.5 text-xs font-normal"
            : "text-muted-foreground"}
          aria-label={`${label}: ${summary}`}
          title={`${label}: ${summary}`}
        >
          {active ? <span className="truncate">{summary}</span> : <ListFilter />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 normal-case"
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('[data-slot="popover-content"]')) event.preventDefault();
        }}
      >
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(
          next as ListDateFilterWithBetween,
          next === "ALL" ? "" : date,
          next === "BETWEEN" ? endDate : "",
        )}>
          <DropdownMenuRadioItem value="ALL" onSelect={(event) => event.preventDefault()}>{labels.all}</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {options.slice(1).map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} onSelect={(event) => event.preventDefault()}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {active ? (
          <>
            <DropdownMenuSeparator />
            <div className="p-2" onKeyDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
              <ShadcnDatePicker
                id={datePickerId}
                label={value === "BETWEEN" ? labels.startDate || label : label}
                locale={locale}
                value={date}
                onChange={(nextDate) => onChange(value, nextDate, endDate)}
                className="block"
                labelClassName="sr-only"
              />
              {value === "BETWEEN" ? (
                <ShadcnDatePicker
                  id={`${datePickerId}-end`}
                  label={labels.endDate || label}
                  locale={locale}
                  value={endDate}
                  onChange={(nextEndDate) => onChange(value, date, nextEndDate)}
                  className="mt-2 block"
                  labelClassName="sr-only"
                />
              ) : null}
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
