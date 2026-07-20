"use client";

import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type Locale } from "@/lib/i18n";

type ShadcnDatePickerProps = {
  id: string;
  label: string;
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  labelClassName?: string;
  contentAlign?: "start" | "center" | "end";
  contentSide?: "top" | "right" | "bottom" | "left";
};

const localeMap = {
  en: enUS,
  zh: zhCN,
} as const;

const copyMap = {
  en: {
    placeholder: "Pick a date",
    format: "MMM d, yyyy",
    clear: "Clear",
  },
  zh: {
    placeholder: "选择日期",
    format: "yyyy年M月d日",
    clear: "清除",
  },
} as const;

function parseDateInputValue(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export default function ShadcnDatePicker({
  id,
  label,
  locale,
  value,
  onChange,
  required = false,
  className = "flex flex-col gap-1.5",
  labelClassName,
  contentAlign = "start",
  contentSide = "bottom",
}: ShadcnDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = parseDateInputValue(value);
  const localeConfig = localeMap[locale];
  const copy = copyMap[locale];

  return (
    <div className={className}>
      <Label htmlFor={id} className={labelClassName}>{label}</Label>
      <input
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={() => undefined}
        required={required}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start px-3 text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="text-muted-foreground" />
            <span className="min-w-0 truncate">
              {selectedDate ? format(selectedDate, copy.format, { locale: localeConfig }) : copy.placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={contentAlign} side={contentSide}>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (!date) return;
              onChange(formatDateInputValue(date));
              setIsOpen(false);
            }}
            locale={localeConfig}
            captionLayout="dropdown"
            formatters={{
              formatMonthDropdown: (date) => format(date, "LLLL", { locale: localeConfig }),
            }}
          />
          {!required && value ? (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
              >
                <X />
                {copy.clear}
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
