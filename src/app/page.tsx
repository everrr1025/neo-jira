import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveProjectForUser, getVisibleProjectsForUser } from "@/lib/activeProject";
import { buildProjectItemsWhere } from "@/lib/activeProjectUtils";
import { getCurrentLocale } from "@/lib/serverLocale";
import {
  getTranslations,
  localeDateMap,
} from "@/lib/i18n";
import DashboardIssueTabsCard from "@/components/DashboardIssueTabsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserDepartmentMembership } from "@/lib/departmentAccess";
import {
  getWorkflowStatusBadgeClass,
  getWorkflowStatusCategory,
  getWorkflowStatusName,
  type WorkflowStatusRecord,
} from "@/lib/workflows";

export const dynamic = "force-dynamic";

type ActiveIterationSummary = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  project: {
    name: string;
    key: string;
    workflowStatuses: WorkflowStatusRecord[];
  };
  issues: {
    status: string;
  }[];
};

type SessionUser = {
  id?: string;
  role?: string | null;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function formatDateQueryValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const locale = await getCurrentLocale();
  const translations = getTranslations(locale);
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as typeof session.user & SessionUser;
  const userId = sessionUser.id;
  const userRole = sessionUser.role ?? "USER";
  if (!userId) redirect("/login");

  const isGlobalAdmin = userRole === "ADMIN";
  const query = typeof params?.search === "string" ? params.search.trim() : "";
  const activeProject = await getActiveProjectForUser(userId, userRole);
  if (!activeProject && !isGlobalAdmin && !query) {
    const departmentMembership = await getUserDepartmentMembership(userId);
    if (departmentMembership) {
      redirect(`/departments/${departmentMembership.departmentId}`);
    }
  }
  const visibleProjects = !activeProject ? await getVisibleProjectsForUser(userId, userRole) : [];

  const projectFilter = activeProject
    ? buildProjectItemsWhere(activeProject.id)
    : { projectId: { in: visibleProjects.map((p) => p.id) } };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const nextThreeDays = new Date(startOfToday);
  nextThreeDays.setDate(nextThreeDays.getDate() + 3);

  const yesterday = new Date(startOfToday);
  yesterday.setDate(yesterday.getDate() - 1);

  const [
    statusSummaryIssues,
    myAssignedIssuesRaw,
    watchedIssuesRaw,
    highPriorityIssuesRaw,
    overdueIssuesRaw,
    dueSoonIssuesRaw,
    activeIteration,
    searchResults,
    workflowProjects,
  ] = await Promise.all([
    prisma.issue.findMany({
      where: projectFilter,
      select: {
        projectId: true,
        status: true,
      },
    }),
    prisma.issue.findMany({
      where: { ...projectFilter, assigneeId: userId },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        projectId: true,
        key: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
      },
    }),
    prisma.issue.findMany({
      where: {
        ...projectFilter,
        watchers: {
          some: { id: userId },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        projectId: true,
        key: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
      },
    }),
    prisma.issue.findMany({
      where: {
        ...projectFilter,
        priority: { in: ["HIGH", "URGENT"] },
      },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        projectId: true,
        key: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
      },
    }),
    prisma.issue.findMany({
      where: {
        ...projectFilter,
        dueDate: { not: null, lt: startOfToday },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        projectId: true,
        key: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
      },
    }),
    prisma.issue.findMany({
      where: {
        ...projectFilter,
        dueDate: { not: null, gte: startOfToday, lte: nextThreeDays },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        projectId: true,
        key: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
      },
    }),
    activeProject
      ? prisma.iteration.findFirst({
          where: { projectId: activeProject.id, status: "ACTIVE" },
          include: {
            project: {
              select: {
                name: true,
                key: true,
                workflowStatuses: {
                  orderBy: { position: "asc" },
                },
              },
            },
            issues: { select: { status: true } },
          },
          orderBy: { endDate: "asc" },
        })
      : Promise.resolve(null),
    query
      ? prisma.issue.findMany({
          where: {
            ...projectFilter,
            OR: [{ key: { contains: query } }, { title: { contains: query } }],
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            projectId: true,
            key: true,
            title: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    prisma.project.findMany({
      where: activeProject ? { id: activeProject.id } : { id: { in: visibleProjects.map((p) => p.id) } },
      select: {
        id: true,
        workflowStatuses: {
          orderBy: { position: "asc" },
        },
      },
    }),
  ]);

  const workflowStatusByProjectId = new Map(
    workflowProjects.map((project) => [project.id, project.workflowStatuses as WorkflowStatusRecord[]]),
  );
  const isDoneIssue = (projectId: string, status: string) =>
    getWorkflowStatusCategory(status, workflowStatusByProjectId.get(projectId) || []) === "DONE";

  const totalIssues = statusSummaryIssues.length;
  const todoCount = statusSummaryIssues.filter(
    (issue) => getWorkflowStatusCategory(issue.status, workflowStatusByProjectId.get(issue.projectId) || []) === "TODO"
  ).length;
  const inProgressCount = statusSummaryIssues.filter(
    (issue) =>
      getWorkflowStatusCategory(issue.status, workflowStatusByProjectId.get(issue.projectId) || []) === "IN_PROGRESS"
  ).length;
  const doneCount = statusSummaryIssues.filter((issue) => isDoneIssue(issue.projectId, issue.status)).length;

  const myIssues = myAssignedIssuesRaw.filter((issue) => !isDoneIssue(issue.projectId, issue.status)).slice(0, 5);
  const watchedIssues = watchedIssuesRaw.filter((issue) => !isDoneIssue(issue.projectId, issue.status)).slice(0, 5);
  const highPriorityIssues = highPriorityIssuesRaw.filter((issue) => !isDoneIssue(issue.projectId, issue.status)).slice(0, 5);
  const overdueIssues = overdueIssuesRaw.filter((issue) => !isDoneIssue(issue.projectId, issue.status)).slice(0, 5);
  const dueSoonIssues = dueSoonIssuesRaw.filter((issue) => !isDoneIssue(issue.projectId, issue.status)).slice(0, 5);

  const myIssuesTotal = myAssignedIssuesRaw.filter((issue) => !isDoneIssue(issue.projectId, issue.status)).length;
  const watchedIssuesTotal = watchedIssuesRaw.filter((issue) => !isDoneIssue(issue.projectId, issue.status)).length;
  const highPriorityIssuesTotal = highPriorityIssuesRaw.filter((issue) => !isDoneIssue(issue.projectId, issue.status)).length;
  const overdueIssuesTotal = overdueIssuesRaw.filter((issue) => !isDoneIssue(issue.projectId, issue.status)).length;
  const dueSoonIssuesTotal = dueSoonIssuesRaw.filter((issue) => !isDoneIssue(issue.projectId, issue.status)).length;

  const typedActiveIteration = activeIteration as ActiveIterationSummary | null;
  const sprintIssueCount = typedActiveIteration?.issues.length ?? 0;
  const sprintCompletedCount =
    typedActiveIteration?.issues.filter((issue) =>
      getWorkflowStatusCategory(issue.status, typedActiveIteration.project.workflowStatuses) === "DONE"
    ).length ?? 0;
  const sprintProgress =
    sprintIssueCount > 0 ? Math.round((sprintCompletedCount / sprintIssueCount) * 100) : 0;
  const sprintDaysLeft = typedActiveIteration
    ? Math.max(0, Math.ceil((typedActiveIteration.endDate.getTime() - startOfToday.getTime()) / DAY_IN_MS))
    : null;

  const stats = [
    {
      id: "total",
      label: translations.dashboard.totalIssues,
      value: totalIssues,
      tone: "text-slate-900",
      rail: "bg-slate-200",
      fill: "bg-slate-800",
    },
    {
      id: "todo",
      label: translations.dashboard.toDo,
      value: todoCount,
      tone: "text-amber-700",
      rail: "bg-amber-100",
      fill: "bg-amber-500",
    },
    {
      id: "in-progress",
      label: translations.dashboard.inProgress,
      value: inProgressCount,
      tone: "text-blue-700",
      rail: "bg-blue-100",
      fill: "bg-blue-500",
    },
    {
      id: "done",
      label: translations.dashboard.done,
      value: doneCount,
      tone: "text-emerald-700",
      rail: "bg-emerald-100",
      fill: "bg-emerald-500",
    },
  ];

  const assignedToMeHref = `/issues?assignee=ME`;
  const watchedIssuesHref = `/issues?watcher=ME`;
  const highPriorityHref = `/issues?priority=HIGH,URGENT`;
  const overdueHref = `/issues?dueOp=LTE&dueDate=${formatDateQueryValue(yesterday)}`;
  const dueSoonHref = `/issues?duePreset=NEXT_3_DAYS`;

  if (query) {
    return (
      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{translations.dashboard.searchResultsFor}</p>
              <h3 className="text-lg font-semibold text-slate-900">{query}</h3>
            </div>
            <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
              {translations.dashboard.clearSearch}
            </Link>
          </div>
          <div className="space-y-3 p-4">
            {searchResults.length > 0 ? (
              searchResults.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/issues/${issue.id}`}
                  className="group block rounded-xl border p-4 transition-colors hover:border-blue-300 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-500 group-hover:text-blue-600">
                      {issue.key}
                    </span>
                    <span className={getStatusBadgeClass(issue.status, workflowStatusByProjectId.get(issue.projectId) || [])}>
                      {getWorkflowStatusName(issue.status, workflowStatusByProjectId.get(issue.projectId) || [], locale)}
                    </span>
                  </div>
                  <h4 className="mt-2 text-sm font-medium text-slate-800">{issue.title}</h4>
                </Link>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-slate-400">
                {translations.dashboard.noIssuesFound} <span>&quot;{query}&quot;</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!activeProject && isGlobalAdmin) {
    const [adminUserCount, adminDeptCount, adminProjectCount] = await Promise.all([
      prisma.user.count(),
      prisma.department.count(),
      prisma.project.count(),
    ]);

    const adminDashText = locale === "zh"
      ? { title: "系统管理概览", subtitle: "全局概览与系统管理", totalUsers: "用户总数", totalDepts: "部门总数", totalProjects: "项目总数", totalIssues: "问题总数" }
      : { title: "System Admin Dashboard", subtitle: "Global overview & system management", totalUsers: "Total Users", totalDepts: "Total Departments", totalProjects: "Total Projects", totalIssues: "Total Issues" };

    return (
      <div className="space-y-8">
        <section>
          <div className="mb-6 flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{adminDashText.title}</h1>
            <p className="text-sm text-slate-500">{adminDashText.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{adminDashText.totalUsers}</p>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-3xl font-bold text-indigo-700">{adminUserCount}</span>
                <svg className="h-8 w-8 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{adminDashText.totalDepts}</p>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-3xl font-bold text-emerald-700">{adminDeptCount}</span>
                <svg className="h-8 w-8 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{adminDashText.totalProjects}</p>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-3xl font-bold text-blue-700">{adminProjectCount}</span>
                <svg className="h-8 w-8 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{adminDashText.totalIssues}</p>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-3xl font-bold text-amber-700">{totalIssues}</span>
                <svg className="h-8 w-8 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="space-y-8">
        <section>
          <div className="mb-6 flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Department Portal
            </h1>
            <p className="text-sm text-slate-500">Cross-project overview & activity</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibleProjects.length === 0 ? (
              <div className="col-span-full p-6 text-center text-sm text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                You do not have access to any projects.
              </div>
            ) : (
              visibleProjects.map((p) => (
                <Link key={p.id} href={`/projects/${p.key}`} className="group flex flex-col p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-4 mb-1">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-sm">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{p.name}</h3>
                      <p className="text-xs text-slate-500">{p.key}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section>
          <DashboardIssueTabsCard
            locale={locale}
            workflowProjects={workflowProjects.map((project) => ({
              id: project.id,
              workflowStatuses: project.workflowStatuses as WorkflowStatusRecord[],
            }))}
            tabs={[
              {
                id: "assigned",
                title: translations.dashboard.assignedToMe || "Assigned to Me",
                issues: myIssues,
                emptyText: translations.dashboard.noTasksAssigned || "No tasks assigned",
                meta: "status",
                accent: "blue",
                href: assignedToMeHref,
                count: myIssuesTotal,
              },
              {
                id: "priority",
                title: translations.dashboard.highPriority || "High Priority",
                issues: highPriorityIssues,
                emptyText: translations.dashboard.noHighPriorityIssues || "No high priority tasks",
                meta: "priority",
                accent: "rose",
                href: highPriorityHref,
                count: highPriorityIssuesTotal,
              },
              {
                id: "watched",
                title: translations.dashboard.watchedIssues || "Watched",
                issues: watchedIssues,
                emptyText: translations.dashboard.notWatchingAnyActiveIssues || "Not watching any issues",
                meta: "status",
                accent: "blue",
                href: watchedIssuesHref,
                count: watchedIssuesTotal,
              },
            ]}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {query ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{translations.dashboard.searchResultsFor}</p>
              <h3 className="font-semibold text-slate-900 text-lg">{query}</h3>
            </div>
            <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
              {translations.dashboard.clearSearch}
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {searchResults.length > 0 ? (
              searchResults.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/issues/${issue.id}`}
                  className="block p-4 border rounded-xl hover:border-blue-300 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-500 group-hover:text-blue-600">
                      {issue.key}
                    </span>
                    <span className={getStatusBadgeClass(issue.status, workflowStatusByProjectId.get(issue.projectId) || [])}>
                      {getWorkflowStatusName(issue.status, workflowStatusByProjectId.get(issue.projectId) || [], locale)}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-slate-800 mt-2">{issue.title}</h4>
                </Link>
              ))
            ) : (
              <div className="text-center text-sm text-slate-400 py-8">
                {translations.dashboard.noIssuesFound} <span>&quot;{query}&quot;</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
            <Card>
              {typedActiveIteration ? (
                <>
                  <CardHeader>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-2xl tracking-tight">
                          {typedActiveIteration.name}
                        </CardTitle>
                        <Badge variant="secondary" className="text-blue-700">
                          {translations.dashboard.activeStatus}
                        </Badge>
                      </div>
                      {isGlobalAdmin && (
                        <CardDescription className="mt-1">
                          {typedActiveIteration.project.name} ({typedActiveIteration.project.key})
                        </CardDescription>
                      )}
                    </div>
                    <CardAction>
                      <Button asChild>
                        <Link href={`/iterations/${typedActiveIteration.id}`}>
                          {translations.dashboard.viewBoard}
                        </Link>
                      </Button>
                    </CardAction>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <SprintMetric
                        label={translations.dashboard.daysLeft}
                        value={String(sprintDaysLeft ?? 0)}
                      />
                      <SprintMetric
                        label={translations.dashboard.issuesInSprint}
                        value={String(sprintIssueCount)}
                      />
                      <SprintMetric
                        label={translations.dashboard.completedIssues}
                        value={String(sprintCompletedCount)}
                      />
                    </div>

                    <div className="space-y-2 pt-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{translations.dashboard.sprintProgress}</span>
                        <span className="font-semibold text-foreground">{sprintProgress}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${sprintProgress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {typedActiveIteration.startDate.toLocaleDateString(localeDateMap[locale])}
                      </span>
                      <span>-</span>
                      <span className="font-medium text-foreground">
                        {typedActiveIteration.endDate.toLocaleDateString(localeDateMap[locale])}
                      </span>
                    </div>
                  </CardContent>
                </>
              ) : (
                <>
                  <CardHeader>
                    <CardTitle className="text-2xl tracking-tight">
                      {translations.dashboard.noActiveSprint}
                    </CardTitle>
                    <CardDescription>{translations.iterationsPage.subtitle}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild>
                      <Link href="/iterations">
                        {translations.sidebar.iterations}
                      </Link>
                    </Button>
                  </CardContent>
                </>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">
                  {translations.issuesPage.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {stats.map((stat) => (
                  <IssueOverviewStat
                    key={stat.id}
                    label={stat.label}
                    value={stat.value}
                    tone={stat.tone}
                    rail={stat.rail}
                    fill={stat.fill}
                    total={totalIssues}
                  />
                ))}
              </CardContent>
            </Card>
          </section>

          <section>
            <DashboardIssueTabsCard
              locale={locale}
              workflowProjects={workflowProjects.map((project) => ({
                id: project.id,
                workflowStatuses: project.workflowStatuses as WorkflowStatusRecord[],
              }))}
              tabs={[
                {
                  id: "assigned",
                  title: translations.dashboard.assignedToMe,
                  issues: myIssues,
                  emptyText: translations.dashboard.noTasksAssigned,
                  meta: "status",
                  accent: "blue",
                  href: assignedToMeHref,
                  count: myIssuesTotal,
                },
                {
                  id: "watched",
                  title: translations.dashboard.watchedIssues,
                  issues: watchedIssues,
                  emptyText: translations.dashboard.notWatchingAnyActiveIssues,
                  meta: "status",
                  accent: "blue",
                  href: watchedIssuesHref,
                  count: watchedIssuesTotal,
                },
                {
                  id: "priority",
                  title: translations.dashboard.highPriority,
                  issues: highPriorityIssues,
                  emptyText: translations.dashboard.noHighPriorityIssues,
                  meta: "priority",
                  accent: "rose",
                  href: highPriorityHref,
                  count: highPriorityIssuesTotal,
                },
                {
                  id: "overdue",
                  title: translations.dashboard.overdue,
                  issues: overdueIssues,
                  emptyText: translations.dashboard.noOverdueIssues,
                  meta: "dueDate",
                  accent: "rose",
                  href: overdueHref,
                  count: overdueIssuesTotal,
                },
                {
                  id: "due-soon",
                  title: translations.dashboard.dueSoon,
                  issues: dueSoonIssues,
                  emptyText: translations.dashboard.noTasksDueThisWeek,
                  meta: "dueDate",
                  accent: "orange",
                  href: dueSoonHref,
                  count: dueSoonIssuesTotal,
                },
              ]}
            />
          </section>
        </>
      )}
    </div>
  );
}

function IssueOverviewStat({
  label,
  value,
  tone,
  rail,
  fill,
  total,
}: {
  label: string;
  value: number;
  tone: string;
  rail: string;
  fill: string;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className={`text-3xl font-bold ${tone}`}>{value}</span>
        <span className="text-xs font-medium text-muted-foreground">{percentage}%</span>
      </div>
      <div className={`mt-4 h-2 overflow-hidden rounded-full ${rail}`}>
        <div
          className={`h-full rounded-full ${fill}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SprintMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function getStatusBadgeClass(status: string, workflowStatuses: WorkflowStatusRecord[] = []) {
  return `text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getWorkflowStatusBadgeClass(
    status,
    workflowStatuses
  )}`;
}
