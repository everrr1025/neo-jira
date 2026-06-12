const fs = require('fs');
let code = fs.readFileSync('src/components/IssueList.tsx', 'utf-8');

// 1. Add import
code = code.replace(
  'import { bulkUpdateIssues, updateIssue } from "@/app/actions/issues";',
  'import { bulkUpdateIssues, updateIssue } from "@/app/actions/issues";\nimport { useIssueListFilters } from "./issuelist/useIssueListFilters";'
);

// 2. Change signature
code = code.replace(
  'initialIssues: Issue[];\n  users:',
  'initialIssues: Issue[];\n  totalIssues?: number;\n  page?: number;\n  pageSize?: number;\n  users:'
);
code = code.replace(
  'export default function IssueList({',
  'export default function IssueList({'
);
code = code.replace(
  '  initialIssues,\n  users,\n  plans,\n  iterations,',
  '  initialIssues,\n  totalIssues = 0,\n  page: serverPage = 1,\n  pageSize: serverPageSize = 10,\n  users,\n  plans,\n  iterations,'
);

// 3. Remove local state and add hook
const stateToRemove = `
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [planFilter, setPlanFilter] = useState<string[]>([]);
  const [sprintFilter, setSprintFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [watcherFilter, setWatcherFilter] = useState<string[]>([]);
  const [dueFilter, setDueFilter] = useState<DueFilterValue>("ALL");
  const [dueDateValue, setDueDateValue] = useState("");
  const [duePreset, setDuePreset] = useState<"NONE" | "NEXT_3_DAYS">("NONE");
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
`;
const hookToAdd = `
  const { filters, pagination, sorting, updateQueryParams } = useIssueListFilters();
  const { statusFilter, typeFilter, priorityFilter, planFilter, sprintFilter, assigneeFilter, watcherFilter, dueFilter, dueDateValue, duePreset, search: searchParamsSearch } = filters;
  const { page: currentPage, pageSize: itemsPerPage } = pagination;
  const { sortBy, sortDirection } = sorting;
`;
code = code.replace(stateToRemove.trim(), hookToAdd.trim());

// 4. Remove `useEffect` that listens to `searchParams`
const useEffectToRemoveRegex = /useEffect\(\(\) => \{\n\s+const csv = [\s\S]*?setCurrentPage\(1\);\n\s+\}, \[lockedPlanId, searchParams, users\]\);/m;
code = code.replace(useEffectToRemoveRegex, '');

// 5. Replace filtering logic with just using issues from server
const filteringLogicRegex = /const filteredIssues = useMemo\(\(\) => \{[\s\S]*?const sortedIssues = useMemo\(\(\) => \{[\s\S]*?return sorted;\n  \}, \[[^\]]+\]\);\n\n  const totalPages = Math.ceil\(sortedIssues\.length \/ itemsPerPage\);\n  const paginatedIssues = sortedIssues.slice\(\(currentPage - 1\) \* itemsPerPage, currentPage \* itemsPerPage\);/;

const simpleLogic = `
  const totalPages = totalIssues ? Math.ceil(totalIssues / itemsPerPage) : Math.ceil(issues.length / itemsPerPage);
  const paginatedIssues = issues;
`;
code = code.replace(filteringLogicRegex, simpleLogic.trim());

// 6. Update toggleFilterValue
code = code.replace(
  'const toggleFilterValue = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {\n    setter((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));\n    setCurrentPage(1);\n  };',
  'const toggleFilterValue = (value: string, filterKey: string, currentValues: string[]) => {\n    const newValues = currentValues.includes(value) ? currentValues.filter((item) => item !== value) : [...currentValues, value];\n    updateQueryParams({ [filterKey]: newValues });\n  };'
);

// 7. Update usage of toggleFilterValue in JSX
code = code.replace(/onToggle=\{\(value\) => toggleFilterValue\(value, setSprintFilter\)\}/g, 'onToggle={(value) => toggleFilterValue(value, "sprint", sprintFilter)}');
code = code.replace(/onToggle=\{\(value\) => toggleFilterValue\(value, setStatusFilter\)\}/g, 'onToggle={(value) => toggleFilterValue(value, "status", statusFilter)}');
code = code.replace(/onToggle=\{\(value\) => toggleFilterValue\(value, setTypeFilter\)\}/g, 'onToggle={(value) => toggleFilterValue(value, "type", typeFilter)}');
code = code.replace(/onToggle=\{\(value\) => toggleFilterValue\(value, setPriorityFilter\)\}/g, 'onToggle={(value) => toggleFilterValue(value, "priority", priorityFilter)}');
code = code.replace(/onToggle=\{\(value\) => toggleFilterValue\(value, setPlanFilter\)\}/g, 'onToggle={(value) => toggleFilterValue(value, "plan", planFilter)}');
code = code.replace(/onToggle=\{\(value\) => toggleFilterValue\(value, setAssigneeFilter\)\}/g, 'onToggle={(value) => toggleFilterValue(value, "assignee", assigneeFilter)}');

// Update onClear
code = code.replace(/set([A-Za-z]+)Filter\(\[\]\);\n\s+setCurrentPage\(1\);/g, (match, p1) => {
  return `updateQueryParams({ ${p1.toLowerCase()}: null });`;
});

// Update single filters
code = code.replace(/setSearch\(e\.target\.value\);\n\s+setCurrentPage\(1\);/g, 'setSearch(e.target.value); updateQueryParams({ search: e.target.value });');
code = code.replace(/setDuePreset\("NONE"\);\n\s+setDueFilter\(value as DueFilterValue\);\n\s+if \(value === "ALL"\) \{\n\s+setDueDateValue\(""\);\n\s+\}\n\s+setCurrentPage\(1\);/g, 'updateQueryParams({ duePreset: null, dueFilter: value, dueDate: value === "ALL" ? null : dueDateValue });');
code = code.replace(/setDuePreset\("NONE"\);\n\s+setDueDateValue\(e\.target\.value\);\n\s+setCurrentPage\(1\);/g, 'updateQueryParams({ duePreset: null, dueDate: e.target.value });');
code = code.replace(/setDuePreset\("NEXT_3_DAYS"\);\n\s+setDueFilter\("ALL"\);\n\s+setDueDateValue\(""\);\n\s+setCurrentPage\(1\);/g, 'updateQueryParams({ duePreset: "NEXT_3_DAYS", dueFilter: null, dueDate: null });');

// HandleSortByColumn
code = code.replace(
  /const handleSortByColumn = \(columnId: ColumnId\) => \{[\s\S]*?setSortDirection\(nextSortField === "createdAt" \? "desc" : "asc"\);\n  \};/,
  `const handleSortByColumn = (columnId: ColumnId) => {
    const nextSortField = COLUMN_SORT_FIELD_MAP[columnId];
    if (!nextSortField) return;

    if (sortBy === nextSortField) {
      updateQueryParams({ sortDirection: sortDirection === "asc" ? "desc" : "asc" });
      return;
    }

    updateQueryParams({ sortBy: nextSortField, sortDirection: nextSortField === "createdAt" ? "desc" : "asc" });
  };`
);

// Paginator prev/next
code = code.replace(/setCurrentPage\(\(prev\) => prev - 1\)/g, 'updateQueryParams({ page: String(currentPage - 1) })');
code = code.replace(/setCurrentPage\(\(prev\) => prev \+ 1\)/g, 'updateQueryParams({ page: String(currentPage + 1) })');
code = code.replace(/setItemsPerPage\(Number\(value\)\);\n\s+setCurrentPage\(1\);/g, 'updateQueryParams({ pageSize: value, page: "1" });');

fs.writeFileSync('src/components/IssueList.tsx', code);
console.log("Refactoring done!");
