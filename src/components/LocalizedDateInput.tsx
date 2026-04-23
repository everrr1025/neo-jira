"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { enUS, zhCN } from "date-fns/locale";

import { type Locale } from "@/lib/i18n";

type ChangeLikeEvent = {
  target: { value: string };
};

type LocalizedDateInputProps = {
  locale: Locale;
  value: string;
  onChange?: (event: ChangeLikeEvent) => void;
  id?: string;
  name?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  autoComplete?: string;
  "aria-label"?: string;
};

const localeMap = {
  en: enUS,
  zh: zhCN,
} as const;

const copyMap = {
  en: {
    empty: "Select date",
    today: "Today",
    clear: "Clear",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    weekdays: "EEEEE",
    month: "MMMM yyyy",
    value: "MMM d, yyyy",
  },
  zh: {
    empty: "选择日期",
    today: "今天",
    clear: "清除",
    previousMonth: "上个月",
    nextMonth: "下个月",
    weekdays: "EEEEE",
    month: "yyyy年M月",
    value: "yyyy年M月d日",
  },
} as const;

function parseDateValue(value?: string) {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function isDateDisabled(date: Date, minDate: Date | null, maxDate: Date | null) {
  if (minDate && isBefore(date, minDate)) return true;
  if (maxDate && isAfter(date, maxDate)) return true;
  return false;
}

type PopoverPosition = {
  left: number;
  top: number;
  width: number;
};

const POPOVER_WIDTH = 304;
const POPOVER_HEIGHT = 332;
const VIEWPORT_MARGIN = 12;
const POPOVER_GAP = 8;

function getPopoverPosition(element: HTMLDivElement): PopoverPosition {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, rect.left),
    Math.max(VIEWPORT_MARGIN, viewportWidth - POPOVER_WIDTH - VIEWPORT_MARGIN)
  );
  const shouldOpenAbove =
    viewportHeight - rect.bottom < POPOVER_HEIGHT + POPOVER_GAP &&
    rect.top > POPOVER_HEIGHT + POPOVER_GAP;
  const top = shouldOpenAbove
    ? Math.max(VIEWPORT_MARGIN, rect.top - POPOVER_HEIGHT - POPOVER_GAP)
    : Math.min(viewportHeight - POPOVER_HEIGHT - VIEWPORT_MARGIN, rect.bottom + POPOVER_GAP);

  return {
    left,
    top,
    width: Math.max(rect.width, POPOVER_WIDTH),
  };
}

export default function LocalizedDateInput({
  locale,
  value,
  onChange,
  id,
  name,
  className = "",
  disabled = false,
  required = false,
  min,
  max,
  "aria-label": ariaLabel,
}: LocalizedDateInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const localeConfig = localeMap[locale];
  const copy = copyMap[locale];
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const minDate = useMemo(() => parseDateValue(min), [min]);
  const maxDate = useMemo(() => parseDateValue(max), [max]);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? new Date());
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedTrigger = wrapperRef.current?.contains(target);
      const clickedPopover = popoverRef.current?.contains(target);

      if (!clickedTrigger && !clickedPopover) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const monthStart = startOfMonth(visibleMonth);
  const calendarStart = startOfWeek(monthStart, { locale: localeConfig });
  const calendarEnd = endOfWeek(endOfMonth(visibleMonth), { locale: localeConfig });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekdayLabels = eachDayOfInterval({
    start: startOfWeek(new Date(), { locale: localeConfig }),
    end: endOfWeek(new Date(), { locale: localeConfig }),
  }).map((date) => format(date, copy.weekdays, { locale: localeConfig }));

  const displayValue = selectedDate ? format(selectedDate, copy.value, { locale: localeConfig }) : copy.empty;

  const emitChange = (nextValue: string) => {
    onChange?.({ target: { value: nextValue } });
  };

  const handleToggleOpen = () => {
    if (disabled) return;
    if (!isOpen && wrapperRef.current) {
      setPopoverPosition(getPopoverPosition(wrapperRef.current));
    }
    setVisibleMonth(selectedDate ?? new Date());
    setIsOpen((current) => !current);
  };

  const handleSelectDate = (date: Date) => {
    if (isDateDisabled(date, minDate, maxDate)) return;
    emitChange(format(date, "yyyy-MM-dd"));
    setVisibleMonth(date);
    setIsOpen(false);
  };

  const handleClear = () => {
    emitChange("");
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    if (isDateDisabled(today, minDate, maxDate)) return;
    handleSelectDate(today);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={value}
        onChange={() => undefined}
        required={required}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      <button
        id={inputId}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={handleToggleOpen}
        className={`inline-flex w-full items-center justify-between gap-2 text-left transition-colors disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${className}`}
      >
        <span className={selectedDate ? "text-slate-700" : "text-slate-400"}>{displayValue}</span>
        <CalendarDays size={16} className="shrink-0 text-slate-400" />
      </button>

      {isOpen && popoverPosition
        ? createPortal(
            <div
              ref={popoverRef}
              className="z-[90] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl"
              style={{
                left: popoverPosition.left,
                top: popoverPosition.top,
                width: popoverPosition.width,
                position: "fixed",
              }}
            >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => subMonths(current, 1))}
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label={copy.previousMonth}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-sm font-semibold text-slate-800">
              {format(monthStart, copy.month, { locale: localeConfig })}
            </div>
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label={copy.nextMonth}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {weekdayLabels.map((label, index) => (
              <div key={`${label}-${index}`} className="py-1 text-center text-xs font-semibold text-slate-400">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date) => {
              const outsideMonth = !isSameMonth(date, monthStart);
              const selected = selectedDate ? isSameDay(date, selectedDate) : false;
              const today = isToday(date);
              const dayDisabled = isDateDisabled(date, minDate, maxDate);

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => handleSelectDate(date)}
                  disabled={dayDisabled}
                  className={[
                    "flex h-9 items-center justify-center rounded-md text-sm transition-colors",
                    selected ? "bg-blue-600 font-semibold text-white hover:bg-blue-600" : "",
                    !selected && outsideMonth ? "text-slate-300" : "",
                    !selected && !outsideMonth ? "text-slate-700 hover:bg-slate-100" : "",
                    !selected && today ? "font-semibold text-blue-700" : "",
                    dayDisabled ? "cursor-not-allowed text-slate-300 hover:bg-transparent" : "",
                  ].join(" ")}
                >
                  {format(date, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={handleToday}
              disabled={disabled}
              className="rounded-md px-2 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {copy.today}
            </button>

            {!required ? (
              <button
                type="button"
                onClick={handleClear}
                disabled={!value}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                <X size={14} />
                {copy.clear}
              </button>
            ) : (
              <span className="h-8" />
            )}
          </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
