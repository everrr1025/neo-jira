"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useIssueListFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  const dueFilter = searchParams.get("dueFilter") || "ALL";
  const dueDateValue = searchParams.get("dueDate") || "";
  const duePreset = searchParams.get("duePreset") || "NONE";
  
  const search = searchParams.get("search") || "";
  
  const page = parseInt(searchParams.get("page") || "1", 10) || 1;
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10) || 10;
  
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortDirection = searchParams.get("sortDirection") || "desc";

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
