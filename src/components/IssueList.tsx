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
} from "lucide-react";
import { updateIssue } from "@/app/actions/issues";
import {
  getIssueStatusLabel,
  getIssueTypeLabel,
  getPriorityLabel,
  getTranslations,
  localeDateMap,
  Locale,
} from "@/lib/i18n";

type Issue = {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  iterationId?: string | null;
  iteration?: { name: string } | null;
  assigneeId?: string | null;
  assignee?: { name: string | null } | null;
  reporter?: { name: string | null } | null;
  createdAt: Date | string;
  dueDate?: Date | string | null;
};

type FilterOption = {
  value: string;
  label: string;
};

type IssueUser = {
  id: string;
  name: string | null;
};

type IssueIteration = {
  id: string;
  name: string;
};

type ColumnId = "key" | "title" | "iteration" | "status" | "type" | "priority" | "dueDate" | "assignee";
type ColumnConfig = {
  id: ColumnId;
  label: string;
  width: number;
};

type SortField = "createdAt" | "key" | "title" | "status" | "type" | "priority" | "dueDate" | "sprint" | "assignee";
type DueFilterValue = "ALL" | "EQ" | "GTE" | "LTE";

const BACKLOG_FILTER_VALUE = "__BACKLOG__";

const STATUS_ORDER: Record<string, number> = {
  TODO: 1,
  IN_PROGRESS: 2,
  IN_TESTING: 3,
  DONE: 4,
};

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
  iteration: "sprint",
  status: "status",
  type: "type",
  priority: "priority",
  dueDate: "dueDate",
  assignee: "assignee",
};

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

export default function IssueList({
  initialIssues,
  users,
  iterations,
  currentUser,
  locale,
}: {
  initialIssues: Issue[];
  users: IssueUser[];
  iterations: IssueIteration[];
  currentUser: { id: string } | null;
  locale: Locale;
}) {
  const searchParams = useSearchParams();
  const [issues, setIssues] = useState(initialIssues);
  const [search, setSearch] = useState("");
  const translations = getTranslations(locale);

  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [sprintFilter, setSprintFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [dueFilter, setDueFilter] = useState<DueFilterValue>("ALL");
  const [dueDateValue, setDueDateValue] = useState("");
  const [duePreset, setDuePreset] = useState<"NONE" | "NEXT_3_DAYS">("NONE");
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [, startTransition] = useTransition();

  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: "key", label: translations.issueList.key, width: 80 },
    { id: "title", label: translations.issueList.summary, width: 0 },
    { id: "iteration", label: translations.issueList.sprint, width: 160 },
    { id: "status", label: translations.issueList.status, width: 140 },
    { id: "type", label: translations.issueList.type, width: 120 },
    { id: "priority", label: translations.issueList.priority, width: 140 },
    { id: "dueDate", label: translations.issueList.due, width: 140 },
    { id: "assignee", label: translations.issueList.assignee, width: 190 },
  ]);

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
        const newCols = [...columns];
        const [removed] = newCols.splice(sourceIndex, 1);
        const adjustedTarget =
          dragOverSide === "right"
            ? sourceIndex < targetIndex
              ? targetIndex
              : targetIndex + 1
            : sourceIndex < targetIndex
              ? targetIndex - 1
              : targetIndex;
        newCols.splice(Math.max(0, adjustedTarget), 0, removed);
        setColumns(newCols);
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

        setColumns((prev) => prev.map((c, i) => (i === resizeColIndex ? { ...c, width: newWidth } : c)));
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

  useEffect(() => {
    setIssues(initialIssues);
  }, [initialIssues]);

  useEffect(() => {
    const csv = (value: string | null) =>
      value
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

    const assignee = searchParams.get("assignee");
    const duePresetParam = searchParams.get("duePreset");
    const dueOp = searchParams.get("dueOp");
    const dueDate = searchParams.get("dueDate") ?? "";

    let nextDueFilter: DueFilterValue = "ALL";
    let nextDueDateValue = "";
    let nextDuePreset: "NONE" | "NEXT_3_DAYS" = "NONE";

    if (dueOp === "EQ" || dueOp === "GTE" || dueOp === "LTE" || dueOp === "ALL") {
      nextDueFilter = dueOp;
      nextDueDateValue = dueDate;
    }
    if (duePresetParam === "NEXT_3_DAYS") {
      nextDuePreset = "NEXT_3_DAYS";
    }

    setStatusFilter(csv(searchParams.get("status")));
    setTypeFilter(csv(searchParams.get("type")));
    setPriorityFilter(csv(searchParams.get("priority")));
    setSprintFilter(csv(searchParams.get("sprint")));
    const assigneeValues = csv(assignee);
    const validAssigneeValues = assigneeValues.filter(
      (value) => value === "ME" || value === "UNASSIGNED" || users.some((user) => user.id === value)
    );

    setAssigneeFilter(validAssigneeValues);
    setDueFilter(nextDueFilter);
    setDueDateValue(nextDueDateValue);
    setDuePreset(nextDuePreset);
    setCurrentPage(1);
  }, [searchParams, users]);

  const statusOptions = useMemo<FilterOption[]>(
    () => [
      { value: "TODO", label: getIssueStatusLabel("TODO", locale) },
      { value: "IN_PROGRESS", label: getIssueStatusLabel("IN_PROGRESS", locale) },
      { value: "IN_TESTING", label: getIssueStatusLabel("IN_TESTING", locale) },
      { value: "DONE", label: getIssueStatusLabel("DONE", locale) },
    ],
    [locale]
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
      ...users
        .filter((user) => user.id !== currentUser?.id)
        .map((user) => ({
          value: user.id,
          label: user.name || user.id,
        })),
    ],
    [currentUser?.id, translations.issueList.assignedToMe, translations.issueList.unassigned, users]
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
      ...users.map((u) => ({ value: u.id as string, label: (u.name || u.id) as string })),
    ],
    [translations.issueList.unassigned, users]
  );

  const perPageOptions = useMemo<FilterOption[]>(
    () => [
      { value: "10", label: "10" },
      { value: "20", label: "20" },
      { value: "50", label: "50" },
    ],
    []
  );

  const toggleFilterValue = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
    setCurrentPage(1);
  };

  const handleSortByColumn = (columnId: ColumnId) => {
    const nextSortField = COLUMN_SORT_FIELD_MAP[columnId];
    if (!nextSortField) return;

    setCurrentPage(1);

    if (sortBy === nextSortField) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(nextSortField);
    setSortDirection(nextSortField === "createdAt" ? "desc" : "asc");
  };

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (statusFilter.length > 0 && !statusFilter.includes(issue.status)) return false;
      if (typeFilter.length > 0 && !typeFilter.includes(issue.type)) return false;
      if (priorityFilter.length > 0 && !priorityFilter.includes(issue.priority)) return false;

      if (sprintFilter.length > 0) {
        const sprintValue = issue.iterationId ?? BACKLOG_FILTER_VALUE;
        if (!sprintFilter.includes(sprintValue)) return false;
      }

      if (assigneeFilter.length > 0) {
        const matchesAssignee = assigneeFilter.some((selectedAssignee) => {
          if (selectedAssignee === "ME") {
            return issue.assigneeId === currentUser?.id;
          }

          if (selectedAssignee === "UNASSIGNED") {
            return issue.assigneeId == null;
          }

          return issue.assigneeId === selectedAssignee;
        });

        if (!matchesAssignee) return false;
      }

      if (dueFilter !== "ALL") {
        if (!issue.dueDate) return false;

        const dueDate = new Date(issue.dueDate);
        if (Number.isNaN(dueDate.getTime())) return false;
        dueDate.setHours(0, 0, 0, 0);

        const selectedDate = dueDateValue ? parseDateInputValue(dueDateValue) : null;

        if (dueFilter === "EQ" && selectedDate && dueDate.getTime() !== selectedDate.getTime()) return false;
        if (dueFilter === "GTE" && selectedDate && dueDate < selectedDate) return false;
        if (dueFilter === "LTE" && selectedDate && dueDate > selectedDate) return false;
      }

      if (duePreset === "NEXT_3_DAYS") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!issue.dueDate) return false;

        const dueDate = new Date(issue.dueDate);
        if (Number.isNaN(dueDate.getTime())) return false;
        dueDate.setHours(0, 0, 0, 0);

        const threeDaysLater = new Date(today);
        threeDaysLater.setDate(threeDaysLater.getDate() + 3);

        if (dueDate < today || dueDate > threeDaysLater) return false;
      }

      if (search) {
        const query = search.toLowerCase();
        if (!issue.title.toLowerCase().includes(query) && !issue.key.toLowerCase().includes(query)) return false;
      }

      return true;
    });
  }, [
    assigneeFilter,
    currentUser?.id,
    dueDateValue,
    dueFilter,
    duePreset,
    issues,
    search,
    priorityFilter,
    sprintFilter,
    statusFilter,
    typeFilter,
  ]);

  const sortedIssues = useMemo(() => {
    const factor = sortDirection === "asc" ? 1 : -1;
    const sorted = [...filteredIssues];

    sorted.sort((a, b) => {
      if (sortBy === "createdAt") {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * factor;
      }
      if (sortBy === "status") {
        return ((STATUS_ORDER[a.status] || 99) - (STATUS_ORDER[b.status] || 99)) * factor;
      }
      if (sortBy === "type") {
        return ((TYPE_ORDER[a.type] || 99) - (TYPE_ORDER[b.type] || 99)) * factor;
      }
      if (sortBy === "priority") {
        return ((PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0)) * factor;
      }
      if (sortBy === "dueDate") {
        const aDueDate = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDueDate = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return (aDueDate - bDueDate) * factor;
      }
      if (sortBy === "sprint") {
        const aSprint = a.iteration?.name || translations.issueList.backlog;
        const bSprint = b.iteration?.name || translations.issueList.backlog;
        return aSprint.localeCompare(bSprint) * factor;
      }
      if (sortBy === "key") {
        return a.key.localeCompare(b.key, undefined, { numeric: true }) * factor;
      }
      if (sortBy === "assignee") {
        const aAssignee = a.assignee?.name || translations.issueList.unassigned;
        const bAssignee = b.assignee?.name || translations.issueList.unassigned;
        return aAssignee.localeCompare(bAssignee) * factor;
      }
      return a.title.localeCompare(b.title) * factor;
    });

    return sorted;
  }, [filteredIssues, sortBy, sortDirection, translations.issueList.backlog, translations.issueList.unassigned]);

  const totalPages = Math.ceil(sortedIssues.length / itemsPerPage);
  const paginatedIssues = sortedIssues.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (totalPages === 0) {
      if (currentPage !== 1) setCurrentPage(1);
      return;
    }

    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleInlineUpdate = (issueId: string, field: string, value: string | null) => {
    setIssues((prev) =>
      prev.map((i) => {
        if (i.id === issueId) {
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

  return (
    <div className="flex flex-col flex-1 space-y-4 min-h-0">
      <div className="bg-white p-3 rounded-lg border shadow-sm sticky top-0 z-20">
        <div className="flex flex-wrap items-center gap-2 w-full">
          <div className="flex items-center gap-2 w-full lg:w-80 relative">
            <Search size={16} className="absolute left-3 text-slate-400" />
            <input
              type="text"
              placeholder={translations.issueList.searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm border-slate-200 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="h-9 px-2 inline-flex items-center text-slate-500">
            <ListFilter size={14} />
          </div>

          <MultiFilter
            label={translations.issueList.sprint}
            options={sprintOptions}
            selectedValues={sprintFilter}
            onToggle={(value) => toggleFilterValue(value, setSprintFilter)}
            onClear={() => {
              setSprintFilter([]);
              setCurrentPage(1);
            }}
            clearText={translations.issueList.clearSelection}
          />

          <MultiFilter
            label={translations.issueList.status}
            options={statusOptions}
            selectedValues={statusFilter}
            onToggle={(value) => toggleFilterValue(value, setStatusFilter)}
            onClear={() => {
              setStatusFilter([]);
              setCurrentPage(1);
            }}
            clearText={translations.issueList.clearSelection}
          />

          <MultiFilter
            label={translations.issueList.type}
            options={typeOptions}
            selectedValues={typeFilter}
            onToggle={(value) => toggleFilterValue(value, setTypeFilter)}
            onClear={() => {
              setTypeFilter([]);
              setCurrentPage(1);
            }}
            clearText={translations.issueList.clearSelection}
          />

          <MultiFilter
            label={translations.issueList.priority}
            options={priorityOptions}
            selectedValues={priorityFilter}
            onToggle={(value) => toggleFilterValue(value, setPriorityFilter)}
            onClear={() => {
              setPriorityFilter([]);
              setCurrentPage(1);
            }}
            clearText={translations.issueList.clearSelection}
          />

          <MultiFilter
            label={translations.issueList.assignee}
            options={assigneeFilterOptions}
            selectedValues={assigneeFilter}
            onToggle={(value) => toggleFilterValue(value, setAssigneeFilter)}
            onClear={() => {
              setAssigneeFilter([]);
              setCurrentPage(1);
            }}
            clearText={translations.issueList.clearSelection}
          />

          <SingleFilter
            value={dueFilter}
            options={dueFilterOptions}
            onChange={(value) => {
              setDuePreset("NONE");
              setDueFilter(value as DueFilterValue);
              if (value === "ALL") {
                setDueDateValue("");
              }
              setCurrentPage(1);
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
            <input
              type="date"
              aria-label={translations.issueList.due}
              value={dueDateValue}
              onChange={(e) => {
                setDuePreset("NONE");
                setDueDateValue(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : null}
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap" style={{ tableLayout: "fixed" }}>
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold border-b">
              <tr>
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
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedIssues.map((issue) => (
                <tr key={issue.id} className="hover:bg-slate-50/70 transition-colors group">
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
                      return (
                        <td key={col.id} className="px-5 py-3.5">
                          <InlineSelect
                            value={issue.status}
                            options={statusOptions}
                            className="relative block w-full"
                            onChange={(value) => handleInlineUpdate(issue.id, "status", value)}
                            renderSummary={(label) => (
                              <span
                                className={`inline-block text-sm font-medium px-2 py-0.5 rounded-full cursor-pointer border-none outline-none focus:ring-0 transition-colors ${
                                  issue.status === "DONE"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : issue.status === "IN_PROGRESS" || issue.status === "IN_TESTING"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-slate-100 text-slate-600"
                                }`}
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
                </tr>
              ))}

              {sortedIssues.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-16 text-center text-slate-500">
                    <p className="font-medium text-base mb-1">{translations.issueList.noMatchTitle}</p>
                    <p className="text-sm">{translations.issueList.noMatchDesc}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 border-t px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-slate-500 font-medium">
            {locale === "zh" ? (
              <>
                {translations.issueList.showing}
                <span className="text-slate-800 font-bold">
                  {" "}
                  {sortedIssues.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}{" "}
                </span>
                {translations.issueList.to}
                <span className="text-slate-800 font-bold">
                  {" "}
                  {Math.min(currentPage * itemsPerPage, sortedIssues.length)}{" "}
                </span>
                {translations.issueList.of}
                <span className="text-slate-800 font-bold"> {sortedIssues.length} </span>
                {translations.issueList.issues}
              </>
            ) : (
              <>
                {translations.issueList.showing}{" "}
                <span className="text-slate-800 font-bold">
                  {sortedIssues.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}
                </span>{" "}
                {translations.issueList.to}{" "}
                <span className="text-slate-800 font-bold">
                  {Math.min(currentPage * itemsPerPage, sortedIssues.length)}
                </span>{" "}
                {translations.issueList.of} <span className="text-slate-800 font-bold">{sortedIssues.length}</span>{" "}
                {translations.issueList.issues}
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-500">
              <span>{locale === "zh" ? "每页" : "Per page"}</span>
              <InlineSelect
                value={String(itemsPerPage)}
                options={perPageOptions}
                onChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
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
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages || 1, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
