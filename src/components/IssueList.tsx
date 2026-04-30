"use client";

import { useState, useTransition, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  ListFilter,
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
  updateIssue,
  updateIssueFieldValue,
} from "@/app/actions/issues";
import {
  createPlanFieldDefinition,
  deletePlanFieldDefinition,
  updatePlanIssueFieldValue,
} from "@/app/actions/plans";
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
  sortWorkflowStatuses,
  type WorkflowStatusRecord,
  type WorkflowTransitionRecord,
} from "@/lib/workflows";
import LocalizedDateInput from "./LocalizedDateInput";

type Issue = {
  id: string;
  projectId: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  type: string;
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

type PlanFieldType = "BOOLEAN" | "NUMBER" | "TEXT" | "LONG_TEXT" | "SELECT";

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

type ColumnId = "key" | "title" | "plan" | "iteration" | "status" | "type" | "priority" | "dueDate" | "assignee";
type ColumnConfig = {
  id: ColumnId;
  label: string;
  width: number;
};

type StoredIssueListColumnPreferences = {
  visibleColumnIds?: ColumnId[];
  columnWidths?: Partial<Record<ColumnId, number>>;
  visibleIssueFieldIds?: string[];
  issueFieldWidths?: Partial<Record<string, number>>;
  visiblePlanFieldIds?: string[];
  planFieldWidths?: Partial<Record<string, number>>;
};

type SortField = "createdAt" | "key" | "title" | "plan" | "status" | "type" | "priority" | "dueDate" | "sprint" | "assignee";
type DueFilterValue = "ALL" | "EQ" | "GTE" | "LTE";

const BACKLOG_FILTER_VALUE = "__BACKLOG__";

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
      <summary className="list-none h-9 px-3 inline-flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors cursor-pointer select-none">
        <span className="truncate max-w-40">{buttonText}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </summary>
      <div className="absolute z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-xl p-2 space-y-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-slate-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedValues.includes(option.value)}
              onChange={() => onToggle(option.value)}
              className="h-4 w-4"
            />
            <span className="text-slate-700">{option.label}</span>
          </label>
        ))}
        {selectedValues.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="w-full text-left px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md border-t border-slate-100 mt-1 pt-2"
          >
            {clearText}
          </button>
        )}
      </div>
    </details>
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
      <summary
        className="list-none h-9 w-9 inline-flex items-center justify-center text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors cursor-pointer select-none"
        aria-label={buttonLabel}
        title={buttonLabel}
      >
        <Eye size={16} className="text-slate-500" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-xl p-2 space-y-1">
        {columns.map((column) => {
          const isChecked = visibleColumnIds.includes(column.id);
          const isDisabled = isChecked && visibleCount === 1;

          return (
            <label
              key={column.id}
              className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-md ${
                isDisabled ? "cursor-not-allowed text-slate-400" : "hover:bg-slate-50 cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isDisabled}
                onChange={() => onToggle(column.id)}
                className="h-4 w-4"
              />
              <span>{column.label}</span>
            </label>
          );
        })}
        {issueFields.length > 0 ? (
          <div className="mt-1 border-t border-slate-100 pt-1">
            {issueFields.map((field) => (
              <label
                key={field.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={visibleIssueFieldIds.includes(field.id)}
                  onChange={() => onToggleIssueField?.(field.id)}
                  className="h-4 w-4"
                />
                <span className="truncate">{field.name}</span>
              </label>
            ))}
          </div>
        ) : null}
        {planFields.length > 0 ? (
          <div className="mt-1 border-t border-slate-100 pt-1">
            {planFields.map((field) => (
              <label
                key={field.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={visiblePlanFieldIds.includes(field.id)}
                  onChange={() => onTogglePlanField?.(field.id)}
                  className="h-4 w-4"
                />
                <span className="truncate">{field.name}</span>
              </label>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          onClick={onReset}
          className="w-full text-left px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md border-t border-slate-100 mt-1 pt-2"
        >
          {resetLabel}
        </button>
      </div>
    </details>
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
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const allFields = [
    ...issueFields.map((field) => ({ ...field, source: "issue" as const })),
    ...planFields.map((field) => ({ ...field, source: "plan" as const })),
  ];
  const activeCount = allFields.filter((field) =>
    searchParams.get(`${field.source === "plan" ? "planField" : "issueField"}_${field.id}_op`)
  ).length;
  const label = locale === "zh" ? "高级筛选" : "Advanced";
  const clearLabel = locale === "zh" ? "清除" : "Clear";
  const valueLabel = locale === "zh" ? "筛选值" : "Value";
  const noFieldsLabel = locale === "zh" ? "暂无可筛选的扩展字段" : "No custom fields to filter";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    <details ref={detailsRef} className="relative">
      <summary className="list-none h-9 px-3 inline-flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors cursor-pointer select-none">
        <Settings2 size={14} className="text-slate-400" />
        <span>{activeCount > 0 ? `${label} (${activeCount})` : label}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-[min(92vw,520px)] rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
        {allFields.length === 0 ? (
          <p className="px-1 py-2 text-sm text-slate-500">{noFieldsLabel}</p>
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
                <div key={`${field.source}-${field.id}`} className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-2 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-700">{field.name}</div>
                    <div className="text-xs text-slate-400">{field.source === "plan" ? (locale === "zh" ? "计划扩展列" : "Plan field") : (locale === "zh" ? "问题扩展字段" : "Issue field")}</div>
                  </div>
                  <select
                    value={op}
                    onChange={(event) => updateFieldFilter(field, event.target.value, value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                    aria-label={field.name}
                  >
                    <option value="">{locale === "zh" ? "不限" : "Any"}</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {needsValue && field.type === "BOOLEAN" ? (
                    <select
                      value={value || "true"}
                      onChange={(event) => updateFieldFilter(field, op, event.target.value)}
                      className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                      aria-label={valueLabel}
                    >
                      <option value="true">{locale === "zh" ? "是" : "Yes"}</option>
                      <option value="false">{locale === "zh" ? "否" : "No"}</option>
                    </select>
                  ) : needsValue && field.type === "SELECT" ? (
                    <select
                      value={value}
                      onChange={(event) => updateFieldFilter(field, op, event.target.value)}
                      className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                      aria-label={valueLabel}
                    >
                      <option value="">{locale === "zh" ? "请选择" : "Select"}</option>
                      {fieldOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : needsValue ? (
                    <input
                      type={field.type === "NUMBER" ? "number" : "text"}
                      value={value}
                      onChange={(event) => updateFieldFilter(field, op, event.target.value)}
                      placeholder={valueLabel}
                      className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                      aria-label={valueLabel}
                    />
                  ) : (
                    <div className="hidden sm:block" />
                  )}
                  <button
                    type="button"
                    onClick={() => clearFieldFilter(field)}
                    className="h-9 rounded-md px-2 text-sm text-slate-500 hover:bg-white hover:text-slate-700"
                  >
                    {clearLabel}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </details>
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
      <div className="absolute z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-xl p-2 space-y-1">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              option.value === value ? "bg-slate-100 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </details>
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
          className="fixed z-50 flex max-w-56 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
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
                option.value === value ? "bg-slate-100 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"
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
  if (field.type === "TEXT" || field.type === "LONG_TEXT") return 240;
  return 150;
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
  const isFocusedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    if (!multiline || !textareaRef.current) return;

    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [draft, multiline]);

  const commitDraft = () => {
    isFocusedRef.current = false;
    if (draft !== value) {
      onCommit(draft);
    }
  };

  if (multiline) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={commitDraft}
        onChange={(event) => setDraft(event.target.value)}
        rows={1}
        className="block w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent text-sm font-medium leading-5 text-slate-700 outline-none hover:border-slate-200 focus:border-blue-300 focus:bg-white focus:ring-1 focus:ring-blue-500"
        aria-label={field.name}
      />
    );
  }

  return (
    <input
      type={field.type === "NUMBER" ? "number" : "text"}
      value={draft}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={commitDraft}
      onChange={(event) => setDraft(event.target.value)}
      className="h-8 w-full rounded-md border border-transparent bg-transparent text-sm font-medium text-slate-700 outline-none hover:border-slate-200 focus:border-blue-300 focus:bg-white focus:ring-1 focus:ring-blue-500"
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
  planFieldDefinitions = [],
  canManagePlanFields,
  canManagePlans,
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
  planFieldDefinitions?: PlanFieldDefinition[];
  canManagePlanFields?: boolean;
  canManagePlans: boolean;
  unframed?: boolean;
}) {
  const searchParams = useSearchParams();
  const [issues, setIssues] = useState(initialIssues);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [isSearchOpen, setIsSearchOpen] = useState(() => Boolean(searchParams.get("search")));
  const translations = getTranslations(locale);
  const planLabel = locale === "zh" ? "计划" : "Plan";
  const columnsButtonLabel = locale === "zh" ? "显示列" : "Columns";
  const resetColumnsLabel = locale === "zh" ? "重置列" : "Reset columns";
  const noPlanLabel = locale === "zh" ? "未设置计划" : "No plan";
  const selectedIssuesLabel = locale === "zh" ? "已选" : "Selected";
  const bulkAddToPlanLabel = locale === "zh" ? "加入计划" : "Add to plan";
  const bulkRemovePlanLabel = locale === "zh" ? "移出计划" : "Remove plan";
  const bulkAddToSprintLabel = locale === "zh" ? "加入迭代" : "Add to sprint";
  const bulkClearLabel = locale === "zh" ? "取消选择" : "Clear selection";
  const planFieldsLabel = locale === "zh" ? "扩展列" : "Custom fields";
  const issueFieldsLabel = locale === "zh" ? "扩展字段" : "Custom fields";
  const planFieldsManagerLabel = locale === "zh" ? "扩展列" : "Plan fields";
  const issueFieldsManagerLabel = locale === "zh" ? "扩展字段" : "Custom fields";
  const addFieldLabel = locale === "zh" ? "新增字段" : "Add field";
  const fieldNameLabel = locale === "zh" ? "字段名称" : "Field name";
  const fieldKeyLabel = locale === "zh" ? "字段标识" : "Field key";
  const fieldTypeLabel = locale === "zh" ? "字段类型" : "Field type";
  const fieldOptionsLabel = locale === "zh" ? "下拉选项" : "Select options";
  const fieldOptionsPlaceholder = locale === "zh" ? "用逗号或者空格分隔" : "Separate with commas or spaces";
  const noFieldsLabel = locale === "zh" ? "还没有配置扩展列" : "No custom fields yet";
  const saveFailedLabel = locale === "zh" ? "保存失败" : "Save failed";
  const deleteFieldLabel = locale === "zh" ? "删除字段" : "Delete field";
  const closeLabel = locale === "zh" ? "关闭" : "Close";
  const fieldTypeOptions = useMemo<FilterOption[]>(
    () => [
      { value: "BOOLEAN", label: locale === "zh" ? "是/否" : "Yes / no" },
      { value: "NUMBER", label: locale === "zh" ? "数字" : "Number" },
      { value: "TEXT", label: locale === "zh" ? "文本" : "Text" },
      { value: "LONG_TEXT", label: locale === "zh" ? "多行文本" : "Long text" },
      { value: "SELECT", label: locale === "zh" ? "下拉选择" : "Select" },
    ],
    [locale]
  );
  const fullscreenLabel = locale === "zh" ? "全屏显示" : "Fullscreen";
  const exitFullscreenLabel = locale === "zh" ? "退出全屏" : "Exit fullscreen";
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
  const { statusFilter, typeFilter, priorityFilter, planFilter, sprintFilter, assigneeFilter, watcherFilter, view, dueFilter, dueDateValue, duePreset, search: searchParamsSearch } = filters;
  const { page: currentPage, pageSize: itemsPerPage } = pagination;
  const { sortBy, sortDirection } = sorting;
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeFieldManager, setActiveFieldManager] = useState<"issue" | "plan" | null>(null);
  const [fieldForm, setFieldForm] = useState({
    name: "",
    key: "",
    type: "BOOLEAN" as PlanFieldType,
    optionsText: "",
  });
  const [fieldManagerError, setFieldManagerError] = useState<string | null>(null);

  const [, startTransition] = useTransition();
  const columnStorageKey = useMemo(
    () => (lockedPlanId ? ISSUE_LIST_COLUMN_STORAGE_KEYS.plan : ISSUE_LIST_COLUMN_STORAGE_KEYS.default),
    [lockedPlanId]
  );

  const defaultColumns = useMemo<ColumnConfig[]>(
    () => [
      { id: "key", label: translations.issueList.key, width: 80 },
      { id: "title", label: translations.issueList.summary, width: 0 },
      ...(lockedPlanId ? [] : [{ id: "plan" as const, label: planLabel, width: 180 }]),
      { id: "iteration", label: translations.issueList.sprint, width: 160 },
      { id: "status", label: translations.issueList.status, width: 140 },
      { id: "type", label: translations.issueList.type, width: 120 },
      { id: "priority", label: translations.issueList.priority, width: 140 },
      { id: "dueDate", label: translations.issueList.due, width: 140 },
      { id: "assignee", label: translations.issueList.assignee, width: 190 },
    ],
    [
      lockedPlanId,
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
        const nextVisibleColumnIds = [...visibleColumnIds];
        const [removed] = nextVisibleColumnIds.splice(sourceIndex, 1);
        const adjustedTarget =
          dragOverSide === "right"
            ? sourceIndex < targetIndex
              ? targetIndex
              : targetIndex + 1
            : sourceIndex < targetIndex
              ? targetIndex - 1
              : targetIndex;
        nextVisibleColumnIds.splice(Math.max(0, adjustedTarget), 0, removed);
        setVisibleColumnIds(nextVisibleColumnIds);
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

  const resizingRef = useRef<{ colIndex: number; startX: number; startWidth: number } | null>(null);
  const issueFieldResizingRef = useRef<{ fieldId: string; startX: number; startWidth: number } | null>(null);
  const planFieldResizingRef = useRef<{ fieldId: string; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, colIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      const col = columns[colIndex];
      const startWidth = col.width || 150;
      resizingRef.current = { colIndex, startX: e.clientX, startWidth };

      const onMouseMove = (ev: MouseEvent) => {
        const resizeState = resizingRef.current;
        if (!resizeState) return;

        const delta = ev.clientX - resizeState.startX;
        const newWidth = Math.max(60, resizeState.startWidth + delta);
        const resizeColIndex = resizeState.colIndex;
        const resizeColumnId = columns[resizeColIndex]?.id;

        if (!resizeColumnId) return;

        setColumnWidths((prev) => ({ ...prev, [resizeColumnId]: newWidth }));
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
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [columns]
  );

  const handlePlanFieldResizeStart = useCallback(
    (e: React.MouseEvent, field: PlanFieldDefinition) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = planFieldWidths[field.id] || getDefaultFieldWidth(field);
      planFieldResizingRef.current = { fieldId: field.id, startX: e.clientX, startWidth };

      const onMouseMove = (ev: MouseEvent) => {
        const resizeState = planFieldResizingRef.current;
        if (!resizeState) return;

        const delta = ev.clientX - resizeState.startX;
        const newWidth = Math.max(80, resizeState.startWidth + delta);
        setPlanFieldWidths((prev) => ({ ...prev, [resizeState.fieldId]: newWidth }));
      };

      const onMouseUp = () => {
        planFieldResizingRef.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [planFieldWidths]
  );

  const handleIssueFieldResizeStart = useCallback(
    (e: React.MouseEvent, field: IssueFieldDefinition) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = issueFieldWidths[field.id] || getDefaultFieldWidth(field);
      issueFieldResizingRef.current = { fieldId: field.id, startX: e.clientX, startWidth };

      const onMouseMove = (ev: MouseEvent) => {
        const resizeState = issueFieldResizingRef.current;
        if (!resizeState) return;

        const delta = ev.clientX - resizeState.startX;
        const newWidth = Math.max(80, resizeState.startWidth + delta);
        setIssueFieldWidths((prev) => ({ ...prev, [resizeState.fieldId]: newWidth }));
      };

      const onMouseUp = () => {
        issueFieldResizingRef.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [issueFieldWidths]
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
    const currentIssueFieldIds = new Set(issueFields.map((field) => field.id));
    const validVisibleIssueFieldIds = storedPreferences?.visibleIssueFieldIds?.filter((fieldId) =>
      currentIssueFieldIds.has(fieldId)
    );
    const validIssueFieldWidths = Object.entries(storedPreferences?.issueFieldWidths || {}).reduce(
      (acc, [fieldId, width]) => {
        if (currentIssueFieldIds.has(fieldId) && typeof width === "number" && width >= 80) {
          acc[fieldId] = width;
        }
        return acc;
      },
      {} as Record<string, number>
    );
    const currentPlanFieldIds = new Set(planFields.map((field) => field.id));
    const validVisiblePlanFieldIds = storedPreferences?.visiblePlanFieldIds?.filter((fieldId) =>
      currentPlanFieldIds.has(fieldId)
    );
    const validPlanFieldWidths = Object.entries(storedPreferences?.planFieldWidths || {}).reduce(
      (acc, [fieldId, width]) => {
        if (currentPlanFieldIds.has(fieldId) && typeof width === "number" && width >= 80) {
          acc[fieldId] = width;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    setVisibleColumnIds(validVisibleColumnIds && validVisibleColumnIds.length > 0 ? validVisibleColumnIds : defaultVisibleColumnIds);
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
      } satisfies StoredIssueListColumnPreferences)
    );
  }, [columnStorageKey, columnWidths, hasLoadedColumnPreferences, issueFieldWidths, planFieldWidths, visibleColumnIds, visibleIssueFieldIds, visiblePlanFieldIds]);

  useEffect(() => {
    setSearch(searchParamsSearch);
    if (searchParamsSearch) {
      setIsSearchOpen(true);
    }
  }, [searchParamsSearch]);

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
      { value: "backlog", label: translations.issueList.backlog },
      { value: "overdue", label: translations.issueList.overdue },
      { value: "dueSoon", label: translations.issueList.dueSoon },
      { value: "assignedToMe", label: translations.issueList.assignedToMe },
      { value: "watching", label: locale === "zh" ? "我关注" : "Watching" },
    ],
    [
      locale,
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
          valueText: field.type === "TEXT" ? (typeof value === "string" ? value : value === null ? null : String(value)) : null,
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
            field.type === "TEXT" || field.type === "LONG_TEXT"
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
    startTransition(async () => {
      const result = await createPlanFieldDefinition({
        planId: lockedPlanId,
        name: fieldForm.name,
        key: fieldForm.key,
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
    startTransition(async () => {
      const result = await createIssueFieldDefinition({
        projectId: activeProjectId,
        name: fieldForm.name,
        key: fieldForm.key,
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
          if (field.type === "BOOLEAN") {
            const count = issues.filter((issue) =>
              issue.planFieldValues?.some((value) => value.fieldDefinitionId === field.id && value.valueBoolean)
            ).length;
            return { id: field.id, label: field.name, value: count };
          }

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
  const visiblePlanFields = useMemo(
    () => planFields.filter((field) => visiblePlanFieldIds.includes(field.id)),
    [planFields, visiblePlanFieldIds]
  );
  const visibleIssueFields = useMemo(
    () => issueFields.filter((field) => visibleIssueFieldIds.includes(field.id)),
    [issueFields, visibleIssueFieldIds]
  );

  const paginatedIssueIds = paginatedIssues.map((issue) => issue.id);
  const allCurrentPageSelected =
    paginatedIssueIds.length > 0 && paginatedIssueIds.every((issueId) => selectedIssueIds.includes(issueId));

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
  };

  const activeManagerFields = activeFieldManager === "issue" ? issueFields : planFields;
  const activeManagerTitle = activeFieldManager === "issue" ? issueFieldsManagerLabel : planFieldsManagerLabel;
  const activeManagerSubmit = activeFieldManager === "issue" ? handleCreateIssueField : handleCreatePlanField;

  return (
    <div
      className={`flex flex-col flex-1 space-y-4 min-h-0 ${
        isFullscreen ? "fixed inset-0 z-40 bg-white p-4" : ""
      }`}
    >
      <div className={`bg-white p-3 sticky top-0 z-20 ${unframed ? "" : "rounded-lg border shadow-sm"}`}>
        {!lockedPlanId ? (
          <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-slate-100 pb-3">
            {viewOptions.map((option) => {
              const isActive = (view || "all") === option.value || (!view && option.value === "all");

              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => handleViewChange(option.value)}
                  className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 w-full">
          <div className={`flex items-center gap-2 ${isSearchOpen ? "w-full lg:w-80" : "w-auto"} relative`}>
            {isSearchOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="absolute left-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={locale === "zh" ? "收起搜索" : "Collapse search"}
                  title={locale === "zh" ? "收起搜索" : "Collapse search"}
                >
                  <Search size={14} />
                </button>
                <input
                  type="text"
                  placeholder={translations.issueList.searchPlaceholder}
                  value={search}
                  autoFocus
                  onChange={(e) => {
                    setSearch(e.target.value); updateQueryParams({ search: e.target.value });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && !search) {
                      setIsSearchOpen(false);
                    }
                  }}
                  className="w-full pl-9 pr-9 py-2 text-sm border-slate-200 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      updateQueryParams({ search: null });
                    }}
                    className="absolute right-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label={locale === "zh" ? "清除搜索" : "Clear search"}
                    title={locale === "zh" ? "清除搜索" : "Clear search"}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label={translations.issueList.searchPlaceholder}
                title={translations.issueList.searchPlaceholder}
              >
                <Search size={16} />
              </button>
            )}
          </div>

          <div className="h-9 px-2 inline-flex items-center text-slate-500">
            <ListFilter size={14} />
          </div>

          {view !== "backlog" ? (
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
                  <div className="h-9 px-3 inline-flex items-center gap-2 text-sm bg-slate-50 border border-slate-200 rounded-md">
                    <span className="text-slate-500">{translations.issueList.due}</span>
                    <span className="bg-transparent font-medium p-0 border-none text-slate-700">{label}</span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </div>
                )}
              />

              {dueFilter !== "ALL" ? (
                <LocalizedDateInput
                  locale={locale}
                  aria-label={translations.issueList.due}
                  value={dueDateValue}
                  onChange={(e) => {
                    updateQueryParams({ duePreset: null, dueDate: e.target.value });
                  }}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
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

          {canManageIssueFields ? (
            <button
              type="button"
              onClick={() => setActiveFieldManager("issue")}
              className="h-9 px-3 inline-flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
            >
              <Settings2 size={14} className="text-slate-400" />
              <span>{issueFieldsManagerLabel}</span>
            </button>
          ) : null}

          {lockedPlanId && (canManagePlanFields ?? canManagePlans) ? (
            <button
              type="button"
              onClick={() => setActiveFieldManager("plan")}
              className="h-9 px-3 inline-flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
            >
              <Settings2 size={14} className="text-slate-400" />
              <span>{planFieldsManagerLabel}</span>
            </button>
          ) : null}

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

          <button
            type="button"
            onClick={() => setIsFullscreen((current) => !current)}
            className="h-9 w-9 inline-flex items-center justify-center text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
            title={isFullscreen ? exitFullscreenLabel : fullscreenLabel}
            aria-label={isFullscreen ? exitFullscreenLabel : fullscreenLabel}
          >
            {isFullscreen ? <Minimize2 size={14} className="text-slate-400" /> : <Maximize2 size={14} className="text-slate-400" />}
          </button>
        </div>

        {lockedPlanId && planFieldSummary.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-slate-400">{planFieldsLabel}</span>
            {planFieldSummary.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
              >
                <span>{item.label}</span>
                <span className="font-semibold text-slate-900">{item.value}</span>
              </span>
            ))}
          </div>
        ) : null}

        {selectedIssueIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
            <span className="text-sm font-semibold text-blue-900">
              {selectedIssuesLabel} {selectedIssueIds.length}
            </span>
            {!lockedPlanId && canManagePlans ? (
              <button
                type="button"
                onClick={() => openBulkAction("assignPlan")}
                className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                {bulkAddToPlanLabel}
              </button>
            ) : null}
            {canManagePlans ? (
              <button
                type="button"
                onClick={() => openBulkAction("removePlan")}
                className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                {bulkRemovePlanLabel}
              </button>
            ) : null}
            {!lockedPlanId ? (
              <button
                type="button"
                onClick={() => openBulkAction("assignIteration")}
                className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                {bulkAddToSprintLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSelectedIssueIds([])}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
            >
              {bulkClearLabel}
            </button>
          </div>
        ) : null}
      </div>

      <div className={`bg-white overflow-hidden flex-1 flex flex-col ${unframed ? "" : "rounded-xl border shadow-sm"}`}>
        <div className="relative overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap" style={{ tableLayout: "fixed" }}>
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold border-b">
              <tr>
                <th className="w-12 px-4 py-4">
                  <input
                    type="checkbox"
                    checked={allCurrentPageSelected}
                    onChange={toggleCurrentPageSelection}
                    aria-label={locale === "zh" ? "选择当前页全部问题" : "Select all issues on this page"}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                {columns.map((col, index) => {
                  const columnSortField = COLUMN_SORT_FIELD_MAP[col.id];
                  const isSortedColumn = !!columnSortField && sortBy === columnSortField;
                  const showLeftLine =
                    dragOverIndex === index && dragOverSide === "left" && dragSourceIndex !== index;
                  const showRightLine =
                    dragOverIndex === index && dragOverSide === "right" && dragSourceIndex !== index;
                  const isDragging = dragSourceIndex === index;

                  return (
                    <th
                      key={col.id}
                      className={`px-5 py-4 cursor-grab active:cursor-grabbing hover:bg-slate-100 transition-colors overflow-hidden relative select-none ${
                        isDragging ? "opacity-40" : ""
                      }`}
                      style={col.width ? { width: `${col.width}px` } : undefined}
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

                      <button
                        type="button"
                        onClick={() => handleSortByColumn(col.id)}
                        disabled={!columnSortField}
                        className={`inline-flex items-center gap-1 font-semibold ${
                          columnSortField
                            ? "cursor-pointer text-slate-600 hover:text-slate-800"
                            : "cursor-grab text-slate-500"
                        }`}
                        draggable={false}
                      >
                        <span>{col.label}</span>
                        {columnSortField &&
                          isSortedColumn && (
                            sortDirection === "asc" ? (
                              <ArrowUp size={12} />
                            ) : (
                              <ArrowDown size={12} />
                            )
                          )}
                      </button>

                      {showRightLine && <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-blue-500 z-10" />}

                      <div
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/50 z-20"
                        onMouseDown={(e) => handleResizeStart(e, index)}
                        draggable={false}
                      />
                    </th>
                  );
                })}
                {visibleIssueFields.map((field) => (
                  <th
                    key={field.id}
                    className="px-5 py-4 overflow-hidden relative select-none"
                    style={{ width: `${issueFieldWidths[field.id] || getDefaultFieldWidth(field)}px` }}
                  >
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                      <span className="truncate">{field.name}</span>
                      {field.required ? <span className="text-red-500">*</span> : null}
                    </span>
                    <div
                      className="absolute right-0 top-0 bottom-0 z-20 w-1.5 cursor-col-resize hover:bg-blue-400/50"
                      onMouseDown={(event) => handleIssueFieldResizeStart(event, field)}
                      draggable={false}
                    />
                  </th>
                ))}
                {visiblePlanFields.map((field) => (
                  <th
                    key={field.id}
                    className="px-5 py-4 overflow-hidden relative select-none"
                    style={{ width: `${planFieldWidths[field.id] || getDefaultFieldWidth(field)}px` }}
                  >
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                      <span className="truncate">{field.name}</span>
                      {field.required ? <span className="text-red-500">*</span> : null}
                    </span>
                    <div
                      className="absolute right-0 top-0 bottom-0 z-20 w-1.5 cursor-col-resize hover:bg-blue-400/50"
                      onMouseDown={(event) => handlePlanFieldResizeStart(event, field)}
                      draggable={false}
                    />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedIssues.map((issue) => (
                <tr key={issue.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={selectedIssueIds.includes(issue.id)}
                      onChange={() => toggleIssueSelection(issue.id)}
                      aria-label={locale === "zh" ? `选择问题 ${issue.key}` : `Select issue ${issue.key}`}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  {columns.map((col) => {
                    if (col.id === "key") {
                      return (
                        <td key={col.id} className="px-5 py-3.5 text-slate-500 font-medium">
                          <Link href={`/issues/${issue.id}`} className="hover:text-blue-600 hover:underline">
                            {issue.key}
                          </Link>
                        </td>
                      );
                    }

                    if (col.id === "title") {
                      return (
                        <td
                          key={col.id}
                          className="px-5 py-3.5 font-semibold text-slate-800 overflow-hidden text-ellipsis"
                        >
                          <Link
                            href={`/issues/${issue.id}`}
                            className="hover:text-blue-600 block w-full truncate border-b border-transparent"
                          >
                            {issue.title}
                          </Link>
                        </td>
                      );
                    }

                    if (col.id === "plan") {
                      return (
                        <td key={col.id} className="px-5 py-3.5">
                          {canManagePlans ? (
                            <InlineSelect
                              value={issue.planId || ""}
                              options={planInlineOptions}
                              className="relative block w-full"
                              onChange={(value) => handleInlineUpdate(issue.id, "planId", value || null)}
                              renderSummary={(label) => (
                                <span className="block text-sm font-medium text-slate-700 bg-transparent border-none p-0 outline-none focus:ring-0 cursor-pointer w-full truncate">
                                  {label}
                                </span>
                              )}
                            />
                          ) : (
                            <span className="block w-full truncate text-sm font-medium text-slate-700">
                              {issue.plan?.name || noPlanLabel}
                            </span>
                          )}
                        </td>
                      );
                    }

                    if (col.id === "iteration") {
                      return (
                        <td key={col.id} className="px-5 py-3.5">
                          <InlineSelect
                            value={issue.iterationId || ""}
                            options={iterationInlineOptions}
                            className="relative block w-full"
                            onChange={(value) => handleInlineUpdate(issue.id, "iterationId", value || null)}
                            renderSummary={(label) => (
                              <span className="block text-sm font-medium text-slate-700 bg-transparent border-none p-0 outline-none focus:ring-0 cursor-pointer w-full truncate">
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
                        workflow.statuses.filter(
                          (status) => status.key === issue.status || allowedTargets?.has(status.key)
                        ),
                        locale
                      );
                      return (
                        <td key={col.id} className="px-5 py-3.5">
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
                        <td key={col.id} className="px-5 py-3.5">
                          <InlineSelect
                            value={issue.type}
                            options={typeOptions}
                            className="relative block w-full"
                            onChange={(value) => handleInlineUpdate(issue.id, "type", value)}
                            renderSummary={(label) => (
                              <span className="block text-sm font-medium text-slate-700 bg-transparent border-none p-0 outline-none focus:ring-0 cursor-pointer w-full truncate">
                                {label}
                              </span>
                            )}
                          />
                        </td>
                      );
                    }

                    if (col.id === "priority") {
                      return (
                        <td key={col.id} className="px-5 py-3.5">
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
                                <span className="block text-sm font-medium text-slate-700 bg-transparent border-none p-0 outline-none focus:ring-0 cursor-pointer w-full truncate">
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
                        <td key={col.id} className="px-5 py-3.5 text-sm font-medium text-slate-700">
                          {issue.dueDate ? new Date(issue.dueDate).toLocaleDateString(localeDateMap[locale]) : ""}
                        </td>
                      );
                    }

                    if (col.id === "assignee") {
                      return (
                        <td key={col.id} className="px-5 py-3.5">
                          <InlineSelect
                            value={issue.assigneeId || ""}
                            options={assigneeInlineOptions}
                            className="relative block w-full"
                            onChange={(value) => handleInlineUpdate(issue.id, "assigneeId", value || null)}
                            renderSummary={(label) => (
                              <span className="block text-sm font-medium text-slate-700 bg-transparent border-none p-0 outline-none focus:ring-0 cursor-pointer w-full truncate">
                                {label}
                              </span>
                            )}
                          />
                        </td>
                      );
                    }

                    return <td key={col.id}></td>;
                  })}
                  {visibleIssueFields.map((field) => {
                    const fieldValue = issue.issueFieldValues?.find((value) => value.fieldDefinitionId === field.id);
                    const displayValue = getFieldValueForDisplay(field, fieldValue);

                    if (field.type === "BOOLEAN") {
                      return (
                        <td key={field.id} className="px-5 py-3.5">
                          <input
                            type="checkbox"
                            checked={fieldValue?.valueBoolean || false}
                            onChange={(event) => handleIssueFieldValueUpdate(issue.id, field, event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            aria-label={field.name}
                          />
                        </td>
                      );
                    }

                    if (field.type === "NUMBER") {
                      return (
                        <td key={field.id} className="px-5 py-3.5">
                          <FieldDraftInput
                            field={field}
                            value={displayValue}
                            onCommit={(value) => handleIssueFieldValueUpdate(issue.id, field, value)}
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
                        <td key={field.id} className="px-5 py-3.5">
                          <InlineSelect
                            value={displayValue}
                            options={options}
                            className="relative block w-full"
                            onChange={(value) => handleIssueFieldValueUpdate(issue.id, field, value || null)}
                            renderSummary={(label) => (
                              <span className="block text-sm font-medium text-slate-700 bg-transparent border-none p-0 outline-none focus:ring-0 cursor-pointer w-full truncate">
                                {label}
                              </span>
                            )}
                          />
                        </td>
                      );
                    }

                    if (field.type === "LONG_TEXT") {
                      return (
                        <td key={field.id} className="px-5 py-3.5 align-top">
                          <FieldDraftInput
                            field={field}
                            value={displayValue}
                            multiline
                            onCommit={(value) => handleIssueFieldValueUpdate(issue.id, field, value)}
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={field.id} className="px-5 py-3.5">
                        <FieldDraftInput
                          field={field}
                          value={displayValue}
                          onCommit={(value) => handleIssueFieldValueUpdate(issue.id, field, value)}
                        />
                      </td>
                    );
                  })}
                  {visiblePlanFields.map((field) => {
                    const fieldValue = issue.planFieldValues?.find((value) => value.fieldDefinitionId === field.id);
                    const displayValue = getFieldValueForDisplay(field, fieldValue);

                    if (field.type === "BOOLEAN") {
                      return (
                        <td key={field.id} className="px-5 py-3.5">
                          <input
                            type="checkbox"
                            checked={fieldValue?.valueBoolean || false}
                            onChange={(event) => handlePlanFieldValueUpdate(issue.id, field, event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            aria-label={field.name}
                          />
                        </td>
                      );
                    }

                    if (field.type === "NUMBER") {
                      return (
                        <td key={field.id} className="px-5 py-3.5">
                          <FieldDraftInput
                            field={field}
                            value={displayValue}
                            onCommit={(value) => handlePlanFieldValueUpdate(issue.id, field, value)}
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
                        <td key={field.id} className="px-5 py-3.5">
                          <InlineSelect
                            value={displayValue}
                            options={options}
                            className="relative block w-full"
                            onChange={(value) => handlePlanFieldValueUpdate(issue.id, field, value || null)}
                            renderSummary={(label) => (
                              <span className="block text-sm font-medium text-slate-700 bg-transparent border-none p-0 outline-none focus:ring-0 cursor-pointer w-full truncate">
                                {label}
                              </span>
                            )}
                          />
                        </td>
                      );
                    }

                    if (field.type === "LONG_TEXT") {
                      return (
                        <td key={field.id} className="px-5 py-3.5 align-top">
                          <FieldDraftInput
                            field={field}
                            value={displayValue}
                            multiline
                            onCommit={(value) => handlePlanFieldValueUpdate(issue.id, field, value)}
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={field.id} className="px-5 py-3.5">
                        <FieldDraftInput
                          field={field}
                          value={displayValue}
                          onCommit={(value) => handlePlanFieldValueUpdate(issue.id, field, value)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {(totalIssues || issues.length) === 0 ? (
            <div className="pointer-events-none sticky left-0 flex min-h-52 w-full items-center justify-center px-5 py-16 text-center text-slate-500">
              <div>
                <p className="mb-1 text-base font-medium">{translations.issueList.noMatchTitle}</p>
                <p className="text-sm">{translations.issueList.noMatchDesc}</p>
              </div>
            </div>
          ) : null}
        </div>

      <div className="bg-slate-50 border-t px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-slate-500 font-medium">
            {locale === "zh" ? (
              <>
                {translations.issueList.showing}
                <span className="text-slate-800 font-bold">
                  {" "}
                  {(totalIssues || issues.length) > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}{" "}
                </span>
                {translations.issueList.to}
                <span className="text-slate-800 font-bold">
                  {" "}
                  {Math.min(currentPage * itemsPerPage, (totalIssues || issues.length))}{" "}
                </span>
                {translations.issueList.of}
                <span className="text-slate-800 font-bold"> {(totalIssues || issues.length)} </span>
                {translations.issueList.issues}
              </>
            ) : (
              <>
                {translations.issueList.showing}{" "}
                <span className="text-slate-800 font-bold">
                  {(totalIssues || issues.length) > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}
                </span>{" "}
                {translations.issueList.to}{" "}
                <span className="text-slate-800 font-bold">
                  {Math.min(currentPage * itemsPerPage, (totalIssues || issues.length))}
                </span>{" "}
                {translations.issueList.of} <span className="text-slate-800 font-bold">{(totalIssues || issues.length)}</span>{" "}
                {translations.issueList.issues}
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-500 [&>span:first-child]:hidden">
              <span>{locale === "zh" ? "每页" : "Per page"}</span>
              <span>{translations.issueList.perPage}</span>
              <InlineSelect
                value={String(itemsPerPage)}
                options={perPageOptions}
                onChange={(value) => {
                  updateQueryParams({ pageSize: value, page: "1" });
                }}
                renderSummary={(label) => (
                  <span className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    {label}
                  </span>
                )}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQueryParams({ page: String(Math.max(1, currentPage - 1)) })}
                disabled={currentPage === 1}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
              >
                <ArrowLeft size={18} />
              </button>

              <span className="font-medium text-slate-700 px-2 leading-none">
                {locale === "zh"
                  ? `${translations.issueList.page} ${currentPage} / ${totalPages || 1}`
                  : `${translations.issueList.page} ${currentPage} of ${totalPages || 1}`}
              </span>

              <button
                onClick={() => updateQueryParams({ page: String(Math.min(totalPages || 1, currentPage + 1)) })}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
              >
                <ArrowRight size={18} />
              </button>
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

            <div className="max-h-[70vh] overflow-y-auto p-5">
              <div className="space-y-2">
                {activeManagerFields.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    {noFieldsLabel}
                  </div>
                ) : (
                  activeManagerFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-800">{field.name}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                            {field.type}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-400">{field.key}</div>
                      </div>
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
                  ))
                )}
              </div>

              <form onSubmit={activeManagerSubmit} className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
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
                      onChange={(event) => setFieldForm((current) => ({ ...current, key: event.target.value }))}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-500"
                      placeholder="api_count"
                      required
                    />
                  </label>
                  <DropdownField
                    id="plan-field-type"
                    label={fieldTypeLabel}
                    value={fieldForm.type}
                    onChange={(value) => setFieldForm((current) => ({ ...current, type: value as PlanFieldType }))}
                    options={fieldTypeOptions}
                  />
                  {fieldForm.type === "SELECT" ? (
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-600">{fieldOptionsLabel}</span>
                      <input
                        type="text"
                        value={fieldForm.optionsText}
                        onChange={(event) => setFieldForm((current) => ({ ...current, optionsText: event.target.value }))}
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-500"
                        placeholder={fieldOptionsPlaceholder}
                      />
                    </label>
                  ) : null}
                </div>
                {fieldManagerError ? <p className="mt-3 text-sm text-red-600">{fieldManagerError}</p> : null}
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
