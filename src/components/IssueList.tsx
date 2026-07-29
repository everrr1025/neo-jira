"use client";

import { useState, useTransition, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Settings2,
  Trash2,
  X,
  Eye,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  bulkUpdateIssues,
  createIssueFieldDefinition,
  deleteIssueFieldDefinition,
  updateIssueFieldDefinition,
  updateIssue,
  updateIssueFieldValue,
} from "@/app/actions/issues";
import {
  createPlanFieldDefinition,
  deletePlanFieldDefinition,
  updatePlanFieldDefinition,
  updatePlanIssueFieldValue,
} from "@/app/actions/plans";
import { buildIssueDetailHref } from "@/lib/issueNavigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIssueListFilters } from "./issuelist/useIssueListFilters";
import BulkIssueActionModal, { type BulkIssueActionType } from "./BulkIssueActionModal";
import { DropdownField } from "./DropdownField";
import {
  getIssueTypeLabel,
  getPriorityLabel,
  getTranslations,
  localeDateMap,
  Locale,
} from "@/lib/i18n";
import {
  buildWorkflowStatusOptions,
  buildWorkflowTransitionMap,
  getWorkflowStatusBadgeClass,
  isDoneWorkflowStatus,
  sortWorkflowStatuses,
  type WorkflowStatusRecord,
  type WorkflowTransitionRecord,
} from "@/lib/workflows";
import ShadcnDatePicker from "./ShadcnDatePicker";

type Issue = {
  id: string;
  projectId: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  parentIssueId?: string | null;
  parentIssue?: { id: string; key: string; title: string; type: string } | null;
  childIssues?: { id: string; status: string }[];
  _count?: { childIssues: number };
  planId?: string | null;
  plan?: { id: string; name: string } | null;
  iterationId?: string | null;
  iteration?: { name: string } | null;
  assigneeId?: string | null;
  assignee?: { name: string | null } | null;
  reporter?: { name: string | null } | null;
  watchers?: { id: string }[];
  issueFieldValues?: IssueFieldValue[];
  planFieldValues?: PlanIssueFieldValue[];
  createdAt: Date | string;
  dueDate?: Date | string | null;
};

type PlanFieldType = "BOOLEAN" | "NUMBER" | "TEXT" | "LONG_TEXT" | "SELECT" | "DATE";

type CustomFieldDefinition = {
  id: string;
  key: string;
  name: string;
  type: string;
  required: boolean;
  position: number;
  optionsJson: string | null;
};

type PlanFieldDefinition = CustomFieldDefinition & {
  planId: string;
};

type IssueFieldDefinition = CustomFieldDefinition & {
  projectId: string;
};

type CustomFieldValue = {
  id: string;
  fieldDefinitionId: string;
  valueBoolean: boolean | null;
  valueNumber: number | null;
  valueText: string | null;
  valueOption: string | null;
};

type PlanIssueFieldValue = CustomFieldValue;
type IssueFieldValue = CustomFieldValue;

type FilterOption = {
  value: string;
  label: string;
};

type IssueUser = {
  id: string;
  name: string | null;
  role?: string | null;
};

type IssueIteration = {
  id: string;
  name: string;
};

type IssuePlan = {
  id: string;
  name: string;
};

type ColumnId = "key" | "title" | "parent" | "children" | "plan" | "iteration" | "status" | "type" | "priority" | "dueDate" | "assignee";
type ColumnConfig = {
  id: ColumnId;
  label: string;
  width: number;
};

type ResizableColumn =
  | { type: "column"; id: ColumnId; label: string; width: number }
  | { type: "issueField"; id: string; field: IssueFieldDefinition; width: number }
  | { type: "planField"; id: string; field: PlanFieldDefinition; width: number };

type StoredIssueListColumnPreferences = {
  visibleColumnIds?: ColumnId[];
  columnWidths?: Partial<Record<ColumnId, number>>;
  visibleIssueFieldIds?: string[];
  issueFieldWidths?: Partial<Record<string, number>>;
  visiblePlanFieldIds?: string[];
  planFieldWidths?: Partial<Record<string, number>>;
  columnOrder?: string[];
};

type SortField = "createdAt" | "key" | "title" | "plan" | "status" | "type" | "priority" | "dueDate" | "sprint" | "assignee";
type DueFilterValue = "ALL" | "EQ" | "GTE" | "LTE";

const BACKLOG_FILTER_VALUE = "__BACKLOG__";
const DEFAULT_RESIZABLE_COLUMN_MIN_WIDTH = 80;
const DATE_FIELD_INPUT_WIDTH = 180;
const TABLE_CELL_HORIZONTAL_PADDING = 40;
const DATE_FIELD_COLUMN_MIN_WIDTH = DATE_FIELD_INPUT_WIDTH + TABLE_CELL_HORIZONTAL_PADDING;
const INLINE_SELECT_MAX_MENU_HEIGHT = 340;
const INLINE_SELECT_MIN_MENU_HEIGHT = 120;
const issueListCheckboxClassName =
  "size-4 shrink-0 rounded-sm border border-input accent-primary transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function normalizeFieldKeyInput(input: string) {
  return input.trim().slice(0, 40);
}

function isValidFieldKeyInput(input: string) {
  return /^[A-Za-z_][A-Za-z0-9_]{0,39}$/.test(input);
}

function parseSelectOptionsInput(input: string) {
  return input
    .split(/[,\s，]+/)
    .map((option) => option.trim())
    .filter(Boolean);
}

function hasSelectOptionsInput(input: string) {
  return parseSelectOptionsInput(input).length > 0;
}

const TYPE_ORDER: Record<string, number> = {
  EPIC: 1,
  STORY: 2,
  TASK: 3,
  BUG: 4,
};

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const COLUMN_SORT_FIELD_MAP: Partial<Record<ColumnId, SortField>> = {
  key: "key",
  title: "title",
  plan: "plan",
  iteration: "sprint",
  status: "status",
  type: "type",
  priority: "priority",
  dueDate: "dueDate",
  assignee: "assignee",
};

const ISSUE_LIST_COLUMN_STORAGE_KEYS = {
  default: "neo-jira:issue-list-columns:default:v1",
  plan: "neo-jira:issue-list-columns:plan:v1",
  iteration: "neo-jira:issue-list-columns:iteration:v1",
} as const;

function readStoredIssueListColumnPreferences(storageKey: string): StoredIssueListColumnPreferences | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredIssueListColumnPreferences;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function MultiFilter({
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="max-w-56 justify-between">
          <span className="truncate">{buttonText}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between gap-3">
          <span>{label}</span>
          {selectedValues.length > 0 ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
              {selectedValues.length}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={() => onToggle(option.value)}
            onSelect={(event) => event.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
        {selectedValues.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="w-full justify-start text-primary hover:text-primary"
            >
              {clearText}
            </Button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColumnVisibilityMenu({
  buttonLabel,
  resetLabel,
  columns,
  visibleColumnIds,
  onToggle,
  onReset,
  issueFields = [],
  visibleIssueFieldIds = [],
  onToggleIssueField,
  planFields = [],
  visiblePlanFieldIds = [],
  onTogglePlanField,
}: {
  buttonLabel: string;
  resetLabel: string;
  columns: ColumnConfig[];
  visibleColumnIds: ColumnId[];
  onToggle: (columnId: ColumnId) => void;
  onReset: () => void;
  issueFields?: IssueFieldDefinition[];
  visibleIssueFieldIds?: string[];
  onToggleIssueField?: (fieldId: string) => void;
  planFields?: PlanFieldDefinition[];
  visiblePlanFieldIds?: string[];
  onTogglePlanField?: (fieldId: string) => void;
}) {
  const visibleCount = visibleColumnIds.length;
  const totalColumnCount = columns.length + issueFields.length + planFields.length;
  const totalVisibleCount = visibleColumnIds.length + visibleIssueFieldIds.length + visiblePlanFieldIds.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={buttonLabel}
          title={buttonLabel}
        >
          <Eye className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between gap-3">
          <span>{buttonLabel}</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            {totalVisibleCount}/{totalColumnCount}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => {
          const isChecked = visibleColumnIds.includes(column.id);
          const isDisabled = isChecked && visibleCount === 1;

          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={isChecked}
              disabled={isDisabled}
              onCheckedChange={() => onToggle(column.id)}
              onSelect={(event) => event.preventDefault()}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          );
        })}
        {issueFields.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            {issueFields.map((field) => (
              <DropdownMenuCheckboxItem
                key={field.id}
                checked={visibleIssueFieldIds.includes(field.id)}
                onCheckedChange={() => onToggleIssueField?.(field.id)}
                onSelect={(event) => event.preventDefault()}
              >
                <span className="truncate">{field.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </>
        ) : null}
        {planFields.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            {planFields.map((field) => (
              <DropdownMenuCheckboxItem
                key={field.id}
                checked={visiblePlanFieldIds.includes(field.id)}
                onCheckedChange={() => onTogglePlanField?.(field.id)}
                onSelect={(event) => event.preventDefault()}
              >
                <span className="truncate">{field.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="w-full justify-start text-primary hover:text-primary"
        >
          {resetLabel}
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getCustomFieldFilterOptions(field: CustomFieldDefinition, locale: Locale): FilterOption[] {
  const emptyOptions = [
    { value: "EMPTY", label: locale === "zh" ? "为空" : "Is empty" },
    { value: "NOT_EMPTY", label: locale === "zh" ? "不为空" : "Is not empty" },
  ];

  if (field.type === "BOOLEAN") {
    return [{ value: "EQ", label: locale === "zh" ? "等于" : "Is" }, ...emptyOptions];
  }
  if (field.type === "NUMBER") {
    return [
      { value: "EQ", label: locale === "zh" ? "等于" : "Equals" },
      { value: "GT", label: locale === "zh" ? "大于" : "Greater than" },
      { value: "GTE", label: locale === "zh" ? "大于等于" : "At least" },
      { value: "LT", label: locale === "zh" ? "小于" : "Less than" },
      { value: "LTE", label: locale === "zh" ? "小于等于" : "At most" },
      ...emptyOptions,
    ];
  }
  if (field.type === "DATE") {
    return [
      { value: "EQ", label: locale === "zh" ? "等于" : "Equals" },
      { value: "GTE", label: locale === "zh" ? "晚于或等于" : "On or after" },
      { value: "LTE", label: locale === "zh" ? "早于或等于" : "On or before" },
      ...emptyOptions,
    ];
  }
  if (field.type === "SELECT") {
    return [
      { value: "EQ", label: locale === "zh" ? "等于" : "Is" },
      { value: "NEQ", label: locale === "zh" ? "不等于" : "Is not" },
      ...emptyOptions,
    ];
  }
  return [
    { value: "CONTAINS", label: locale === "zh" ? "包含" : "Contains" },
    { value: "NEQ", label: locale === "zh" ? "不等于" : "Is not" },
    ...emptyOptions,
  ];
}

function AdvancedFieldFilters({
  locale,
  issueFields,
  planFields,
  searchParams,
  updateQueryParams,
}: {
  locale: Locale;
  issueFields: IssueFieldDefinition[];
  planFields: PlanFieldDefinition[];
  searchParams: URLSearchParams;
  updateQueryParams: (updates: Record<string, string | string[] | null>) => void;
}) {
  const allFields = [
    ...issueFields.map((field) => ({ ...field, source: "issue" as const })),
    ...planFields.map((field) => ({ ...field, source: "plan" as const })),
  ];
  const activeCount = allFields.filter((field) =>
    searchParams.get(`${field.source === "plan" ? "planField" : "issueField"}_${field.id}_op`)
  ).length;
  const label = locale === "zh" ? "扩展字段" : "Custom fields";
  const clearLabel = locale === "zh" ? "清除" : "Clear";
  const valueLabel = locale === "zh" ? "筛选值" : "Value";
  const noFieldsLabel = locale === "zh" ? "暂无可筛选的扩展字段" : "No custom fields to filter";

  const updateFieldFilter = (field: CustomFieldDefinition & { source: "issue" | "plan" }, op: string, value: string) => {
    const prefix = field.source === "plan" ? "planField" : "issueField";
    const nextValue = field.type === "BOOLEAN" && op && op !== "EMPTY" && op !== "NOT_EMPTY" && !value ? "true" : value;
    updateQueryParams({
      [`${prefix}_${field.id}_op`]: op || null,
      [`${prefix}_${field.id}`]: op && op !== "EMPTY" && op !== "NOT_EMPTY" ? nextValue : null,
    });
  };

  const clearFieldFilter = (field: CustomFieldDefinition & { source: "issue" | "plan" }) => {
    const prefix = field.source === "plan" ? "planField" : "issueField";
    updateQueryParams({
      [`${prefix}_${field.id}_op`]: null,
      [`${prefix}_${field.id}`]: null,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <span>{activeCount > 0 ? `${label} (${activeCount})` : label}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[min(92vw,560px)] p-3">
        {allFields.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">{noFieldsLabel}</p>
        ) : (
          <div className="max-h-96 space-y-3 overflow-auto pr-1">
            {allFields.map((field) => {
              const prefix = field.source === "plan" ? "planField" : "issueField";
              const opKey = `${prefix}_${field.id}_op`;
              const valueKey = `${prefix}_${field.id}`;
              const op = searchParams.get(opKey) || "";
              const value = searchParams.get(valueKey) || "";
              const options = getCustomFieldFilterOptions(field, locale);
              const fieldOptions = getFieldOptions(field);
              const needsValue = op && op !== "EMPTY" && op !== "NOT_EMPTY";

              return (
                <div key={`${field.source}-${field.id}`} className="grid gap-2 rounded-md border bg-muted/40 p-2 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{field.name}</div>
                    <div className="text-xs text-muted-foreground">{field.source === "plan" ? (locale === "zh" ? "计划扩展列" : "Plan field") : (locale === "zh" ? "问题扩展字段" : "Issue field")}</div>
                  </div>
                  <Select
                    value={op || "__ANY__"}
                    onValueChange={(nextValue) => updateFieldFilter(field, nextValue === "__ANY__" ? "" : nextValue, value)}
                  >
                    <SelectTrigger aria-label={field.name} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="__ANY__">{locale === "zh" ? "不限" : "Any"}</SelectItem>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                  {needsValue && field.type === "BOOLEAN" ? (
                    <Select
                      value={value || "true"}
                      onValueChange={(nextValue) => updateFieldFilter(field, op, nextValue)}
                    >
                      <SelectTrigger aria-label={valueLabel} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">{locale === "zh" ? "是" : "Yes"}</SelectItem>
                        <SelectItem value="false">{locale === "zh" ? "否" : "No"}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : needsValue && field.type === "SELECT" ? (
                    <Select
                      value={value || "__SELECT__"}
                      onValueChange={(nextValue) => updateFieldFilter(field, op, nextValue === "__SELECT__" ? "" : nextValue)}
                    >
                      <SelectTrigger aria-label={valueLabel} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                      <SelectItem value="__SELECT__">{locale === "zh" ? "请选择" : "Select"}</SelectItem>
                      {fieldOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                      </SelectContent>
                    </Select>
                  ) : needsValue ? (
                    field.type === "NUMBER" ? (
                      <NumberInput
                        value={value}
                        onValueChange={(nextValue) => updateFieldFilter(field, op, nextValue)}
                        placeholder={valueLabel}
                        aria-label={valueLabel}
                      />
                    ) : field.type === "DATE" ? (
                      <div className="[&_label]:sr-only">
                        <ShadcnDatePicker
                          id={`field-filter-${field.source}-${field.id}`}
                          label={valueLabel}
                          locale={locale}
                          value={value}
                          onChange={(nextValue) => updateFieldFilter(field, op, nextValue)}
                        />
                      </div>
                    ) : (
                      <Input
                        value={value}
                        onChange={(event) => updateFieldFilter(field, op, event.target.value)}
                        placeholder={valueLabel}
                        aria-label={valueLabel}
                      />
                    )
                  ) : (
                    <div className="hidden sm:block" />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => clearFieldFilter(field)}
                    className="text-muted-foreground"
                  >
                    {clearLabel}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SingleFilter({
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
  const selectedOption = options.find((option) => option.value === value) || options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {renderSummary(selectedOption?.label || "")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-56">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onChange(option.value)}
            className={option.value === value ? "bg-accent font-medium text-accent-foreground" : undefined}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InlineSelect({
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
    maxHeight: number;
    openingUpward: boolean;
  }>({ left: 0, width: 0, maxHeight: INLINE_SELECT_MAX_MENU_HEIGHT, openingUpward: false });

  const updateMenuPosition = useCallback(() => {
    const rect = summaryRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openingUpward = spaceBelow < 280 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(
      INLINE_SELECT_MIN_MENU_HEIGHT,
      Math.floor((openingUpward ? spaceAbove : spaceBelow) - 16)
    );
    const maxHeight = Math.min(INLINE_SELECT_MAX_MENU_HEIGHT, availableHeight);

    if (openingUpward) {
      setMenuPosition({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        width: rect.width,
        maxHeight,
        openingUpward: true,
      });
    } else {
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        maxHeight,
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
          className="fixed z-50 flex max-w-56 flex-col gap-1 overflow-y-auto rounded-lg border bg-popover p-2 text-popover-foreground shadow-xl"
          style={{
            top: menuPosition.top,
            bottom: menuPosition.bottom,
            left: menuPosition.left,
            minWidth: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
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

function getFieldOptions(field: CustomFieldDefinition) {
  if (!field.optionsJson) return [];

  try {
    const parsed = JSON.parse(field.optionsJson);
    return Array.isArray(parsed) ? parsed.filter((option): option is string => typeof option === "string") : [];
  } catch {
    return [];
  }
}

function getFieldValueForDisplay(field: CustomFieldDefinition, value?: CustomFieldValue) {
  if (!value) return "";
  if (field.type === "BOOLEAN") return value.valueBoolean ? "true" : "false";
  if (field.type === "NUMBER") return value.valueNumber === null || value.valueNumber === undefined ? "" : String(value.valueNumber);
  if (field.type === "SELECT") return value.valueOption || "";
  return value.valueText || "";
}

function getDefaultFieldWidth(field: CustomFieldDefinition) {
  if (field.type === "DATE") return DATE_FIELD_COLUMN_MIN_WIDTH;
  if (field.type === "TEXT" || field.type === "LONG_TEXT") return 240;
  return 150;
}

function getResizableColumnMinWidth(column: ResizableColumn) {
  if ((column.type === "issueField" || column.type === "planField") && column.field.type === "DATE") {
    return DATE_FIELD_COLUMN_MIN_WIDTH;
  }

  return DEFAULT_RESIZABLE_COLUMN_MIN_WIDTH;
}

function getColumnOrderKey(column: Pick<ResizableColumn, "type" | "id">) {
  return `${column.type}:${column.id}`;
}

function FieldDraftInput({
  field,
  value,
  multiline = false,
  onCommit,
}: {
  field: CustomFieldDefinition;
  value: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const displayedDraft = isFocused ? draft : value;

  useEffect(() => {
    if (!multiline || !textareaRef.current) return;

    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [displayedDraft, multiline]);

  const commitDraft = () => {
    setIsFocused(false);
    if (draft !== value) {
      onCommit(draft);
    }
  };

  if (multiline) {
    return (
      <textarea
        ref={textareaRef}
        value={displayedDraft}
        onFocus={() => {
          setDraft(value);
          setIsFocused(true);
        }}
        onBlur={commitDraft}
        onChange={(event) => setDraft(event.target.value)}
        rows={1}
        className="block w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent text-sm font-medium leading-5 text-foreground outline-none hover:border-border focus:border-ring focus:bg-background focus:ring-1 focus:ring-ring"
        aria-label={field.name}
      />
    );
  }

  if (field.type === "NUMBER") {
    return (
      <NumberInput
        value={displayedDraft}
        onFocus={() => {
          setDraft(value);
          setIsFocused(true);
        }}
        onBlur={commitDraft}
        onValueChange={setDraft}
        onStepValueChange={onCommit}
        inputClassName="h-8 border-transparent bg-transparent text-sm font-medium text-foreground hover:border-border focus-visible:ring-1"
        aria-label={field.name}
      />
    );
  }

  return (
    <input
      type="text"
      value={displayedDraft}
      onFocus={() => {
        setDraft(value);
        setIsFocused(true);
      }}
      onBlur={commitDraft}
      onChange={(event) => setDraft(event.target.value)}
      className="h-8 w-full rounded-md border border-transparent bg-transparent text-sm font-medium text-foreground outline-none hover:border-border focus:border-ring focus:bg-background focus:ring-1 focus:ring-ring"
      aria-label={field.name}
    />
  );
}

export default function IssueList({
  initialIssues,
  totalIssues = 0,
  page: serverPage = 1,
  pageSize: serverPageSize = 10,
  users,
  plans,
  iterations,
  workflowProjects,
  currentUser,
  locale,
  activeProjectId,
  issueFieldDefinitions = [],
  canManageIssueFields,
  lockedPlanId,
  lockedIterationId,
  planFieldDefinitions = [],
  canManagePlanFields,
  canManagePlans,
  canMoveIssuesBetweenIterations = true,
  unframed = false,
}: {
  initialIssues: Issue[];
  totalIssues?: number;
  page?: number;
  pageSize?: number;
  users: IssueUser[];
  plans: IssuePlan[];
  iterations: IssueIteration[];
  workflowProjects: Array<{
    id: string;
    workflowStatuses: WorkflowStatusRecord[];
    workflowTransitions: WorkflowTransitionRecord[];
  }>;
  currentUser: { id: string } | null;
  locale: Locale;
  activeProjectId: string;
  issueFieldDefinitions?: IssueFieldDefinition[];
  canManageIssueFields: boolean;
  lockedPlanId?: string | null;
  lockedIterationId?: string | null;
  planFieldDefinitions?: PlanFieldDefinition[];
  canManagePlanFields?: boolean;
  canManagePlans: boolean;
  canMoveIssuesBetweenIterations?: boolean;
  unframed?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = `${pathname}${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`;
  const getIssueHref = (issueId: string) => buildIssueDetailHref(issueId, returnTo);
  const [issues, setIssues] = useState(initialIssues);
  const translations = getTranslations(locale);
  const planLabel = locale === "zh" ? "计划" : "Plan";
  const columnsButtonLabel = locale === "zh" ? "显示列" : "Columns";
  const resetColumnsLabel = locale === "zh" ? "重置列" : "Reset columns";
  const noPlanLabel = locale === "zh" ? "未设置计划" : "No plan";
  const parentIssueColumnLabel = locale === "zh" ? "父级" : "Parent";
  const childProgressColumnLabel = locale === "zh" ? "子项进度" : "Children";
  const selectedIssuesLabel = locale === "zh" ? "已选" : "Selected";
  const bulkAddToPlanLabel = locale === "zh" ? "加入计划" : "Add to plan";
  const bulkRemovePlanLabel = locale === "zh" ? "移出计划" : "Remove plan";
  const bulkAddToSprintLabel = locale === "zh" ? "加入迭代" : "Add to sprint";
  const bulkClearLabel = locale === "zh" ? "取消选择" : "Clear selection";
  const planFieldsLabel = locale === "zh" ? "扩展列" : "Custom fields";
  const issueFieldsLabel = locale === "zh" ? "扩展字段" : "Custom fields";
  const fieldManagerLabel = locale === "zh" ? "扩展字段" : "Custom fields";
  const addFieldLabel = locale === "zh" ? "添加" : "Add field";
  const fieldNameLabel = locale === "zh" ? "名称" : "Field name";
  const fieldKeyLabel = locale === "zh" ? "标识" : "Field key";
  const fieldTypeLabel = locale === "zh" ? "类型" : "Field type";
  const fieldOptionsLabel = locale === "zh" ? "选项" : "Select options";
  const fieldNewOptionsLabel = locale === "zh" ? "新增选项" : "New options";
  const fieldOptionsPlaceholder = locale === "zh" ? "用逗号或者空格分隔" : "Separate with commas or spaces";
  const fieldKeyInvalidLabel = locale === "zh" ? "标识只能包含字母、数字和下划线，且不能以数字开头" : "Field key can only contain letters, numbers, and underscores, and cannot start with a number";
  const fieldKeyExistsLabel = locale === "zh" ? "标识已存在" : "Field key already exists";
  const fieldOptionsRequiredLabel = locale === "zh" ? "下拉选择至少需要一个选项" : "Select fields require at least one option";
  const noFieldsLabel = locale === "zh" ? "还没有配置扩展列" : "No custom fields yet";
  const saveFailedLabel = locale === "zh" ? "保存失败" : "Save failed";
  const saveLabel = locale === "zh" ? "保存" : "Save";
  const cancelLabel = locale === "zh" ? "取消" : "Cancel";
  const editFieldLabel = locale === "zh" ? "编辑字段" : "Edit field";
  const deleteFieldLabel = locale === "zh" ? "删除字段" : "Delete field";
  const closeLabel = locale === "zh" ? "关闭" : "Close";
  const fieldTypeOptions = useMemo<FilterOption[]>(
    () => [
      { value: "BOOLEAN", label: locale === "zh" ? "是/否" : "Yes / no" },
      { value: "NUMBER", label: locale === "zh" ? "数字" : "Number" },
      { value: "TEXT", label: locale === "zh" ? "文本" : "Text" },
      { value: "LONG_TEXT", label: locale === "zh" ? "多行文本" : "Long text" },
      { value: "SELECT", label: locale === "zh" ? "下拉选择" : "Select" },
      { value: "DATE", label: locale === "zh" ? "日期" : "Date" },
    ],
    [locale]
  );
  const fullscreenLabel = locale === "zh" ? "全屏显示" : "Fullscreen";
  const exitFullscreenLabel = locale === "zh" ? "退出全屏" : "Exit fullscreen";
  const customFieldsButtonLabel = locale === "zh" ? "扩展字段" : "Custom fields";
  const workflowByProject = useMemo(
    () =>
      new Map(
        workflowProjects.map((project) => [
          project.id,
          {
            statuses: sortWorkflowStatuses(project.workflowStatuses),
            transitions: project.workflowTransitions,
          },
        ])
      ),
    [workflowProjects]
  );
  const getWorkflowForProject = useCallback(
    (projectId: string) =>
      workflowByProject.get(projectId) || {
        statuses: [] as WorkflowStatusRecord[],
        transitions: [] as WorkflowTransitionRecord[],
      },
    [workflowByProject]
  );

  const { filters, pagination, sorting, updateQueryParams } = useIssueListFilters();
  const { statusFilter, typeFilter, priorityFilter, planFilter, sprintFilter, assigneeFilter, watcherFilter, view: rawView, dueFilter, dueDateValue, duePreset, search: searchParamsSearch } = filters;
  const view = lockedIterationId && rawView === "backlog" ? "all" : rawView;
  const { page: currentPage, pageSize: itemsPerPage } = pagination;
  const { sortBy, sortDirection } = sorting;
  const activeCustomFilterCount = Array.from(searchParams.keys()).filter((key) =>
    (key.startsWith("issueField_") || key.startsWith("planField_")) && key.endsWith("_op") && searchParams.get(key)
  ).length;
  const activeFilterCount =
    statusFilter.length +
    typeFilter.length +
    priorityFilter.length +
    planFilter.length +
    (lockedIterationId ? 0 : sprintFilter.length) +
    assigneeFilter.length +
    watcherFilter.length +
    (dueFilter !== "ALL" || (duePreset && duePreset !== "NONE") || dueDateValue ? 1 : 0) +
    (searchParamsSearch ? 1 : 0) +
    (view && view !== "all" ? 1 : 0) +
    activeCustomFilterCount;
  const activeAdvancedFilterCount = activeFilterCount - (view && view !== "all" ? 1 : 0);
  const [isFilterRowOpen, setIsFilterRowOpen] = useState(false);
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkIssueActionType | null>(null);
  const [bulkActionNonce, setBulkActionNonce] = useState(0);
  const assigneeUsers = useMemo(() => users.filter((user) => user.role !== "ADMIN"), [users]);
  const [issueFields, setIssueFields] = useState(issueFieldDefinitions);
  const [visibleIssueFieldIds, setVisibleIssueFieldIds] = useState<string[]>(() =>
    issueFieldDefinitions.map((field) => field.id)
  );
  const [issueFieldWidths, setIssueFieldWidths] = useState<Record<string, number>>(() =>
    issueFieldDefinitions.reduce(
      (acc, field) => {
        acc[field.id] = getDefaultFieldWidth(field);
        return acc;
      },
      {} as Record<string, number>
    )
  );
  const [planFields, setPlanFields] = useState(planFieldDefinitions);
  const [visiblePlanFieldIds, setVisiblePlanFieldIds] = useState<string[]>(() =>
    planFieldDefinitions.map((field) => field.id)
  );
  const [planFieldWidths, setPlanFieldWidths] = useState<Record<string, number>>(() =>
    planFieldDefinitions.reduce(
      (acc, field) => {
        acc[field.id] = getDefaultFieldWidth(field);
        return acc;
      },
      {} as Record<string, number>
    )
  );
  const visiblePlanFields = useMemo(
    () => planFields.filter((field) => visiblePlanFieldIds.includes(field.id)),
    [planFields, visiblePlanFieldIds]
  );
  const visibleIssueFields = useMemo(
    () => issueFields.filter((field) => visibleIssueFieldIds.includes(field.id)),
    [issueFields, visibleIssueFieldIds]
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeFieldManager, setActiveFieldManager] = useState<"issue" | "plan" | null>(null);
  const fieldManagerScrollRef = useRef<HTMLDivElement>(null);
  const [fieldForm, setFieldForm] = useState({
    name: "",
    key: "",
    type: "BOOLEAN" as PlanFieldType,
    optionsText: "",
  });
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editFieldForm, setEditFieldForm] = useState({
    name: "",
    key: "",
    type: "BOOLEAN" as PlanFieldType,
    newOptionsText: "",
  });
  const [fieldManagerError, setFieldManagerError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFieldManager) return;

    setEditingFieldId(null);
    setFieldManagerError(null);
    const frameId = requestAnimationFrame(() => {
      const scrollContainer = fieldManagerScrollRef.current;
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [activeFieldManager]);

  const [, startTransition] = useTransition();
  const columnStorageKey = useMemo(
    () =>
      lockedIterationId
        ? ISSUE_LIST_COLUMN_STORAGE_KEYS.iteration
        : lockedPlanId
          ? ISSUE_LIST_COLUMN_STORAGE_KEYS.plan
          : ISSUE_LIST_COLUMN_STORAGE_KEYS.default,
    [lockedIterationId, lockedPlanId]
  );

  const defaultColumns = useMemo<ColumnConfig[]>(
    () => [
      { id: "key", label: translations.issueList.key, width: 80 },
      { id: "title", label: translations.issueList.summary, width: 320 },
      { id: "parent", label: parentIssueColumnLabel, width: 190 },
      { id: "children", label: childProgressColumnLabel, width: 130 },
      ...(lockedPlanId ? [] : [{ id: "plan" as const, label: planLabel, width: 180 }]),
      ...(lockedIterationId ? [] : [{ id: "iteration" as const, label: translations.issueList.sprint, width: 160 }]),
      { id: "status", label: translations.issueList.status, width: 140 },
      { id: "type", label: translations.issueList.type, width: 120 },
      { id: "priority", label: translations.issueList.priority, width: 140 },
      { id: "dueDate", label: translations.issueList.due, width: 140 },
      { id: "assignee", label: translations.issueList.assignee, width: 190 },
    ],
    [
      lockedPlanId,
      lockedIterationId,
      childProgressColumnLabel,
      parentIssueColumnLabel,
      planLabel,
      translations.issueList.assignee,
      translations.issueList.due,
      translations.issueList.key,
      translations.issueList.priority,
      translations.issueList.sprint,
      translations.issueList.status,
      translations.issueList.summary,
      translations.issueList.type,
    ]
  );
  const defaultVisibleColumnIds = useMemo(() => defaultColumns.map((column) => column.id), [defaultColumns]);
  const defaultColumnWidths = useMemo(
    () =>
      defaultColumns.reduce(
        (acc, column) => {
          acc[column.id] = column.width;
          return acc;
        },
        {} as Record<ColumnId, number>
      ),
    [defaultColumns]
  );
  const defaultColumnsById = useMemo(
    () =>
      new Map(
        defaultColumns.map((column) => [column.id, column] as const)
      ),
    [defaultColumns]
  );

  const [visibleColumnIds, setVisibleColumnIds] = useState<ColumnId[]>(defaultVisibleColumnIds);
  const [columnOrderKeys, setColumnOrderKeys] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<ColumnId, number>>(defaultColumnWidths);
  const [hasLoadedColumnPreferences, setHasLoadedColumnPreferences] = useState(false);
  const columns = useMemo(
    () =>
      visibleColumnIds
        .map((columnId) => {
          const column = defaultColumnsById.get(columnId);
          if (!column) return null;
          return {
            ...column,
            width: columnWidths[columnId] ?? column.width,
          };
        })
        .filter((column): column is ColumnConfig => Boolean(column)),
    [columnWidths, defaultColumnsById, visibleColumnIds]
  );
  const availableColumns = useMemo<ResizableColumn[]>(
    () => [
      ...columns.map((column) => ({ type: "column" as const, id: column.id, label: column.label, width: column.width })),
      ...visibleIssueFields.map((field) => ({
        type: "issueField" as const,
        id: field.id,
        field,
        width: issueFieldWidths[field.id] ?? getDefaultFieldWidth(field),
      })),
      ...visiblePlanFields.map((field) => ({
        type: "planField" as const,
        id: field.id,
        field,
        width: planFieldWidths[field.id] ?? getDefaultFieldWidth(field),
      })),
    ],
    [columns, issueFieldWidths, planFieldWidths, visibleIssueFields, visiblePlanFields]
  );
  const defaultColumnOrderKeys = useMemo(
    () => availableColumns.map(getColumnOrderKey),
    [availableColumns]
  );
  const availableColumnsByKey = useMemo(
    () => new Map(availableColumns.map((column) => [getColumnOrderKey(column), column] as const)),
    [availableColumns]
  );
  const orderedColumnKeys = useMemo(() => {
    const storedKeys = columnOrderKeys.length > 0 ? columnOrderKeys : defaultColumnOrderKeys;
    const orderedKeys = storedKeys.filter((key) => availableColumnsByKey.has(key));
    const missingKeys = defaultColumnOrderKeys.filter((key) => !orderedKeys.includes(key));
    return [...orderedKeys, ...missingKeys];
  }, [availableColumnsByKey, columnOrderKeys, defaultColumnOrderKeys]);
  const resizableColumns = useMemo(
    () => orderedColumnKeys.map((key) => availableColumnsByKey.get(key)).filter((column): column is ResizableColumn => Boolean(column)),
    [availableColumnsByKey, orderedColumnKeys]
  );
  const columnsTotalWidth = useMemo(
    () => resizableColumns.reduce((total, column) => total + column.width, 0),
    [resizableColumns]
  );

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("colIndex", index.toString());
    e.dataTransfer.effectAllowed = "move";
    setDragSourceIndex(index);
  };

  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverSide, setDragOverSide] = useState<"left" | "right" | null>(null);

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData("colIndex");
    if (sourceIndexStr) {
      const sourceIndex = parseInt(sourceIndexStr, 10);
      if (sourceIndex !== targetIndex) {
        const nextColumnOrderKeys = resizableColumns.map(getColumnOrderKey);
        const [removed] = nextColumnOrderKeys.splice(sourceIndex, 1);
        const adjustedTarget =
          dragOverSide === "right"
            ? sourceIndex < targetIndex
              ? targetIndex
              : targetIndex + 1
            : sourceIndex < targetIndex
              ? targetIndex - 1
              : targetIndex;
        nextColumnOrderKeys.splice(Math.max(0, adjustedTarget), 0, removed);
        setColumnOrderKeys(nextColumnOrderKeys);
        setVisibleColumnIds(
          nextColumnOrderKeys
            .filter((key) => key.startsWith("column:"))
            .map((key) => key.slice("column:".length) as ColumnId)
        );
        setVisibleIssueFieldIds(
          nextColumnOrderKeys
            .filter((key) => key.startsWith("issueField:"))
            .map((key) => key.slice("issueField:".length))
        );
        setVisiblePlanFieldIds(
          nextColumnOrderKeys
            .filter((key) => key.startsWith("planField:"))
            .map((key) => key.slice("planField:".length))
        );
      }
    }
    setDragSourceIndex(null);
    setDragOverIndex(null);
    setDragOverSide(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const side = e.clientX < midX ? "left" : "right";
    setDragOverIndex(index);
    setDragOverSide(side);
  };

  const handleDragEnd = () => {
    setDragSourceIndex(null);
    setDragOverIndex(null);
    setDragOverSide(null);
  };

  const resizingRef = useRef<{
    colIndex: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, colIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      const col = resizableColumns[colIndex];
      if (!col) return;
      const startWidth = col.width || 150;
      resizingRef.current = { colIndex, startX: e.clientX, startWidth };

      const onMouseMove = (ev: MouseEvent) => {
        const resizeState = resizingRef.current;
        if (!resizeState) return;

        const delta = ev.clientX - resizeState.startX;
        const resizeColumn = resizableColumns[resizeState.colIndex];

        if (!resizeColumn) return;

        const newWidth = Math.max(getResizableColumnMinWidth(resizeColumn), resizeState.startWidth + delta);
        const columnUpdates: Partial<Record<ColumnId, number>> = {};
        const issueFieldUpdates: Record<string, number> = {};
        const planFieldUpdates: Record<string, number> = {};

        if (resizeColumn.type === "column") {
          columnUpdates[resizeColumn.id] = newWidth;
        } else if (resizeColumn.type === "issueField") {
          issueFieldUpdates[resizeColumn.id] = newWidth;
        } else {
          planFieldUpdates[resizeColumn.id] = newWidth;
        }

        if (Object.keys(columnUpdates).length > 0) {
          setColumnWidths((prev) => ({ ...prev, ...columnUpdates }));
        }
        if (Object.keys(issueFieldUpdates).length > 0) {
          setIssueFieldWidths((prev) => ({ ...prev, ...issueFieldUpdates }));
        }
        if (Object.keys(planFieldUpdates).length > 0) {
          setPlanFieldWidths((prev) => ({ ...prev, ...planFieldUpdates }));
        }
      };

      const onMouseUp = () => {
        resizingRef.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    },
    [resizableColumns]
  );

  useEffect(() => {
    setIssues(initialIssues);
  }, [initialIssues]);

  useEffect(() => {
    setIssueFields(issueFieldDefinitions);
    setVisibleIssueFieldIds(issueFieldDefinitions.map((field) => field.id));
    setIssueFieldWidths(
      issueFieldDefinitions.reduce(
        (acc, field) => {
          acc[field.id] = getDefaultFieldWidth(field);
          return acc;
        },
        {} as Record<string, number>
      )
    );
  }, [activeProjectId, issueFieldDefinitions]);

  useEffect(() => {
    setPlanFields(planFieldDefinitions);
    setVisiblePlanFieldIds(planFieldDefinitions.map((field) => field.id));
    setPlanFieldWidths(
      planFieldDefinitions.reduce(
        (acc, field) => {
          acc[field.id] = getDefaultFieldWidth(field);
          return acc;
        },
        {} as Record<string, number>
      )
    );
    // Only reset local field edits when navigating to another plan.
    // Server props for this array can be referentially new during refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedPlanId]);

  useEffect(() => {
    const storedPreferences = readStoredIssueListColumnPreferences(columnStorageKey);
    const validVisibleColumnIds = storedPreferences?.visibleColumnIds?.filter((columnId) =>
      defaultColumnsById.has(columnId)
    );
    const validColumnWidths = Object.entries(storedPreferences?.columnWidths || {}).reduce(
      (acc, [columnId, width]) => {
        if (defaultColumnsById.has(columnId as ColumnId) && typeof width === "number" && width >= 60) {
          acc[columnId as ColumnId] = width;
        }
        return acc;
      },
      {} as Record<ColumnId, number>
    );
    const issueFieldsById = new Map(issueFields.map((field) => [field.id, field]));
    const currentIssueFieldIds = new Set(issueFields.map((field) => field.id));
    const validVisibleIssueFieldIds = storedPreferences?.visibleIssueFieldIds?.filter((fieldId) =>
      currentIssueFieldIds.has(fieldId)
    );
    const validIssueFieldWidths = Object.entries(storedPreferences?.issueFieldWidths || {}).reduce(
      (acc, [fieldId, width]) => {
        const field = issueFieldsById.get(fieldId);
        const minWidth = field?.type === "DATE" ? DATE_FIELD_COLUMN_MIN_WIDTH : DEFAULT_RESIZABLE_COLUMN_MIN_WIDTH;
        if (field && typeof width === "number" && width >= minWidth) {
          acc[fieldId] = width;
        }
        return acc;
      },
      {} as Record<string, number>
    );
    const planFieldsById = new Map(planFields.map((field) => [field.id, field]));
    const currentPlanFieldIds = new Set(planFields.map((field) => field.id));
    const validVisiblePlanFieldIds = storedPreferences?.visiblePlanFieldIds?.filter((fieldId) =>
      currentPlanFieldIds.has(fieldId)
    );
    const validPlanFieldWidths = Object.entries(storedPreferences?.planFieldWidths || {}).reduce(
      (acc, [fieldId, width]) => {
        const field = planFieldsById.get(fieldId);
        const minWidth = field?.type === "DATE" ? DATE_FIELD_COLUMN_MIN_WIDTH : DEFAULT_RESIZABLE_COLUMN_MIN_WIDTH;
        if (field && typeof width === "number" && width >= minWidth) {
          acc[fieldId] = width;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    const nextVisibleColumnIds = validVisibleColumnIds && validVisibleColumnIds.length > 0 ? validVisibleColumnIds : defaultVisibleColumnIds;
    setVisibleColumnIds(nextVisibleColumnIds);
    setColumnWidths({ ...defaultColumnWidths, ...validColumnWidths });
    const allIssueFieldIds = issueFields.map((field) => field.id);
    const mergedVisibleIssueFieldIds =
      validVisibleIssueFieldIds && validVisibleIssueFieldIds.length > 0
        ? [...validVisibleIssueFieldIds, ...allIssueFieldIds.filter((fieldId) => !validVisibleIssueFieldIds.includes(fieldId))]
        : allIssueFieldIds;
    setVisibleIssueFieldIds(mergedVisibleIssueFieldIds);
    setIssueFieldWidths(
      issueFields.reduce(
        (acc, field) => {
          acc[field.id] = validIssueFieldWidths[field.id] ?? getDefaultFieldWidth(field);
          return acc;
        },
        {} as Record<string, number>
      )
    );
    const allPlanFieldIds = planFields.map((field) => field.id);
    const mergedVisiblePlanFieldIds =
      validVisiblePlanFieldIds && validVisiblePlanFieldIds.length > 0
        ? [...validVisiblePlanFieldIds, ...allPlanFieldIds.filter((fieldId) => !validVisiblePlanFieldIds.includes(fieldId))]
        : allPlanFieldIds;

    setVisiblePlanFieldIds(mergedVisiblePlanFieldIds);
    setPlanFieldWidths(
      planFields.reduce(
        (acc, field) => {
          acc[field.id] = validPlanFieldWidths[field.id] ?? getDefaultFieldWidth(field);
          return acc;
        },
        {} as Record<string, number>
      )
    );
    const availableOrderKeys = [
      ...nextVisibleColumnIds.map((columnId) => `column:${columnId}`),
      ...mergedVisibleIssueFieldIds.map((fieldId) => `issueField:${fieldId}`),
      ...mergedVisiblePlanFieldIds.map((fieldId) => `planField:${fieldId}`),
    ];
    const validColumnOrderKeys = storedPreferences?.columnOrder?.filter((key) => availableOrderKeys.includes(key));
    setColumnOrderKeys(
      validColumnOrderKeys && validColumnOrderKeys.length > 0
        ? [...validColumnOrderKeys, ...availableOrderKeys.filter((key) => !validColumnOrderKeys.includes(key))]
        : availableOrderKeys
    );
    setHasLoadedColumnPreferences(true);
  }, [columnStorageKey, defaultColumnWidths, defaultColumnsById, defaultVisibleColumnIds, issueFields, planFields]);

  useEffect(() => {
    if (!hasLoadedColumnPreferences || typeof window === "undefined") return;

    window.localStorage.setItem(
      columnStorageKey,
      JSON.stringify({
        visibleColumnIds,
        columnWidths,
        visibleIssueFieldIds,
        issueFieldWidths,
        visiblePlanFieldIds,
        planFieldWidths,
        columnOrder: resizableColumns.map(getColumnOrderKey),
      } satisfies StoredIssueListColumnPreferences)
    );
  }, [columnStorageKey, columnWidths, hasLoadedColumnPreferences, issueFieldWidths, planFieldWidths, resizableColumns, visibleColumnIds, visibleIssueFieldIds, visiblePlanFieldIds]);

  useEffect(() => {
    const availableIssueIds = new Set(issues.map((issue) => issue.id));
    setSelectedIssueIds((current) => current.filter((issueId) => availableIssueIds.has(issueId)));
  }, [issues]);

  

  const statusOptions = useMemo<FilterOption[]>(
    () => {
      const optionMap = new Map<string, string>();

      for (const project of workflowProjects) {
        for (const option of buildWorkflowStatusOptions(project.workflowStatuses, locale)) {
          if (!optionMap.has(option.value)) {
            optionMap.set(option.value, option.label);
          }
        }
      }

      return [...optionMap.entries()].map(([value, label]) => ({ value, label }));
    },
    [locale, workflowProjects]
  );

  const typeOptions = useMemo<FilterOption[]>(
    () => [
      { value: "TASK", label: getIssueTypeLabel("TASK", locale) },
      { value: "STORY", label: getIssueTypeLabel("STORY", locale) },
      { value: "BUG", label: getIssueTypeLabel("BUG", locale) },
      { value: "EPIC", label: getIssueTypeLabel("EPIC", locale) },
    ],
    [locale]
  );

  const priorityOptions = useMemo<FilterOption[]>(
    () => [
      { value: "URGENT", label: getPriorityLabel("URGENT", locale) },
      { value: "HIGH", label: getPriorityLabel("HIGH", locale) },
      { value: "MEDIUM", label: getPriorityLabel("MEDIUM", locale) },
      { value: "LOW", label: getPriorityLabel("LOW", locale) },
    ],
    [locale]
  );

  const priorityInlineOptions = useMemo<FilterOption[]>(
    () => [
      { value: "LOW", label: getPriorityLabel("LOW", locale) },
      { value: "MEDIUM", label: getPriorityLabel("MEDIUM", locale) },
      { value: "HIGH", label: getPriorityLabel("HIGH", locale) },
      { value: "URGENT", label: getPriorityLabel("URGENT", locale) },
    ],
    [locale]
  );

  const assigneeFilterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "ME", label: translations.issueList.assignedToMe },
      { value: "UNASSIGNED", label: translations.issueList.unassigned },
      ...assigneeUsers
        .filter((user) => user.id !== currentUser?.id)
        .map((user) => ({
          value: user.id,
          label: user.name || user.id,
        })),
    ],
    [assigneeUsers, currentUser?.id, translations.issueList.assignedToMe, translations.issueList.unassigned]
  );

  const dueFilterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "ALL", label: translations.issueList.allDue },
      { value: "EQ", label: translations.issueList.dateEquals },
      { value: "GTE", label: translations.issueList.dateOnOrAfter },
      { value: "LTE", label: translations.issueList.dateOnOrBefore },
    ],
    [
      translations.issueList.allDue,
      translations.issueList.dateEquals,
      translations.issueList.dateOnOrAfter,
      translations.issueList.dateOnOrBefore,
    ]
  );

  const sprintOptions = useMemo<FilterOption[]>(
    () => [
      { value: BACKLOG_FILTER_VALUE, label: translations.issueList.backlog },
      ...iterations.map((it) => ({ value: it.id as string, label: it.name as string })),
    ],
    [iterations, translations.issueList.backlog]
  );

  const iterationInlineOptions = useMemo<FilterOption[]>(
    () => [
      { value: "", label: translations.issueList.backlog },
      ...iterations.map((it) => ({ value: it.id as string, label: it.name as string })),
    ],
    [iterations, translations.issueList.backlog]
  );

  const assigneeInlineOptions = useMemo<FilterOption[]>(
    () => [
      { value: "", label: translations.issueList.unassigned },
      ...assigneeUsers.map((u) => ({ value: u.id as string, label: (u.name || u.id) as string })),
    ],
    [assigneeUsers, translations.issueList.unassigned]
  );

  const perPageOptions = useMemo<FilterOption[]>(
    () => [
      { value: "10", label: "10" },
      { value: "20", label: "20" },
      { value: "50", label: "50" },
    ],
    []
  );

  const planOptions = useMemo<FilterOption[]>(
    () => plans.map((plan) => ({ value: plan.id, label: plan.name })),
    [plans]
  );

  const planInlineOptions = useMemo<FilterOption[]>(
    () => [
      { value: "", label: noPlanLabel },
      ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
    ],
    [noPlanLabel, plans]
  );

  const viewOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: locale === "zh" ? "全部" : "All" },
      ...(lockedIterationId ? [] : [{ value: "backlog", label: translations.issueList.backlog }]),
      { value: "overdue", label: translations.issueList.overdue },
      { value: "dueSoon", label: translations.issueList.dueSoon },
      { value: "assignedToMe", label: translations.issueList.assignedToMe },
      { value: "watching", label: locale === "zh" ? "我关注" : "Watching" },
    ],
    [
      locale,
      lockedIterationId,
      translations.issueList.assignedToMe,
      translations.issueList.backlog,
      translations.issueList.dueSoon,
      translations.issueList.overdue,
    ]
  );

  const handleViewChange = (nextView: string) => {
    updateQueryParams({
      view: nextView === "all" ? null : nextView,
      page: "1",
      ...(nextView === "backlog" ? { sprint: null } : {}),
      ...(nextView === "overdue" || nextView === "dueSoon"
        ? { dueFilter: null, dueDate: null, duePreset: null }
        : {}),
      ...(nextView === "assignedToMe" ? { assignee: null } : {}),
      ...(nextView === "watching" ? { watcher: null } : {}),
    });
  };

  const toggleFilterValue = (value: string, filterKey: string, currentValues: string[]) => {
    const newValues = currentValues.includes(value) ? currentValues.filter((item) => item !== value) : [...currentValues, value];
    updateQueryParams({ [filterKey]: newValues });
  };

  const resetFilters = () => {
    const updates: Record<string, string | string[] | null> = {
      status: null,
      type: null,
      priority: null,
      plan: null,
      sprint: null,
      assignee: null,
      watcher: null,
      view: null,
      dueFilter: null,
      dueDate: null,
      duePreset: null,
      search: null,
      page: "1",
    };

    for (const key of Array.from(searchParams.keys())) {
      if (key.startsWith("issueField_") || key.startsWith("planField_")) {
        updates[key] = null;
      }
    }

    updateQueryParams(updates);
  };

  const handleSortByColumn = (columnId: ColumnId) => {
    const nextSortField = COLUMN_SORT_FIELD_MAP[columnId];
    if (!nextSortField) return;

    if (sortBy === nextSortField) {
      updateQueryParams({ sortDirection: sortDirection === "asc" ? "desc" : "asc" });
      return;
    }

    updateQueryParams({ sortBy: nextSortField, sortDirection: nextSortField === "createdAt" ? "desc" : "asc" });
  };

    const totalPages = totalIssues ? Math.ceil(totalIssues / itemsPerPage) : Math.ceil(issues.length / itemsPerPage);
  const paginatedIssues = issues;

  useEffect(() => {
    if (totalPages === 0) {
      if (currentPage !== 1) {
        updateQueryParams({ page: "1" });
      }
      return;
    }

    if (currentPage > totalPages) {
      updateQueryParams({ page: String(totalPages) });
    }
  }, [currentPage, totalPages, updateQueryParams]);

  const handleInlineUpdate = (issueId: string, field: string, value: string | null) => {
    setIssues((prev) =>
      prev.map((i) => {
        if (i.id === issueId) {
          if (field === "planId") {
            const plan = plans.find((item) => item.id === value);
            return { ...i, planId: value, plan: plan ? { id: plan.id, name: plan.name } : null };
          }
          if (field === "iterationId") {
            const iter = iterations.find((it) => it.id === value);
            return { ...i, iterationId: value, iteration: iter ? { name: iter.name } : null };
          }
          if (field === "assigneeId") {
            const user = users.find((u) => u.id === value);
            return { ...i, assigneeId: value, assignee: user ? { name: user.name } : null };
          }
          return { ...i, [field]: value };
        }
        return i;
      })
    );

    startTransition(() => {
      updateIssue(issueId, { [field]: value });
    });
  };

  const handlePlanFieldValueUpdate = (
    issueId: string,
    field: PlanFieldDefinition,
    value: string | number | boolean | null
  ) => {
    setIssues((prev) =>
      prev.map((issue) => {
        if (issue.id !== issueId) return issue;

        const valueData: PlanIssueFieldValue = {
          id: issue.planFieldValues?.find((item) => item.fieldDefinitionId === field.id)?.id || `draft-${field.id}`,
          fieldDefinitionId: field.id,
          valueBoolean: field.type === "BOOLEAN" ? Boolean(value) : null,
          valueNumber: field.type === "NUMBER" && value !== "" && value !== null ? Number(value) : null,
          valueText:
            field.type === "TEXT" || field.type === "LONG_TEXT" || field.type === "DATE"
              ? typeof value === "string"
                ? value
                : value === null
                  ? null
                  : String(value)
              : null,
          valueOption: field.type === "SELECT" ? (typeof value === "string" && value ? value : null) : null,
        };

        const existingValues = issue.planFieldValues || [];
        const nextValues = existingValues.some((item) => item.fieldDefinitionId === field.id)
          ? existingValues.map((item) => (item.fieldDefinitionId === field.id ? valueData : item))
          : [...existingValues, valueData];

        return { ...issue, planFieldValues: nextValues };
      })
    );

    if (!lockedPlanId) return;

    startTransition(() => {
      updatePlanIssueFieldValue({
        planId: lockedPlanId,
        issueId,
        fieldDefinitionId: field.id,
        value,
      });
    });
  };

  const handleIssueFieldValueUpdate = (
    issueId: string,
    field: IssueFieldDefinition,
    value: string | number | boolean | null
  ) => {
    setIssues((prev) =>
      prev.map((issue) => {
        if (issue.id !== issueId) return issue;

        const valueData: IssueFieldValue = {
          id: issue.issueFieldValues?.find((item) => item.fieldDefinitionId === field.id)?.id || `draft-${field.id}`,
          fieldDefinitionId: field.id,
          valueBoolean: field.type === "BOOLEAN" ? Boolean(value) : null,
          valueNumber: field.type === "NUMBER" && value !== "" && value !== null ? Number(value) : null,
          valueText:
            field.type === "TEXT" || field.type === "LONG_TEXT" || field.type === "DATE"
              ? typeof value === "string"
                ? value
                : value === null
                  ? null
                  : String(value)
              : null,
          valueOption: field.type === "SELECT" ? (typeof value === "string" && value ? value : null) : null,
        };

        const existingValues = issue.issueFieldValues || [];
        const nextValues = existingValues.some((item) => item.fieldDefinitionId === field.id)
          ? existingValues.map((item) => (item.fieldDefinitionId === field.id ? valueData : item))
          : [...existingValues, valueData];

        return { ...issue, issueFieldValues: nextValues };
      })
    );

    startTransition(() => {
      updateIssueFieldValue({
        issueId,
        fieldDefinitionId: field.id,
        value,
      });
    });
  };

  const handleCreatePlanField = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lockedPlanId) return;

    setFieldManagerError(null);
    const key = normalizeFieldKeyInput(fieldForm.key);
    if (!isValidFieldKeyInput(key)) {
      setFieldManagerError(fieldKeyInvalidLabel);
      return;
    }
    if (planFields.some((field) => field.key === key)) {
      setFieldManagerError(fieldKeyExistsLabel);
      return;
    }
    if (fieldForm.type === "SELECT" && !hasSelectOptionsInput(fieldForm.optionsText)) {
      setFieldManagerError(fieldOptionsRequiredLabel);
      return;
    }

    startTransition(async () => {
      const result = await createPlanFieldDefinition({
        planId: lockedPlanId,
        name: fieldForm.name,
        key,
        type: fieldForm.type,
        optionsText: fieldForm.optionsText,
      });

      if (!result.success || !result.field) {
        setFieldManagerError(result.error || saveFailedLabel);
        return;
      }

      setPlanFields((current) => [...current, result.field as PlanFieldDefinition].sort((a, b) => a.position - b.position));
      setFieldForm({ name: "", key: "", type: "BOOLEAN", optionsText: "" });
    });
  };

  const handleCreateIssueField = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setFieldManagerError(null);
    const key = normalizeFieldKeyInput(fieldForm.key);
    if (!isValidFieldKeyInput(key)) {
      setFieldManagerError(fieldKeyInvalidLabel);
      return;
    }
    if (issueFields.some((field) => field.key === key)) {
      setFieldManagerError(fieldKeyExistsLabel);
      return;
    }
    if (fieldForm.type === "SELECT" && !hasSelectOptionsInput(fieldForm.optionsText)) {
      setFieldManagerError(fieldOptionsRequiredLabel);
      return;
    }

    startTransition(async () => {
      const result = await createIssueFieldDefinition({
        projectId: activeProjectId,
        name: fieldForm.name,
        key,
        type: fieldForm.type,
        optionsText: fieldForm.optionsText,
      });

      if (!result.success || !result.field) {
        setFieldManagerError(result.error || saveFailedLabel);
        return;
      }

      setIssueFields((current) => [...current, result.field as IssueFieldDefinition].sort((a, b) => a.position - b.position));
      setFieldForm({ name: "", key: "", type: "BOOLEAN", optionsText: "" });
    });
  };

  const handleStartEditField = (field: CustomFieldDefinition) => {
    setFieldManagerError(null);
    setEditingFieldId(field.id);
    setEditFieldForm({
      name: field.name,
      key: field.key,
      type: field.type as PlanFieldType,
      newOptionsText: "",
    });
  };

  const handleCancelEditField = () => {
    setFieldManagerError(null);
    setEditingFieldId(null);
  };

  const handleUpdateField = (event: React.FormEvent<HTMLFormElement>, field: CustomFieldDefinition) => {
    event.preventDefault();

    setFieldManagerError(null);
    const existingOptions = getFieldOptions(field);
    const newOptions = parseSelectOptionsInput(editFieldForm.newOptionsText);
    const nextOptionsText = [...existingOptions, ...newOptions].join(", ");
    if (editFieldForm.type === "SELECT" && existingOptions.length === 0 && newOptions.length === 0) {
      setFieldManagerError(fieldOptionsRequiredLabel);
      return;
    }

    startTransition(async () => {
      const result =
        activeFieldManager === "issue"
          ? await updateIssueFieldDefinition({
              id: field.id,
              projectId: activeProjectId,
              name: editFieldForm.name,
              required: field.required,
              optionsText: nextOptionsText,
            })
          : lockedPlanId
            ? await updatePlanFieldDefinition({
                id: field.id,
                planId: lockedPlanId,
                name: editFieldForm.name,
                required: field.required,
                optionsText: nextOptionsText,
              })
            : { success: false, error: saveFailedLabel };

      if (!result.success || !result.field) {
        setFieldManagerError(result.error || saveFailedLabel);
        return;
      }

      if (activeFieldManager === "issue") {
        setIssueFields((current) =>
          current.map((item) => (item.id === result.field.id ? (result.field as IssueFieldDefinition) : item))
        );
      } else {
        setPlanFields((current) =>
          current.map((item) => (item.id === result.field.id ? (result.field as PlanFieldDefinition) : item))
        );
      }

      setEditingFieldId(null);
    });
  };

  const handleDeletePlanField = (field: PlanFieldDefinition) => {
    if (!lockedPlanId) return;
    const confirmed = window.confirm(locale === "zh" ? `删除扩展列「${field.name}」？` : `Delete custom field "${field.name}"?`);
    if (!confirmed) return;

    setFieldManagerError(null);
    startTransition(async () => {
      const result = await deletePlanFieldDefinition({ planId: lockedPlanId, id: field.id });
      if (!result.success) {
        setFieldManagerError(result.error || saveFailedLabel);
        return;
      }

      setPlanFields((current) => current.filter((item) => item.id !== field.id));
      if (editingFieldId === field.id) {
        setEditingFieldId(null);
      }
      setIssues((current) =>
        current.map((issue) => ({
          ...issue,
          planFieldValues: issue.planFieldValues?.filter((value) => value.fieldDefinitionId !== field.id) || [],
        }))
      );
    });
  };

  const handleDeleteIssueField = (field: IssueFieldDefinition) => {
    const confirmed = window.confirm(locale === "zh" ? `删除扩展字段「${field.name}」？` : `Delete custom field "${field.name}"?`);
    if (!confirmed) return;

    setFieldManagerError(null);
    startTransition(async () => {
      const result = await deleteIssueFieldDefinition({ projectId: activeProjectId, id: field.id });
      if (!result.success) {
        setFieldManagerError(result.error || saveFailedLabel);
        return;
      }

      setIssueFields((current) => current.filter((item) => item.id !== field.id));
      if (editingFieldId === field.id) {
        setEditingFieldId(null);
      }
      setIssues((current) =>
        current.map((issue) => ({
          ...issue,
          issueFieldValues: issue.issueFieldValues?.filter((value) => value.fieldDefinitionId !== field.id) || [],
        }))
      );
    });
  };

  const planFieldSummary = useMemo(
    () =>
      planFields
        .map((field) => {
          if (field.type === "NUMBER") {
            const total = issues.reduce((sum, issue) => {
              const value = issue.planFieldValues?.find((item) => item.fieldDefinitionId === field.id)?.valueNumber;
              return sum + (typeof value === "number" ? value : 0);
            }, 0);
            return { id: field.id, label: field.name, value: total };
          }

          return null;
        })
        .filter((item): item is { id: string; label: string; value: number } => Boolean(item)),
    [issues, planFields]
  );
  const paginatedIssueIds = paginatedIssues.map((issue) => issue.id);
  const allCurrentPageSelected =
    paginatedIssueIds.length > 0 && paginatedIssueIds.every((issueId) => selectedIssueIds.includes(issueId));

  const renderColumnCell = (issue: Issue, col: ColumnConfig) => {
    if (col.id === "key") {
      return (
        <td key={`column:${col.id}`} className="px-5 py-3.5 text-muted-foreground font-medium">
          <Link href={getIssueHref(issue.id)} className="hover:text-primary hover:underline">
            {issue.key}
          </Link>
        </td>
      );
    }

    if (col.id === "title") {
      return (
        <td key={`column:${col.id}`} className="px-5 py-3.5 font-semibold text-foreground overflow-hidden text-ellipsis">
          <Link href={getIssueHref(issue.id)} className="hover:text-primary block w-full truncate border-b border-transparent">
            {issue.title}
          </Link>
        </td>
      );
    }

    if (col.id === "parent") {
      return (
        <td key={`column:${col.id}`} className="overflow-hidden text-ellipsis px-5 py-3.5">
          {issue.parentIssue ? (
            <Link href={getIssueHref(issue.parentIssue.id)} className="block w-full truncate text-sm font-medium text-foreground hover:text-primary hover:underline">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">{issue.parentIssue.key}</span>
              <span className="align-middle">{issue.parentIssue.title}</span>
            </Link>
          ) : null}
        </td>
      );
    }

    if (col.id === "children") {
      const childIssues = issue.childIssues || [];
      const childCount = issue._count?.childIssues ?? childIssues.length;
      const doneChildCount = childIssues.filter((childIssue) =>
        isDoneWorkflowStatus(childIssue.status, getWorkflowForProject(issue.projectId).statuses)
      ).length;
      const progress = childCount > 0 ? Math.round((doneChildCount / childCount) * 100) : 0;

      return (
        <td key={`column:${col.id}`} className="px-5 py-3.5">
          {childCount > 0 ? (
            <div className="min-w-0">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">
                {doneChildCount}/{childCount} · {progress}%
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
        </td>
      );
    }

    if (col.id === "plan") {
      return (
        <td key={`column:${col.id}`} className="px-5 py-3.5">
          {canManagePlans ? (
            <InlineSelect
              value={issue.planId || ""}
              options={planInlineOptions}
              className="relative block w-full"
              onChange={(value) => handleInlineUpdate(issue.id, "planId", value || null)}
              renderSummary={(label) => (
                <span className="block w-full cursor-pointer truncate border-none bg-transparent p-0 text-sm font-medium text-foreground outline-none focus:ring-0">
                  {label}
                </span>
              )}
            />
          ) : (
            <span className="block w-full truncate text-sm font-medium text-foreground">
              {issue.plan?.name || noPlanLabel}
            </span>
          )}
        </td>
      );
    }

    if (col.id === "iteration") {
      return (
        <td key={`column:${col.id}`} className="px-5 py-3.5">
          <InlineSelect
            value={issue.iterationId || ""}
            options={iterationInlineOptions}
            className="relative block w-full"
            onChange={(value) => handleInlineUpdate(issue.id, "iterationId", value || null)}
            renderSummary={(label) => (
              <span className="block w-full cursor-pointer truncate border-none bg-transparent p-0 text-sm font-medium text-foreground outline-none focus:ring-0">
                {label}
              </span>
            )}
          />
        </td>
      );
    }

    if (col.id === "status") {
      const workflow = getWorkflowForProject(issue.projectId);
      const transitionMap = buildWorkflowTransitionMap(workflow.transitions, workflow.statuses);
      const allowedTargets = transitionMap.get(issue.status);
      const statusInlineOptions = buildWorkflowStatusOptions(
        workflow.statuses.filter((status) => status.key === issue.status || allowedTargets?.has(status.key)),
        locale
      );
      return (
        <td key={`column:${col.id}`} className="px-5 py-3.5">
          <InlineSelect
            value={issue.status}
            options={statusInlineOptions.length > 0 ? statusInlineOptions : buildWorkflowStatusOptions(workflow.statuses, locale)}
            className="relative block w-full"
            onChange={(value) => handleInlineUpdate(issue.id, "status", value)}
            renderSummary={(label) => (
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-sm font-medium cursor-pointer border-none outline-none focus:ring-0 transition-colors ${getWorkflowStatusBadgeClass(issue.status, workflow.statuses)}`}
              >
                {label}
              </span>
            )}
          />
        </td>
      );
    }

    if (col.id === "type") {
      return (
        <td key={`column:${col.id}`} className="px-5 py-3.5">
          <InlineSelect
            value={issue.type}
            options={typeOptions}
            className="relative block w-full"
            onChange={(value) => handleInlineUpdate(issue.id, "type", value)}
            renderSummary={(label) => (
              <span className="block w-full cursor-pointer truncate border-none bg-transparent p-0 text-sm font-medium text-foreground outline-none focus:ring-0">
                {label}
              </span>
            )}
          />
        </td>
      );
    }

    if (col.id === "priority") {
      return (
        <td key={`column:${col.id}`} className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                issue.priority === "URGENT"
                  ? "bg-red-600"
                  : issue.priority === "HIGH"
                    ? "bg-orange-500"
                    : issue.priority === "MEDIUM"
                      ? "bg-amber-400"
                      : "bg-green-400"
              }`}
            ></span>
            <InlineSelect
              value={issue.priority}
              options={priorityInlineOptions}
              className="relative block w-full"
              onChange={(value) => handleInlineUpdate(issue.id, "priority", value)}
              renderSummary={(label) => (
                <span className="block w-full cursor-pointer truncate border-none bg-transparent p-0 text-sm font-medium text-foreground outline-none focus:ring-0">
                  {label}
                </span>
              )}
            />
          </div>
        </td>
      );
    }

    if (col.id === "dueDate") {
      return (
        <td key={`column:${col.id}`} className="px-5 py-3.5 text-sm font-medium text-foreground">
          {issue.dueDate ? new Date(issue.dueDate).toLocaleDateString(localeDateMap[locale]) : ""}
        </td>
      );
    }

    if (col.id === "assignee") {
      return (
        <td key={`column:${col.id}`} className="px-5 py-3.5">
          <InlineSelect
            value={issue.assigneeId || ""}
            options={assigneeInlineOptions}
            className="relative block w-full"
            onChange={(value) => handleInlineUpdate(issue.id, "assigneeId", value || null)}
            renderSummary={(label) => (
              <span className="block w-full cursor-pointer truncate border-none bg-transparent p-0 text-sm font-medium text-foreground outline-none focus:ring-0">
                {label}
              </span>
            )}
          />
        </td>
      );
    }

    return <td key={`column:${col.id}`}></td>;
  };

  const renderCustomFieldCell = (
    issue: Issue,
    field: CustomFieldDefinition,
    fieldValue: CustomFieldValue | PlanIssueFieldValue | undefined,
    onUpdate: (value: string | boolean | null) => void,
    keyPrefix: "issueField" | "planField"
  ) => {
    const displayValue = getFieldValueForDisplay(field, fieldValue);

    if (field.type === "BOOLEAN") {
      return (
        <td key={`${keyPrefix}:${field.id}`} className="px-5 py-3.5">
          <input
            type="checkbox"
            checked={fieldValue?.valueBoolean || false}
            onChange={(event) => onUpdate(event.target.checked)}
            className={issueListCheckboxClassName}
            aria-label={field.name}
          />
        </td>
      );
    }

    if (field.type === "SELECT") {
      const options = [
        { value: "", label: locale === "zh" ? "未选择" : "Not set" },
        ...getFieldOptions(field).map((option) => ({ value: option, label: option })),
      ];

      return (
        <td key={`${keyPrefix}:${field.id}`} className="px-5 py-3.5">
          <InlineSelect
            value={displayValue}
            options={options}
            className="relative block w-full"
            onChange={(value) => onUpdate(value || null)}
            renderSummary={(label) => (
              <span className="block w-full cursor-pointer truncate border-none bg-transparent p-0 text-sm font-medium text-foreground outline-none focus:ring-0">
                {label}
              </span>
            )}
          />
        </td>
      );
    }

    if (field.type === "DATE") {
      return (
        <td key={`${keyPrefix}:${field.id}`} className="px-5 py-3.5">
          <div className="[&_label]:sr-only" style={{ width: DATE_FIELD_INPUT_WIDTH }}>
            <ShadcnDatePicker
              id={`${keyPrefix}-${field.id}-${issue.id}`}
              label={field.name}
              locale={locale}
              value={displayValue}
              onChange={(value) => onUpdate(value || null)}
            />
          </div>
        </td>
      );
    }

    return (
      <td key={`${keyPrefix}:${field.id}`} className={`px-5 py-3.5 ${field.type === "LONG_TEXT" ? "align-top" : ""}`}>
        <FieldDraftInput
          field={field}
          value={displayValue}
          multiline={field.type === "LONG_TEXT"}
          onCommit={(value) => onUpdate(value)}
        />
      </td>
    );
  };

  const renderIssueTableCell = (issue: Issue, column: ResizableColumn) => {
    if (column.type === "column") {
      const columnConfig = columns.find((item) => item.id === column.id);
      return columnConfig ? renderColumnCell(issue, columnConfig) : <td key={getColumnOrderKey(column)} />;
    }

    if (column.type === "issueField") {
      const fieldValue = issue.issueFieldValues?.find((value) => value.fieldDefinitionId === column.id);
      return renderCustomFieldCell(
        issue,
        column.field,
        fieldValue,
        (value) => handleIssueFieldValueUpdate(issue.id, column.field, value),
        "issueField"
      );
    }

    const fieldValue = issue.planFieldValues?.find((value) => value.fieldDefinitionId === column.id);
    return renderCustomFieldCell(
      issue,
      column.field,
      fieldValue,
      (value) => handlePlanFieldValueUpdate(issue.id, column.field, value),
      "planField"
    );
  };

  const toggleIssueSelection = (issueId: string) => {
    setSelectedIssueIds((current) =>
      current.includes(issueId) ? current.filter((id) => id !== issueId) : [...current, issueId]
    );
  };

  const toggleCurrentPageSelection = () => {
    setSelectedIssueIds((current) => {
      if (allCurrentPageSelected) {
        return current.filter((issueId) => !paginatedIssueIds.includes(issueId));
      }

      return Array.from(new Set([...current, ...paginatedIssueIds]));
    });
  };

  const handleBulkSubmit = async (action: { type: BulkIssueActionType; targetId?: string | null }) => {
    const normalizedAction =
      action.type === "assignPlan" && action.targetId
        ? { type: "assignPlan" as const, targetId: action.targetId }
        : action.type === "removePlan"
          ? { type: "removePlan" as const }
          : action.type === "assignIteration" && action.targetId
            ? { type: "assignIteration" as const, targetId: action.targetId }
            : { type: "assignAssignee" as const, targetId: action.targetId ?? null };

    const result = await bulkUpdateIssues(selectedIssueIds, normalizedAction);
    if (!result.success) {
      return result.error || (locale === "zh" ? "批量更新失败" : "Bulk update failed");
    }

    setIssues((current) => {
      if (action.type === "removePlan" && lockedPlanId) {
        return current.filter((issue) => !selectedIssueIds.includes(issue.id));
      }

      if (
        action.type === "assignIteration" &&
        lockedIterationId &&
        action.targetId !== lockedIterationId
      ) {
        return current.filter((issue) => !selectedIssueIds.includes(issue.id));
      }

      return current.map((issue) => {
        if (!selectedIssueIds.includes(issue.id)) return issue;

        if (action.type === "assignPlan") {
          const targetPlan = plans.find((plan) => plan.id === action.targetId);
          return {
            ...issue,
            planId: action.targetId || null,
            plan: targetPlan ? { id: targetPlan.id, name: targetPlan.name } : null,
          };
        }

        if (action.type === "removePlan") {
          return {
            ...issue,
            planId: null,
            plan: null,
          };
        }

        if (action.type === "assignIteration") {
          const targetIteration = iterations.find((iteration) => iteration.id === action.targetId);
          return {
            ...issue,
            iterationId: action.targetId || null,
            iteration: targetIteration ? { name: targetIteration.name } : null,
          };
        }

        const targetUser = assigneeUsers.find((user) => user.id === action.targetId);
        return {
          ...issue,
          assigneeId: action.targetId || null,
          assignee: targetUser ? { name: targetUser.name } : null,
        };
      });
    });

    setSelectedIssueIds([]);
    setBulkAction(null);
    if (action.type === "assignIteration" && lockedIterationId) {
      router.refresh();
    }
    return null;
  };

  const openBulkAction = (action: BulkIssueActionType) => {
    setBulkActionNonce((current) => current + 1);
    setBulkAction(action);
  };

  const handleToggleColumnVisibility = (columnId: ColumnId) => {
    setVisibleColumnIds((current) => {
      if (current.includes(columnId)) {
        return current.length > 1 ? current.filter((id) => id !== columnId) : current;
      }

      return [...current, columnId];
    });
  };

  const handleTogglePlanFieldVisibility = (fieldId: string) => {
    setVisiblePlanFieldIds((current) =>
      current.includes(fieldId) ? current.filter((id) => id !== fieldId) : [...current, fieldId]
    );
  };

  const handleToggleIssueFieldVisibility = (fieldId: string) => {
    setVisibleIssueFieldIds((current) =>
      current.includes(fieldId) ? current.filter((id) => id !== fieldId) : [...current, fieldId]
    );
  };

  const handleResetColumns = () => {
    setVisibleColumnIds(defaultVisibleColumnIds);
    setColumnWidths(defaultColumnWidths);
    setVisibleIssueFieldIds(issueFields.map((field) => field.id));
    setIssueFieldWidths(
      issueFields.reduce(
        (acc, field) => {
          acc[field.id] = getDefaultFieldWidth(field);
          return acc;
        },
        {} as Record<string, number>
      )
    );
    setVisiblePlanFieldIds(planFields.map((field) => field.id));
    setPlanFieldWidths(
      planFields.reduce(
        (acc, field) => {
          acc[field.id] = getDefaultFieldWidth(field);
          return acc;
        },
        {} as Record<string, number>
      )
    );
    setColumnOrderKeys([
      ...defaultVisibleColumnIds.map((columnId) => `column:${columnId}`),
      ...issueFields.map((field) => `issueField:${field.id}`),
      ...planFields.map((field) => `planField:${field.id}`),
    ]);
  };

  const activeManagerFields = activeFieldManager === "issue" ? issueFields : planFields;
  const activeManagerTitle = fieldManagerLabel;
  const activeManagerSubmit = activeFieldManager === "issue" ? handleCreateIssueField : handleCreatePlanField;

  return (
    <div
      className={`flex flex-col flex-1 space-y-4 min-h-0 ${
        isFullscreen ? "fixed inset-0 z-40 bg-white p-4" : ""
      }`}
    >
      <div className={`sticky top-0 z-20 bg-background/95 p-3 backdrop-blur ${unframed ? "" : "rounded-lg border shadow-sm"}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex flex-wrap items-center gap-1">
            {viewOptions.map((option) => {
              const isActive = (view || "all") === option.value || (!view && option.value === "all");

              return (
                <Button
                  type="button"
                  key={option.value}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleViewChange(option.value)}
                >
                  {option.label}
                </Button>
              );
            })}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="gap-1 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsFilterRowOpen((current) => !current)}
              aria-expanded={isFilterRowOpen}
            >
              <span>{locale === "zh" ? "高级" : "Advanced"}</span>
              {activeAdvancedFilterCount > 0 ? (
                <span className="rounded-sm bg-muted px-1.5 text-xs text-muted-foreground">{activeAdvancedFilterCount}</span>
              ) : null}
              <ChevronDown className={`size-4 transition-transform ${isFilterRowOpen ? "rotate-180" : ""}`} />
            </Button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ColumnVisibilityMenu
              buttonLabel={columnsButtonLabel}
              resetLabel={resetColumnsLabel}
              columns={defaultColumns}
              visibleColumnIds={visibleColumnIds}
              onToggle={handleToggleColumnVisibility}
              onReset={handleResetColumns}
              issueFields={issueFields}
              visibleIssueFieldIds={visibleIssueFieldIds}
              onToggleIssueField={handleToggleIssueFieldVisibility}
              planFields={planFields}
              visiblePlanFieldIds={visiblePlanFieldIds}
              onTogglePlanField={handleTogglePlanFieldVisibility}
            />

            {canManageIssueFields ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setActiveFieldManager("issue")}
                title={customFieldsButtonLabel}
                aria-label={customFieldsButtonLabel}
              >
                <Settings2 />
              </Button>
            ) : null}

            {lockedPlanId && (canManagePlanFields ?? canManagePlans) ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setActiveFieldManager("plan")}
                title={customFieldsButtonLabel}
                aria-label={customFieldsButtonLabel}
              >
                <Settings2 />
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsFullscreen((current) => !current)}
              title={isFullscreen ? exitFullscreenLabel : fullscreenLabel}
              aria-label={isFullscreen ? exitFullscreenLabel : fullscreenLabel}
            >
              {isFullscreen ? <Minimize2 /> : <Maximize2 />}
            </Button>
          </div>
        </div>
        {isFilterRowOpen ? (
        <div className="flex w-full flex-wrap items-center gap-2">
          {!lockedIterationId && view !== "backlog" ? (
            <MultiFilter
              label={translations.issueList.sprint}
              options={sprintOptions}
              selectedValues={sprintFilter}
              onToggle={(value) => toggleFilterValue(value, "sprint", sprintFilter)}
              onClear={() => {
                updateQueryParams({ sprint: null });
              }}
              clearText={translations.issueList.clearSelection}
            />
          ) : null}

          <MultiFilter
            label={translations.issueList.status}
            options={statusOptions}
            selectedValues={statusFilter}
            onToggle={(value) => toggleFilterValue(value, "status", statusFilter)}
            onClear={() => {
              updateQueryParams({ status: null });
            }}
            clearText={translations.issueList.clearSelection}
          />

          <MultiFilter
            label={translations.issueList.type}
            options={typeOptions}
            selectedValues={typeFilter}
            onToggle={(value) => toggleFilterValue(value, "type", typeFilter)}
            onClear={() => {
              updateQueryParams({ type: null });
            }}
            clearText={translations.issueList.clearSelection}
          />

          <MultiFilter
            label={translations.issueList.priority}
            options={priorityOptions}
            selectedValues={priorityFilter}
            onToggle={(value) => toggleFilterValue(value, "priority", priorityFilter)}
            onClear={() => {
              updateQueryParams({ priority: null });
            }}
            clearText={translations.issueList.clearSelection}
          />

          {!lockedPlanId ? (
            <MultiFilter
              label={planLabel}
              options={planOptions}
              selectedValues={planFilter}
              onToggle={(value) => toggleFilterValue(value, "plan", planFilter)}
              onClear={() => {
                updateQueryParams({ plan: null });
              }}
              clearText={translations.issueList.clearSelection}
            />
          ) : null}

          {view !== "assignedToMe" ? (
            <MultiFilter
              label={translations.issueList.assignee}
              options={assigneeFilterOptions}
              selectedValues={assigneeFilter}
              onToggle={(value) => toggleFilterValue(value, "assignee", assigneeFilter)}
              onClear={() => {
                updateQueryParams({ assignee: null });
              }}
              clearText={translations.issueList.clearSelection}
            />
          ) : null}

          {view !== "overdue" && view !== "dueSoon" ? (
            <>
              <SingleFilter
                value={dueFilter}
                options={dueFilterOptions}
                onChange={(value) => {
                  updateQueryParams({ duePreset: null, dueFilter: value, dueDate: value === "ALL" ? null : dueDateValue });
                }}
                renderSummary={(label) => (
                  <div className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground">
                    <span className="text-muted-foreground">{translations.issueList.due}</span>
                    <span className="border-none bg-transparent p-0 font-medium text-foreground">{label}</span>
                    <ChevronDown size={14} className="text-muted-foreground" />
                  </div>
                )}
              />

              {dueFilter !== "ALL" ? (
                <div className="w-[190px] [&_label]:sr-only">
                <ShadcnDatePicker
                  id="issueDueDateFilter"
                  label={translations.issueList.due}
                  locale={locale}
                  value={dueDateValue}
                  onChange={(dueDate) => {
                    updateQueryParams({ duePreset: null, dueDate });
                  }}
                />
                </div>
              ) : null}
            </>
          ) : null}

          <AdvancedFieldFilters
            locale={locale}
            issueFields={issueFields}
            planFields={lockedPlanId ? planFields : []}
            searchParams={searchParams}
            updateQueryParams={updateQueryParams}
          />

          {activeFilterCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetFilters}
            >
              {locale === "zh" ? "重置" : "Reset"}
            </Button>
          ) : null}

        </div>
        ) : null}

        {lockedPlanId && planFieldSummary.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">{planFieldsLabel}</span>
            {planFieldSummary.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-md border bg-muted/45 px-2 py-1 text-xs text-muted-foreground"
              >
                <span>{item.label}</span>
                <span className="font-semibold text-foreground">{item.value}</span>
              </span>
            ))}
          </div>
        ) : null}

        {selectedIssueIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 shadow-xs">
            <span className="text-sm font-semibold text-primary">
              {selectedIssuesLabel} {selectedIssueIds.length}
            </span>
            {!lockedPlanId && canManagePlans ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openBulkAction("assignPlan")}
              >
                {bulkAddToPlanLabel}
              </Button>
            ) : null}
            {canManagePlans ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openBulkAction("removePlan")}
              >
                {bulkRemovePlanLabel}
              </Button>
            ) : null}
            {!lockedPlanId && (!lockedIterationId || canMoveIssuesBetweenIterations) ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openBulkAction("assignIteration")}
              >
                {bulkAddToSprintLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIssueIds([])}
            >
              {bulkClearLabel}
            </Button>
          </div>
        ) : null}
      </div>

      <div className={`flex flex-1 flex-col overflow-hidden bg-card ${unframed ? "" : "rounded-xl border shadow-sm"}`}>
        <div className="relative overflow-x-auto flex-1">
          <table
            className="text-left text-sm whitespace-nowrap"
            style={{ tableLayout: "fixed", width: `max(100%, ${columnsTotalWidth + 48}px)` }}
          >
            <thead className="sticky top-0 z-10 border-b bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="h-12 w-12 px-4 py-0 align-middle">
                  <input
                    type="checkbox"
                    checked={allCurrentPageSelected}
                    onChange={toggleCurrentPageSelection}
                    aria-label={locale === "zh" ? "选择当前页全部问题" : "Select all issues on this page"}
                    className={issueListCheckboxClassName}
                  />
                </th>
                {resizableColumns.map((column, index) => {
                  const columnKey = getColumnOrderKey(column);
                  const columnSortField = column.type === "column" ? COLUMN_SORT_FIELD_MAP[column.id] : undefined;
                  const isSortedColumn = !!columnSortField && sortBy === columnSortField;
                  const showLeftLine =
                    dragOverIndex === index && dragOverSide === "left" && dragSourceIndex !== index;
                  const showRightLine =
                    dragOverIndex === index && dragOverSide === "right" && dragSourceIndex !== index;
                  const isDragging = dragSourceIndex === index;
                  const label = column.type === "column" ? column.label : column.field.name;

                  return (
                    <th
                      key={columnKey}
                      className={`group/column relative h-12 cursor-move select-none overflow-hidden px-5 py-0 align-middle transition-colors hover:bg-muted active:cursor-move ${
                        isDragging ? "opacity-40" : ""
                      }`}
                      style={{ width: `${column.width}px` }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragLeave={() => {
                        if (dragOverIndex === index) {
                          setDragOverIndex(null);
                          setDragOverSide(null);
                        }
                      }}
                    >
                      {showLeftLine && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 z-10" />}

                      {column.type === "column" ? (
                        <button
                          type="button"
                          onClick={() => handleSortByColumn(column.id)}
                          disabled={!columnSortField}
                          className={`inline-flex max-w-full min-w-0 items-center gap-1 font-semibold ${
                            columnSortField
                              ? "cursor-pointer text-muted-foreground hover:text-foreground"
                              : "cursor-move text-muted-foreground"
                          }`}
                          draggable={false}
                        >
                          <span className="truncate">{label}</span>
                          {columnSortField && isSortedColumn ? (
                            sortDirection === "asc" ? (
                              <ArrowUp size={12} />
                            ) : (
                              <ArrowDown size={12} />
                            )
                          ) : null}
                        </button>
                      ) : (
                        <span className="inline-flex max-w-full min-w-0 items-center gap-1 font-semibold text-muted-foreground">
                          <span className="truncate">{label}</span>
                          {column.field.required ? <span className="text-red-500">*</span> : null}
                        </span>
                      )}

                      {showRightLine && <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-blue-500 z-10" />}

                      <div
                        className="absolute bottom-0 right-0 top-0 z-20 w-4 cursor-ew-resize"
                        onMouseDown={(e) => handleResizeStart(e, index)}
                        draggable={false}
                        title={locale === "zh" ? "拖拽调整列宽" : "Drag to resize column"}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {paginatedIssues.map((issue) => (
                <tr key={issue.id} className="hover:bg-muted/45 transition-colors group">
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={selectedIssueIds.includes(issue.id)}
                      onChange={() => toggleIssueSelection(issue.id)}
                      aria-label={locale === "zh" ? `选择问题 ${issue.key}` : `Select issue ${issue.key}`}
                      className={issueListCheckboxClassName}
                    />
                  </td>
                  {resizableColumns.map((column) => renderIssueTableCell(issue, column))}
                </tr>
              ))}
            </tbody>
          </table>
          {(totalIssues || issues.length) === 0 ? (
            <div className="pointer-events-none sticky left-0 flex min-h-52 w-full items-center justify-center px-5 py-16 text-center text-muted-foreground">
              <div>
                <p className="mb-1 text-base font-medium text-foreground">{translations.issueList.noMatchTitle}</p>
                <p className="text-sm">{translations.issueList.noMatchDesc}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3 text-sm">
          <div className="font-medium text-muted-foreground">
            {locale === "zh" ? (
              <>
                {translations.issueList.showing}
                <span className="font-bold text-foreground">
                  {" "}
                  {(totalIssues || issues.length) > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}{" "}
                </span>
                {translations.issueList.to}
                <span className="font-bold text-foreground">
                  {" "}
                  {Math.min(currentPage * itemsPerPage, (totalIssues || issues.length))}{" "}
                </span>
                {translations.issueList.of}
                <span className="font-bold text-foreground"> {(totalIssues || issues.length)} </span>
                {translations.issueList.issues}
              </>
            ) : (
              <>
                {translations.issueList.showing}{" "}
                <span className="font-bold text-foreground">
                  {(totalIssues || issues.length) > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}
                </span>{" "}
                {translations.issueList.to}{" "}
                <span className="font-bold text-foreground">
                  {Math.min(currentPage * itemsPerPage, (totalIssues || issues.length))}
                </span>{" "}
                {translations.issueList.of} <span className="font-bold text-foreground">{(totalIssues || issues.length)}</span>{" "}
                {translations.issueList.issues}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{translations.issueList.perPage}</span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={(value) => {
                  updateQueryParams({ pageSize: value, page: "1" });
                }}
              >
                <SelectTrigger size="sm" className="w-20 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {perPageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => updateQueryParams({ page: String(Math.max(1, currentPage - 1)) })}
                disabled={currentPage === 1}
              >
                <ArrowLeft size={18} />
              </Button>

              <span className="min-w-24 px-2 text-center font-medium leading-none text-foreground">
                {locale === "zh"
                  ? `${translations.issueList.page} ${currentPage} / ${totalPages || 1}`
                  : `${translations.issueList.page} ${currentPage} of ${totalPages || 1}`}
              </span>

              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => updateQueryParams({ page: String(Math.min(totalPages || 1, currentPage + 1)) })}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <BulkIssueActionModal
        key={`${bulkAction ?? "closed"}-${bulkActionNonce}`}
        isOpen={bulkAction !== null}
        actionType={bulkAction}
        selectedCount={selectedIssueIds.length}
        plans={plans}
        iterations={iterations}
        users={assigneeUsers}
        locale={locale}
        onClose={() => setBulkAction(null)}
        onSubmit={handleBulkSubmit}
      />

      {activeFieldManager ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">{activeManagerTitle}</h3>
              <button
                type="button"
                onClick={() => setActiveFieldManager(null)}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label={closeLabel}
              >
                <X size={18} />
              </button>
            </div>

            <div ref={fieldManagerScrollRef} className="max-h-[70vh] overflow-y-auto p-5">
              <div className="space-y-2">
                {activeManagerFields.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    {noFieldsLabel}
                  </div>
                ) : (
                  activeManagerFields.map((field) => (
                    <div key={field.id} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-slate-800">{field.name}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                              {field.type}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-slate-400">{field.key}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditField(field)}
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            aria-label={editFieldLabel}
                            title={editFieldLabel}
                          >
                            <Settings2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              activeFieldManager === "issue"
                                ? handleDeleteIssueField(field as IssueFieldDefinition)
                                : handleDeletePlanField(field as PlanFieldDefinition)
                            }
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            aria-label={deleteFieldLabel}
                            title={deleteFieldLabel}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {editingFieldId === field.id ? (
                        <form onSubmit={(event) => handleUpdateField(event, field)} className="mt-3 border-t border-slate-100 pt-3">
                          <div className="grid gap-3 md:grid-cols-3">
                            <label className="space-y-1 text-sm">
                              <span className="font-medium text-slate-600">{fieldNameLabel}</span>
                              <input
                                type="text"
                                value={editFieldForm.name}
                                onChange={(event) => {
                                  setFieldManagerError(null);
                                  setEditFieldForm((current) => ({ ...current, name: event.target.value }));
                                }}
                                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-500"
                                required
                              />
                            </label>
                            <label className="space-y-1 text-sm">
                              <span className="font-medium text-slate-600">{fieldKeyLabel}</span>
                              <input
                                type="text"
                                value={editFieldForm.key}
                                disabled
                                className="h-9 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
                              />
                            </label>
                            <label className="space-y-1 text-sm">
                              <span className="font-medium text-slate-600">{fieldTypeLabel}</span>
                              <input
                                type="text"
                                value={fieldTypeOptions.find((option) => option.value === editFieldForm.type)?.label || editFieldForm.type}
                                disabled
                                className="h-9 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
                              />
                            </label>
                            {editFieldForm.type === "SELECT" ? (
                              <>
                                <label className="space-y-1 text-sm md:col-span-3">
                                  <span className="font-medium text-slate-600">{fieldOptionsLabel}</span>
                                  <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2">
                                    {getFieldOptions(field).map((option) => (
                                      <span key={option} className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-500">
                                        {option}
                                      </span>
                                    ))}
                                  </div>
                                </label>
                                <label className="space-y-1 text-sm md:col-span-3">
                                  <span className="font-medium text-slate-600">{fieldNewOptionsLabel}</span>
                                  <input
                                    type="text"
                                    value={editFieldForm.newOptionsText}
                                    onChange={(event) => {
                                      setFieldManagerError(null);
                                      setEditFieldForm((current) => ({ ...current, newOptionsText: event.target.value }));
                                    }}
                                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-500"
                                    placeholder={fieldOptionsPlaceholder}
                                  />
                                </label>
                              </>
                            ) : null}
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={handleCancelEditField}
                              className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                            >
                              {cancelLabel}
                            </button>
                            <button
                              type="submit"
                              className="inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
                            >
                              {saveLabel}
                            </button>
                          </div>
                          {fieldManagerError ? <p className="mt-3 text-sm text-red-600">{fieldManagerError}</p> : null}
                        </form>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={activeManagerSubmit} className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-600">{fieldNameLabel}</span>
                    <input
                      type="text"
                      value={fieldForm.name}
                      onChange={(event) => setFieldForm((current) => ({ ...current, name: event.target.value }))}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-600">{fieldKeyLabel}</span>
                    <input
                      type="text"
                      value={fieldForm.key}
                      onChange={(event) => {
                        setFieldManagerError(null);
                        setFieldForm((current) => ({ ...current, key: event.target.value }));
                      }}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-500"
                      placeholder="api_count"
                      pattern="[A-Za-z_][A-Za-z0-9_]*"
                      maxLength={40}
                      title={fieldKeyInvalidLabel}
                      required
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-600">{fieldTypeLabel}</span>
                    <Select
                      value={fieldForm.type}
                      onValueChange={(value) => {
                        setFieldManagerError(null);
                        setFieldForm((current) => ({ ...current, type: value as PlanFieldType }));
                      }}
                    >
                      <SelectTrigger className="h-9 w-full border-slate-200 bg-white text-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  {fieldForm.type === "SELECT" ? (
                    <label className="space-y-1 text-sm md:col-span-3">
                      <span className="font-medium text-slate-600">{fieldOptionsLabel}</span>
                      <input
                        type="text"
                        value={fieldForm.optionsText}
                        onChange={(event) => {
                          setFieldManagerError(null);
                          setFieldForm((current) => ({ ...current, optionsText: event.target.value }));
                        }}
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-500"
                        placeholder={fieldOptionsPlaceholder}
                      />
                    </label>
                  ) : null}
                </div>
                {!editingFieldId && fieldManagerError ? <p className="mt-3 text-sm text-red-600">{fieldManagerError}</p> : null}
                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
                  >
                    <span>{addFieldLabel}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
