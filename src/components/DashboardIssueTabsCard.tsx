"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  href: string;
  count: number;
};

export default function DashboardIssueTabsCard({
  tabs,
  locale,
  workflowProjects,
  initialTabId,
  title,
}: {
  tabs: IssueTab[];
  locale: Locale;
  workflowProjects: Array<{
    id: string;
    workflowStatuses: WorkflowStatusRecord[];
  }>;
  initialTabId?: string;
  title?: string;
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

  return (
    <section aria-label={title ?? currentTab.title} className="w-full min-w-0 overflow-hidden rounded-xl border bg-background">
      <Tabs value={currentTab.id} onValueChange={setActiveTab} className="min-w-0 gap-0">
      <div className="flex min-w-0 items-center gap-2 border-b bg-muted/35 px-4 py-3">
        <h3 className="shrink-0 text-sm font-semibold text-foreground">{title ?? currentTab.title}</h3>
        <div className="w-0 min-w-0 flex-1 overflow-x-auto">
          <TabsList variant="line" aria-label={title ?? currentTab.title} className="p-0 group-data-[orientation=horizontal]/tabs:h-7">
            {tabs.map((tab) => <TabsTrigger key={tab.id} value={tab.id} className="flex-none gap-1 px-2 text-xs after:hidden">
              {tab.title}<span className="text-[11px] tabular-nums text-muted-foreground">{tab.count}</span>
            </TabsTrigger>)}
          </TabsList>
        </div>
        <div className="flex w-12 shrink-0 justify-end">
          {currentTab.count > 5 ? <Link href={currentTab.href} className="inline-flex shrink-0 justify-end rounded-md py-1 text-xs font-semibold text-muted-foreground hover:text-accent-foreground">{translations.dashboard.viewAll}</Link> : null}
        </div>
      </div>

      <TabsContent value={currentTab.id} className="min-w-0 py-2">
        {currentTab.issues.length > 0 ? (
          currentTab.issues.map((issue) => (
            <Link
              key={issue.id}
              href={projectRoute ? getProjectPath(projectRoute.departmentId, projectRoute.projectId, "issues", issue.id) : `/issues/${issue.id}`}
              title={issue.title}
              className="flex h-10 w-full min-w-0 items-center gap-2 px-4 transition-colors hover:bg-muted/40"
            >
              <span className="shrink-0 text-xs text-muted-foreground">{issue.key}</span>
              <h4 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{issue.title}</h4>
              <span className={`shrink-0 whitespace-nowrap ${getIssueMetaBadge(currentTab.meta, issue, workflowStatusByProject)}`}>
                {getIssueMetaText(currentTab.meta, issue, locale, workflowStatusByProject)}
              </span>
            </Link>
          ))
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            <span>{currentTab.emptyText}</span>
          </div>
        )}
      </TabsContent>
      </Tabs>
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
