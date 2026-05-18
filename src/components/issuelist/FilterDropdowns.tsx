"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export type FilterOption = {
  value: string;
  label: string;
};

export function MultiFilter({
  label,
  options,
  selectedValues,
  onToggle,
  onClear,
  clearText,
}: {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  clearText: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);
  const buttonText =
    selectedLabels.length === 0
      ? label
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${label} (${selectedLabels.length})`;

  return (
    <details ref={detailsRef} className="relative">
      <summary className="inline-flex h-9 cursor-pointer select-none list-none items-center gap-2 rounded-md border bg-background px-3 text-sm text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
        <span className="truncate max-w-40">{buttonText}</span>
        {selectedValues.length > 1 ? <Badge variant="secondary">{selectedValues.length}</Badge> : null}
        <ChevronDown size={14} className="text-muted-foreground" />
      </summary>
      <div className="absolute z-30 mt-2 w-56 rounded-lg border bg-popover p-2 text-popover-foreground shadow-xl space-y-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <input
              type="checkbox"
              checked={selectedValues.includes(option.value)}
              onChange={() => onToggle(option.value)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
            />
            <span>{option.label}</span>
          </label>
        ))}
        {selectedValues.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="mt-1 w-full rounded-md border-t px-2 py-1.5 pt-2 text-left text-sm font-medium text-primary hover:bg-accent"
          >
            {clearText}
          </button>
        )}
      </div>
    </details>
  );
}

export function SingleFilter({
  value,
  options,
  onChange,
  renderSummary,
}: {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  renderSummary: (label: string) => ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  return (
    <details ref={detailsRef} className="relative">
      <summary className="list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden">
        {renderSummary(selectedOption?.label || "")}
      </summary>
      <div className="absolute z-30 mt-2 w-56 rounded-lg border bg-popover p-2 text-popover-foreground shadow-xl space-y-1">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              option.value === value ? "bg-accent font-medium text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </details>
  );
}

export function InlineSelect({
  value,
  options,
  onChange,
  renderSummary,
  className = "relative",
}: {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  renderSummary: (label: string) => ReactNode;
  className?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    openingUpward: boolean;
  }>({ left: 0, width: 0, openingUpward: false });

  const updateMenuPosition = useCallback(() => {
    const rect = summaryRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openingUpward = spaceBelow < 280;

    if (openingUpward) {
      setMenuPosition({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        width: rect.width,
        openingUpward: true,
      });
    } else {
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        openingUpward: false,
      });
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false;
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
    setIsOpen(false);
  };

  return (
    <details
      ref={detailsRef}
      className={className}
      onToggle={(event) => {
        const open = event.currentTarget.open;
        setIsOpen(open);
        if (open) updateMenuPosition();
      }}
    >
      <summary ref={summaryRef} className="list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden">
        {renderSummary(selectedOption?.label || "")}
      </summary>
      {isOpen && (
        <div
          className="fixed z-50 flex max-w-56 flex-col gap-1 rounded-lg border bg-popover p-2 text-popover-foreground shadow-xl"
          style={{
            top: menuPosition.top,
            bottom: menuPosition.bottom,
            left: menuPosition.left,
            minWidth: menuPosition.width,
          }}
        >
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                option.value === value ? "bg-accent font-medium text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <span className="block truncate">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </details>
  );
}

export function ColumnVisibilityMenu<ColumnId extends string>({
  buttonLabel,
  resetLabel,
  columns,
  visibleColumnIds,
  onToggle,
  onReset,
}: {
  buttonLabel: string;
  resetLabel: string;
  columns: { id: ColumnId; label: string; width: number }[];
  visibleColumnIds: ColumnId[];
  onToggle: (columnId: ColumnId) => void;
  onReset: () => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const visibleCount = visibleColumnIds.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <details ref={detailsRef} className="relative">
      <summary className="inline-flex h-9 cursor-pointer select-none list-none items-center gap-2 rounded-md border bg-background px-3 text-sm text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
        <span>{buttonLabel}</span>
        <ChevronDown size={14} className="text-muted-foreground" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border bg-popover p-2 text-popover-foreground shadow-xl space-y-1">
        {columns.map((column) => {
          const isChecked = visibleColumnIds.includes(column.id);
          const isDisabled = isChecked && visibleCount === 1;

          return (
            <label
              key={column.id}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                isDisabled ? "cursor-not-allowed text-muted-foreground/60" : "cursor-pointer hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isDisabled}
                onChange={() => onToggle(column.id)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              <span>{column.label}</span>
            </label>
          );
        })}
        <button
          type="button"
          onClick={onReset}
          className="mt-1 w-full rounded-md border-t px-2 py-1.5 pt-2 text-left text-sm font-medium text-primary hover:bg-accent"
        >
          {resetLabel}
        </button>
      </div>
    </details>
  );
}
