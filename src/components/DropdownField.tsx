"use client";

import { useEffect, useRef } from "react";
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
};

export function DropdownField({ id, label, value, onChange, options, className = "" }: DropdownFieldProps) {
  const selectedOption = options.find((item) => item.value === value);
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

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <details ref={detailsRef} className="relative rounded-md border border-slate-200 bg-white">
        <summary
          id={id}
          className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm text-slate-700 [&::-webkit-details-marker]:hidden"
        >
          <span className={selectedOption ? "text-slate-700" : "text-slate-400"}>
            {selectedOption?.label || ""}
          </span>
          <ChevronDown size={14} className="text-slate-500" />
        </summary>
        <div className="absolute left-0 top-full z-40 mt-1 min-w-full w-max max-w-[280px] space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          {options.map((option) => (
            <button
              type="button"
              key={option.value || "__empty"}
              onClick={() => handleSelect(option.value)}
              className={`w-full rounded px-2 py-1.5 text-left text-sm transition-colors flex items-center justify-between gap-3 ${
                option.value === value ? "bg-white text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">{option.label}</span>
              {option.value === value && <Check size={14} className="text-blue-600 shrink-0" />}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
