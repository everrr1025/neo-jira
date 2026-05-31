"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NumberInputProps = Omit<React.ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> & {
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  onStepValueChange?: (value: string) => void;
  step?: number;
  inputClassName?: string;
};

function normalizeValue(value: string | number | undefined) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function clampValue(value: number, min?: string | number, max?: string | number) {
  const minNumber = min === undefined || min === "" ? null : Number(min);
  const maxNumber = max === undefined || max === "" ? null : Number(max);
  let nextValue = value;

  if (minNumber !== null && Number.isFinite(minNumber)) {
    nextValue = Math.max(minNumber, nextValue);
  }
  if (maxNumber !== null && Number.isFinite(maxNumber)) {
    nextValue = Math.min(maxNumber, nextValue);
  }

  return nextValue;
}

function NumberInput({
  className,
  inputClassName,
  value,
  defaultValue,
  onValueChange,
  onStepValueChange,
  step = 1,
  min,
  max,
  disabled,
  ...props
}: NumberInputProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState(() => normalizeValue(defaultValue));
  const currentValue = isControlled ? normalizeValue(value) : internalValue;

  const commitValue = (nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
  };

  const stepValue = (direction: 1 | -1) => {
    const currentNumber = currentValue === "" ? 0 : Number(currentValue);
    const baseValue = Number.isFinite(currentNumber) ? currentNumber : 0;
    const nextValue = clampValue(baseValue + step * direction, min, max);
    const nextValueString = String(nextValue);
    commitValue(nextValueString);
    onStepValueChange?.(nextValueString);
  };

  return (
    <div className={cn("group relative w-full", className)}>
      <Input
        {...props}
        type="number"
        value={currentValue}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => commitValue(event.target.value)}
        className={cn("pr-16 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", inputClassName)}
      />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => stepValue(-1)}
          onMouseDown={(event) => event.preventDefault()}
          disabled={disabled}
          tabIndex={-1}
          aria-label="Decrease"
          className="text-muted-foreground hover:text-foreground"
        >
          <Minus className="size-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => stepValue(1)}
          onMouseDown={(event) => event.preventDefault()}
          disabled={disabled}
          tabIndex={-1}
          aria-label="Increase"
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3" />
        </Button>
      </div>
    </div>
  );
}

export { NumberInput };
