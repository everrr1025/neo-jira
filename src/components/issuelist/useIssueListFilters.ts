"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const ISSUE_LIST_FILTER_KEYS = [
  "status",
  "type",
  "priority",
  "plan",
  "sprint",
  "assignee",
  "watcher",
  "view",
  "dueFilter",
  "dueDate",
  "duePreset",
  "search",
  "pageSize",
  "sortBy",
  "sortDirection",
];

function hasIssueListFilterParams(params: URLSearchParams) {
  return ISSUE_LIST_FILTER_KEYS.some((key) => params.has(key)) ||
    Array.from(params.keys()).some((key) => key.startsWith("issueField_") || key.startsWith("planField_"));
}

function buildStoredParams(params: URLSearchParams) {
  const stored = new URLSearchParams();
  ISSUE_LIST_FILTER_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) stored.set(key, value);
  });
  return stored.toString();
}

export function useIssueListFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storageKey = `neo-jira:issue-list-filters:${pathname}:v1`;
  const didAttemptRestoreRef = useRef(false);
  const didRestoreStoredFiltersRef = useRef(false);

  const getCsv = (key: string) => {
    const val = searchParams.get(key);
    return val ? val.split(",").filter(Boolean) : [];
  };

  const statusFilter = getCsv("status");
  const typeFilter = getCsv("type");
  const priorityFilter = getCsv("priority");
  const planFilter = getCsv("plan");
  const sprintFilter = getCsv("sprint");
  const assigneeFilter = getCsv("assignee");
  const watcherFilter = getCsv("watcher");
  const view = searchParams.get("view") || "all";

  const dueFilter = searchParams.get("dueFilter") || "ALL";
  const dueDateValue = searchParams.get("dueDate") || "";
  const duePreset = searchParams.get("duePreset") || "NONE";
  
  const search = searchParams.get("search") || "";
  
  const page = parseInt(searchParams.get("page") || "1", 10) || 1;
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10) || 10;
  
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortDirection = searchParams.get("sortDirection") || "desc";

  useEffect(() => {
    if (didAttemptRestoreRef.current || typeof window === "undefined") return;
    didAttemptRestoreRef.current = true;

    if (hasIssueListFilterParams(searchParams)) return;

    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      didRestoreStoredFiltersRef.current = true;
      const restored = new URLSearchParams(searchParams.toString());
      const storedParams = new URLSearchParams(stored);
      storedParams.forEach((value, key) => restored.set(key, value));
      router.replace(`${pathname}?${restored.toString()}`);
    }
  }, [pathname, router, searchParams, storageKey]);

  useEffect(() => {
    if (!didAttemptRestoreRef.current || typeof window === "undefined") return;
    if (didRestoreStoredFiltersRef.current && !hasIssueListFilterParams(searchParams)) return;
    didRestoreStoredFiltersRef.current = false;
    const stored = buildStoredParams(searchParams);
    if (stored) {
      window.localStorage.setItem(storageKey, stored);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  }, [searchParams, storageKey]);

  const updateQueryParams = useCallback((updates: Record<string, string | string[] | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    let pageChanged = false;

    for (const [key, value] of Object.entries(updates)) {
      if (key === "page") pageChanged = true;

      if (Array.isArray(value)) {
        if (value.length > 0) {
          params.set(key, value.join(","));
        } else {
          params.delete(key);
        }
      } else if (value !== null && value !== "") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    if (!pageChanged && Object.keys(updates).length > 0) {
      params.set("page", "1");
    }

    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  return {
    filters: {
      statusFilter,
      typeFilter,
      priorityFilter,
      planFilter,
      sprintFilter,
      assigneeFilter,
      watcherFilter,
      view,
      dueFilter,
      dueDateValue,
      duePreset,
      search,
    },
    pagination: {
      page,
      pageSize,
    },
    sorting: {
      sortBy,
      sortDirection,
    },
    updateQueryParams,
  };
}
