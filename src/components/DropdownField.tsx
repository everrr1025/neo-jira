"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

type DropdownOption = {
  value: string;
  label: string;
};

type DropdownFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  className?: string;
  hideLabel?: boolean;
};

export function DropdownField({ id, label, value, onChange, options, className = "", hideLabel = false }: DropdownFieldProps) {
  const selectedOption = options.find((item) => item.value === value);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [openUpward, setOpenUpward] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  }>({ left: 0, width: 0 });

  const updateMenuPosition = useCallback(() => {
    const rect = summaryRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceBelow = window.innerHeight - rect.bottom;
    const nextOpenUpward = spaceBelow < 280;
    setOpenUpward(nextOpenUpward);
    setMenuPosition(
      nextOpenUpward
        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width }
        : { top: rect.bottom + 4, left: rect.left, width: rect.width }
    );
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

  const handleToggle = (e: React.ToggleEvent<HTMLDetailsElement>) => {
    const open = e.currentTarget.open;
    setIsOpen(open);
    if (open) updateMenuPosition();
  };

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
    setIsOpen(false);
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-sm font-medium text-slate-700"}>
        {label}
      </label>
      <details
        ref={detailsRef}
        className="relative rounded-md border border-slate-200 bg-white"
        onToggle={handleToggle}
      >
        <summary
          id={id}
          ref={summaryRef}
          className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm text-slate-700 [&::-webkit-details-marker]:hidden"
        >
          <span className={`min-w-0 flex-1 truncate ${selectedOption ? "text-slate-700" : "text-slate-400"}`}>
            {selectedOption?.label || ""}
          </span>
          <ChevronDown size={14} className="shrink-0 text-slate-500" />
        </summary>
        {isOpen ? (
          <div
            className="fixed z-[70] max-h-64 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg"
            style={{
              top: menuPosition.top,
              bottom: menuPosition.bottom,
              left: menuPosition.left,
              width: menuPosition.width,
            }}
            data-open-upward={openUpward}
          >
            {options.map((option) => (
              <button
                type="button"
                key={option.value || "__empty"}
                onClick={() => handleSelect(option.value)}
                className={`flex w-full items-start justify-between gap-3 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                  option.value === value ? "bg-white font-medium text-blue-700" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="min-w-0 break-words whitespace-normal">{option.label}</span>
                {option.value === value && <Check size={14} className="shrink-0 text-blue-600" />}
              </button>
            ))}
          </div>
        ) : null}
      </details>
    </div>
  );
}
