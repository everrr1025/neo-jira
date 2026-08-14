"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPriorityLabel, getTranslations, localeDateMap, type Locale } from "@/lib/i18n";
import {
  getWorkflowStatusBadgeClass,
  getWorkflowStatusName,
  type WorkflowStatusRecord,
} from "@/lib/workflows";
import { getProjectPath, parseProjectPath } from "@/lib/projectRoutes";

type DashboardIssue = {
  id: string;
  projectId: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | Date | null;
};

type IssueTab = {
  id: string;
  title: string;
  issues: DashboardIssue[];
  emptyText: string;
  meta: "status" | "priority" | "dueDate";
  accent: "blue" | "orange" | "rose";
  href: string;
  count: number;
};

export default function DashboardIssueTabsCard({
  tabs,
  locale,
  workflowProjects,
  initialTabId,
  title,
  allIssuesHref,
}: {
  tabs: IssueTab[];
  locale: Locale;
  workflowProjects: Array<{
    id: string;
    workflowStatuses: WorkflowStatusRecord[];
  }>;
  initialTabId?: string;
  title?: string;
  allIssuesHref?: string;
}) {
  const [activeTab, setActiveTab] = useState(() =>
    tabs.some((tab) => tab.id === initialTabId) ? initialTabId ?? "" : tabs[0]?.id ?? "",
  );
  const projectRoute = parseProjectPath(usePathname());
  const translations = getTranslations(locale);
  const workflowStatusByProject = useMemo(
    () => new Map(workflowProjects.map((project) => [project.id, project.workflowStatuses])),
    [workflowProjects]
  );

  const currentTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTab) ?? tabs[0],
    [activeTab, tabs],
  );

  if (!currentTab) return null;

  const accentClass =
    currentTab.accent === "blue"
      ? "hover:border-blue-300 hover:bg-blue-50/40"
      : currentTab.accent === "orange"
        ? "hover:border-orange-300 hover:bg-orange-50/40"
        : "hover:border-rose-300 hover:bg-rose-50/40";

  return (
    <section className="overflow-hidden rounded-xl border bg-background">
      <div className="flex flex-col gap-3 border-b bg-muted/35 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">{title ?? currentTab.title}</h3>
          <Link
            href={currentTab.href}
            className="inline-flex shrink-0 justify-end rounded-md py-1 text-xs font-semibold text-muted-foreground hover:text-accent-foreground"
          >
            {translations.dashboard.viewAll}
          </Link>
        </div>

        <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5">
          {tabs.map((tab) => {
            const isActive = tab.id === currentTab.id;
            return (
              <Button
                key={tab.id}
                type="button"
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={`h-7 shrink-0 gap-1 rounded-full px-2 text-xs ${tab.count === 0 && !isActive ? "text-muted-foreground opacity-60" : ""}`}
              >
                <span>{tab.title}</span>
                <Badge
                  variant="ghost"
                  className={`border-0 bg-transparent px-1 text-current hover:bg-transparent ${isActive ? "text-white" : "text-muted-foreground"}`}
                >
                  {tab.count}
                </Badge>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {currentTab.issues.length > 0 ? (
          currentTab.issues.map((issue) => (
            <Link
              key={issue.id}
              href={projectRoute ? getProjectPath(projectRoute.departmentId, projectRoute.projectId, "issues", issue.id) : `/issues/${issue.id}`}
              className={`block rounded-xl border p-3 transition-colors ${accentClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold text-muted-foreground">{issue.key}</span>
                <span className={getIssueMetaBadge(currentTab.meta, issue, workflowStatusByProject)}>
                  {getIssueMetaText(currentTab.meta, issue, locale, workflowStatusByProject)}
                </span>
              </div>
              <h4 className="mt-2 text-sm font-medium text-foreground line-clamp-2">{issue.title}</h4>
            </Link>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            <span>{currentTab.emptyText}</span>
            {currentTab.count > 0 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={allIssuesHref ?? currentTab.href}>{translations.dashboard.viewAllIssues}</Link>
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function getIssueMetaText(
  meta: "status" | "priority" | "dueDate",
  issue: DashboardIssue,
  locale: Locale,
  workflowStatusByProject: Map<string, WorkflowStatusRecord[]>
) {
  if (meta === "dueDate") {
    const dueDate = issue.dueDate ? new Date(issue.dueDate) : null;
    return dueDate ? dueDate.toLocaleDateString(localeDateMap[locale]) : "--";
  }

  if (meta === "priority") {
    return getPriorityLabel(issue.priority, locale);
  }

  return getWorkflowStatusName(issue.status, workflowStatusByProject.get(issue.projectId) || [], locale);
}

function getIssueMetaBadge(
  meta: "status" | "priority" | "dueDate",
  issue: DashboardIssue,
  workflowStatusByProject: Map<string, WorkflowStatusRecord[]>
) {
  if (meta === "dueDate") {
    return "text-[11px] font-bold text-rose-600";
  }

  if (meta === "priority") {
    return getPriorityBadgeClass(issue.priority);
  }

  return `text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getWorkflowStatusBadgeClass(
    issue.status,
    workflowStatusByProject.get(issue.projectId) || []
  )}`;
}

function getPriorityBadgeClass(priority: string) {
  if (priority === "URGENT") {
    return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700";
  }

  if (priority === "HIGH") {
    return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700";
  }

  if (priority === "MEDIUM") {
    return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700";
  }

  return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700";
}
