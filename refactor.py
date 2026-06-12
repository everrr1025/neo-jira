import os
import re

file_path = 'src/components/IssueList.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add import
if 'useIssueListFilters' not in code:
    code = code.replace(
        'import { bulkUpdateIssues, updateIssue } from "@/app/actions/issues";',
        'import { bulkUpdateIssues, updateIssue } from "@/app/actions/issues";\nimport { useIssueListFilters } from "./issuelist/useIssueListFilters";'
    )

# 2. Change signature
code = code.replace(
    'initialIssues: Issue[];\n  users:',
    'initialIssues: Issue[];\n  totalIssues?: number;\n  page?: number;\n  pageSize?: number;\n  users:'
)
code = code.replace(
    '  initialIssues,\n  users,\n  plans,\n  iterations,',
    '  initialIssues,\n  totalIssues = 0,\n  page: serverPage = 1,\n  pageSize: serverPageSize = 10,\n  users,\n  plans,\n  iterations,'
)

# 3. Remove local state and add hook
state_to_remove = """  const [statusFilter, setStatusFilter] = useState<string[]>([]);
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
  const [itemsPerPage, setItemsPerPage] = useState(10);"""

hook_to_add = """  const { filters, pagination, sorting, updateQueryParams } = useIssueListFilters();
  const { statusFilter, typeFilter, priorityFilter, planFilter, sprintFilter, assigneeFilter, watcherFilter, dueFilter, dueDateValue, duePreset, search: searchParamsSearch } = filters;
  const { page: currentPage, pageSize: itemsPerPage } = pagination;
  const { sortBy, sortDirection } = sorting;"""

code = code.replace(state_to_remove, hook_to_add)

# 4. Remove `useEffect` that listens to `searchParams`
use_effect_regex = re.compile(
    r'useEffect\(\(\) => \{\n\s+const csv = [\s\S]*?setCurrentPage\(1\);\n\s+\}, \[lockedPlanId, searchParams, users\]\);',
    re.MULTILINE
)
code = use_effect_regex.sub('', code)

# 5. Replace filtering logic with just using issues from server
filtering_logic_regex = re.compile(
    r'const filteredIssues = useMemo\(\(\) => \{[\s\S]*?const sortedIssues = useMemo\(\(\) => \{[\s\S]*?return sorted;\n  \}, \[[^\]]+\]\);\n\n  const totalPages = Math.ceil\(sortedIssues\.length \/ itemsPerPage\);\n  const paginatedIssues = sortedIssues\.slice\(\(currentPage - 1\) \* itemsPerPage, currentPage \* itemsPerPage\);'
)

simple_logic = """  const totalPages = totalIssues ? Math.ceil(totalIssues / itemsPerPage) : Math.ceil(issues.length / itemsPerPage);
  const paginatedIssues = issues;"""

code = filtering_logic_regex.sub(simple_logic, code)

# 6. Update toggleFilterValue
toggle_filter_old = """const toggleFilterValue = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
    setCurrentPage(1);
  };"""
toggle_filter_new = """const toggleFilterValue = (value: string, filterKey: string, currentValues: string[]) => {
    const newValues = currentValues.includes(value) ? currentValues.filter((item) => item !== value) : [...currentValues, value];
    updateQueryParams({ [filterKey]: newValues });
  };"""

code = code.replace(toggle_filter_old, toggle_filter_new)

# 7. Update usage of toggleFilterValue in JSX
code = code.replace(r'onToggle={(value) => toggleFilterValue(value, setSprintFilter)}', r'onToggle={(value) => toggleFilterValue(value, "sprint", sprintFilter)}')
code = code.replace(r'onToggle={(value) => toggleFilterValue(value, setStatusFilter)}', r'onToggle={(value) => toggleFilterValue(value, "status", statusFilter)}')
code = code.replace(r'onToggle={(value) => toggleFilterValue(value, setTypeFilter)}', r'onToggle={(value) => toggleFilterValue(value, "type", typeFilter)}')
code = code.replace(r'onToggle={(value) => toggleFilterValue(value, setPriorityFilter)}', r'onToggle={(value) => toggleFilterValue(value, "priority", priorityFilter)}')
code = code.replace(r'onToggle={(value) => toggleFilterValue(value, setPlanFilter)}', r'onToggle={(value) => toggleFilterValue(value, "plan", planFilter)}')
code = code.replace(r'onToggle={(value) => toggleFilterValue(value, setAssigneeFilter)}', r'onToggle={(value) => toggleFilterValue(value, "assignee", assigneeFilter)}')

# Update onClear
code = re.sub(r'set([A-Za-z]+)Filter\(\[\]\);\n\s+setCurrentPage\(1\);', lambda m: f'updateQueryParams({{ {m.group(1).lower()}: null }});', code)

# Update single filters
code = re.sub(r'setSearch\(e\.target\.value\);\n\s+setCurrentPage\(1\);', r'setSearch(e.target.value); updateQueryParams({ search: e.target.value });', code)

code = re.sub(
    r'setDuePreset\("NONE"\);\n\s+setDueFilter\(value as DueFilterValue\);\n\s+if \(value === "ALL"\) \{\n\s+setDueDateValue\(""\);\n\s+\}\n\s+setCurrentPage\(1\);',
    r'updateQueryParams({ duePreset: null, dueFilter: value, dueDate: value === "ALL" ? null : dueDateValue });',
    code
)

code = re.sub(
    r'setDuePreset\("NONE"\);\n\s+setDueDateValue\(e\.target\.value\);\n\s+setCurrentPage\(1\);',
    r'updateQueryParams({ duePreset: null, dueDate: e.target.value });',
    code
)

code = re.sub(
    r'setDuePreset\("NEXT_3_DAYS"\);\n\s+setDueFilter\("ALL"\);\n\s+setDueDateValue\(""\);\n\s+setCurrentPage\(1\);',
    r'updateQueryParams({ duePreset: "NEXT_3_DAYS", dueFilter: null, dueDate: null });',
    code
)

# HandleSortByColumn
handle_sort_old = re.compile(r'const handleSortByColumn = \(columnId: ColumnId\) => \{[\s\S]*?setSortDirection\(nextSortField === "createdAt" \? "desc" : "asc"\);\n  \};')
handle_sort_new = """const handleSortByColumn = (columnId: ColumnId) => {
    const nextSortField = COLUMN_SORT_FIELD_MAP[columnId];
    if (!nextSortField) return;

    if (sortBy === nextSortField) {
      updateQueryParams({ sortDirection: sortDirection === "asc" ? "desc" : "asc" });
      return;
    }

    updateQueryParams({ sortBy: nextSortField, sortDirection: nextSortField === "createdAt" ? "desc" : "asc" });
  };"""
code = handle_sort_old.sub(handle_sort_new, code)

# Paginator prev/next
code = code.replace('setCurrentPage((prev) => prev - 1)', 'updateQueryParams({ page: String(currentPage - 1) })')
code = code.replace('setCurrentPage((prev) => prev + 1)', 'updateQueryParams({ page: String(currentPage + 1) })')
code = re.sub(r'setItemsPerPage\(Number\(value\)\);\n\s+setCurrentPage\(1\);', r'updateQueryParams({ pageSize: value, page: "1" });', code)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("Refactoring completed.")
