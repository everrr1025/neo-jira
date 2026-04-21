import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getActiveProjectForUser } from "@/lib/activeProject";
import { buildProjectItemsWhere } from "@/lib/activeProjectUtils";
import { getCurrentLocale } from "@/lib/serverLocale";
import {
  getTranslations,
  localeDateMap,
  type Locale,
} from "@/lib/i18n";
import { formatActivityEntry, type ActivityLogEntry } from "@/lib/activityLogFormatter";
import { getDefaultAvatar } from "@/lib/avatar";
import DashboardIssueTabsCard from "@/components/DashboardIssueTabsCard";
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

type DashboardActivityLog = ActivityLogEntry & {
  issueId: string | null;
  projectId: string | null;
  actor: {
    id: string;
    name: string | null;
    avatar: string | null;
  } | null;
};

type DashboardActivityIssue = {
  id: string;
  key: string;
  title: string;
  project: {
    key: string;
    name: string;
  };
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
  const activeProject = await getActiveProjectForUser(userId, userRole);
  if (!activeProject) {
    redirect("/projects");
  }

  const projectFilter = buildProjectItemsWhere(activeProject.id);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const nextThreeDays = new Date(startOfToday);
  nextThreeDays.setDate(nextThreeDays.getDate() + 3);

  const yesterday = new Date(startOfToday);
  yesterday.setDate(yesterday.getDate() - 1);

  const query = typeof params?.search === "string" ? params.search.trim() : "";

  const [
    statusSummaryIssues,
    myAssignedIssuesRaw,
    watchedIssuesRaw,
    highPriorityIssuesRaw,
    overdueIssuesRaw,
    dueSoonIssuesRaw,
    activeIteration,
    searchResults,
    recentActivity,
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
    prisma.iteration.findFirst({
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
    }),
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
    prisma.auditLog.findMany({
      where: projectFilter,
      include: {
        actor: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.project.findMany({
      where: { id: activeProject.id },
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

  const typedRecentActivity = recentActivity as DashboardActivityLog[];
  const recentActivityIssueIds = [...new Set(typedRecentActivity.map((entry) => entry.issueId).filter(Boolean))] as string[];
  const assigneeIds = [
    ...new Set(
      typedRecentActivity.flatMap((entry) =>
        entry.field === "assigneeId" ? [entry.oldValue, entry.newValue].filter(Boolean) : [],
      ),
    ),
  ] as string[];
  const iterationIds = [
    ...new Set(
      typedRecentActivity.flatMap((entry) =>
        entry.field === "iterationId" ? [entry.oldValue, entry.newValue].filter(Boolean) : [],
      ),
    ),
  ] as string[];

  const [activityIssues, activityUsers, activityIterations] = await Promise.all([
    recentActivityIssueIds.length > 0
      ? prisma.issue.findMany({
          where: { id: { in: recentActivityIssueIds } },
          select: {
            id: true,
            key: true,
            title: true,
            project: { select: { key: true, name: true } },
          },
        })
      : Promise.resolve([]),
    assigneeIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    iterationIds.length > 0
      ? prisma.iteration.findMany({
          where: { id: { in: iterationIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const activityIssueMap = new Map(activityIssues.map((issue) => [issue.id, issue as DashboardActivityIssue]));
  const activityAssigneeNameById = Object.fromEntries(
    activityUsers.map((user) => [user.id, user.name || user.id]),
  );
  const activityIterationNameById = Object.fromEntries(
    activityIterations.map((iteration) => [iteration.id, iteration.name]),
  );

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
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              {typedActiveIteration ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
                          {typedActiveIteration.name}
                        </h3>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          {translations.dashboard.activeStatus}
                        </span>
                      </div>
                      {isGlobalAdmin && (
                        <p className="mt-1 text-sm text-slate-500">
                          {typedActiveIteration.project.name} ({typedActiveIteration.project.key})
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/iterations/${typedActiveIteration.id}`}
                      className="inline-flex h-10 items-center rounded-full bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                    >
                      {translations.dashboard.viewBoard}
                    </Link>
                  </div>

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

                  <div className="pt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{translations.dashboard.sprintProgress}</span>
                      <span className="font-semibold text-slate-900">{sprintProgress}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                        style={{ width: `${sprintProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span className="font-medium text-slate-700">
                      {typedActiveIteration.startDate.toLocaleDateString(localeDateMap[locale])}
                    </span>
                    <span className="text-slate-300">-</span>
                    <span className="font-medium text-slate-700">
                      {typedActiveIteration.endDate.toLocaleDateString(localeDateMap[locale])}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
                      {translations.dashboard.noActiveSprint}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600">{translations.iterationsPage.subtitle}</p>
                  <Link
                    href="/iterations"
                    className="inline-flex h-10 items-center rounded-full bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    {translations.sidebar.iterations}
                  </Link>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {translations.issuesPage.title}
                </h3>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
            <RecentActivityCard
              activity={typedRecentActivity}
              issuesById={activityIssueMap}
              assigneeNameById={activityAssigneeNameById}
              iterationNameById={activityIterationNameById}
              locale={locale}
              isGlobalAdmin={isGlobalAdmin}
            />
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className={`text-3xl font-bold ${tone}`}>{value}</span>
        <span className="text-xs font-medium text-slate-400">{percentage}%</span>
      </div>
      <div className={`mt-4 h-2 rounded-full ${rail}`}>
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
    <div className="rounded-2xl bg-slate-50 px-3 py-3 border border-slate-100">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function RecentActivityCard({
  activity,
  issuesById,
  assigneeNameById,
  iterationNameById,
  locale,
  isGlobalAdmin,
}: {
  activity: DashboardActivityLog[];
  issuesById: Map<string, DashboardActivityIssue>;
  assigneeNameById: Record<string, string>;
  iterationNameById: Record<string, string>;
  locale: Locale;
  isGlobalAdmin: boolean;
}) {
  const translations = getTranslations(locale);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{translations.dashboard.recentActivity}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
          {activity.length}
        </span>
      </div>

      {activity.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {translations.dashboard.noRecentActivity}
        </div>
      ) : (
        <div className="space-y-3">
          {activity.map((entry) => {
            const issue = entry.issueId ? issuesById.get(entry.issueId) : undefined;
            const message = formatActivityEntry(entry, locale, {
              assigneeNameById,
              iterationNameById,
            });
            const avatarUrl = entry.actor?.avatar || getDefaultAvatar(entry.actor?.id || entry.id);

            return (
              <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50">
                <div className="flex gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white">
                    <Image
                      src={avatarUrl}
                      alt={entry.actor?.name || translations.activitySection.unknownUser}
                      width={40}
                      height={40}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-medium leading-6 text-slate-800">{message.primary}</div>
                      <div className="shrink-0 text-xs text-slate-400">
                        {new Date(entry.createdAt).toLocaleString(localeDateMap[locale])}
                      </div>
                    </div>
                    {message.secondary ? (
                      <div className="mt-1 line-clamp-2 text-sm text-slate-500">{message.secondary}</div>
                    ) : null}
                    {issue ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-400">{translations.dashboard.activityForIssue}</span>
                        <Link href={`/issues/${issue.id}`} className="font-semibold text-blue-600 hover:underline">
                          {issue.key}
                        </Link>
                        <span className="truncate text-slate-600">{issue.title}</span>
                        {isGlobalAdmin ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-600">
                            {issue.project.key}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function getStatusBadgeClass(status: string, workflowStatuses: WorkflowStatusRecord[] = []) {
  return `text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getWorkflowStatusBadgeClass(
    status,
    workflowStatuses
  )}`;
}
