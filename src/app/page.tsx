import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveProjectIdForUser } from "@/lib/activeProject";
import { getCurrentLocale } from "@/lib/serverLocale";
import {
  getPriorityLabel,
  getStatusLabel,
  getTranslations,
  localeDateMap,
  type Locale,
} from "@/lib/i18n";

export const dynamic = "force-dynamic";

type DashboardIssue = {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
};

type ActiveIterationSummary = {
  id: string;
  name: string;
  endDate: Date;
  project: {
    name: string;
    key: string;
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
  let activeProjectId: string | null = null;
  if (!isGlobalAdmin) {
    activeProjectId = await getActiveProjectIdForUser(userId, userRole);
    if (!activeProjectId) {
      redirect("/projects");
    }

    const activeProject = await prisma.project.findUnique({
      where: { id: activeProjectId },
      select: { id: true },
    });

    if (!activeProject) {
      redirect("/projects");
    }
  }

  const projectFilter = isGlobalAdmin ? {} : { projectId: activeProjectId! };
  const openIssueFilter = { ...projectFilter, status: { not: "DONE" as const } };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const nextWeek = new Date(startOfToday);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const query = typeof params?.search === "string" ? params.search.trim() : "";

  const [
    totalIssues,
    todoCount,
    inProgressCount,
    inTestingCount,
    doneCount,
    myIssues,
    highPriorityIssues,
    overdueIssues,
    dueSoonIssues,
    activeIteration,
    searchResults,
  ] = await Promise.all([
    prisma.issue.count({ where: projectFilter }),
    prisma.issue.count({ where: { ...projectFilter, status: "TODO" } }),
    prisma.issue.count({ where: { ...projectFilter, status: "IN_PROGRESS" } }),
    prisma.issue.count({ where: { ...projectFilter, status: "IN_TESTING" } }),
    prisma.issue.count({ where: { ...projectFilter, status: "DONE" } }),
    prisma.issue.findMany({
      where: { ...openIssueFilter, assigneeId: userId },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 5,
      select: {
        id: true,
        key: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
      },
    }),
    prisma.issue.findMany({
      where: {
        ...openIssueFilter,
        priority: { in: ["HIGH", "URGENT"] },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
      select: {
        id: true,
        key: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
      },
    }),
    prisma.issue.findMany({
      where: {
        ...openIssueFilter,
        dueDate: { not: null, lt: startOfToday },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 5,
      select: {
        id: true,
        key: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
      },
    }),
    prisma.issue.findMany({
      where: {
        ...openIssueFilter,
        dueDate: { not: null, gte: startOfToday, lte: nextWeek },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 5,
      select: {
        id: true,
        key: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
      },
    }),
    prisma.iteration.findFirst({
      where: isGlobalAdmin ? { status: "ACTIVE" } : { projectId: activeProjectId!, status: "ACTIVE" },
      include: {
        project: { select: { name: true, key: true } },
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
            key: true,
            title: true,
            status: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const typedActiveIteration = activeIteration as ActiveIterationSummary | null;
  const sprintIssueCount = typedActiveIteration?.issues.length ?? 0;
  const sprintCompletedCount =
    typedActiveIteration?.issues.filter((issue) => issue.status === "DONE").length ?? 0;
  const sprintProgress =
    sprintIssueCount > 0 ? Math.round((sprintCompletedCount / sprintIssueCount) * 100) : 0;
  const sprintDaysLeft = typedActiveIteration
    ? Math.max(0, Math.ceil((typedActiveIteration.endDate.getTime() - startOfToday.getTime()) / DAY_IN_MS))
    : null;

  const stats = [
    {
      label: translations.dashboard.totalIssues,
      value: totalIssues,
      tone: "text-slate-900",
      rail: "bg-slate-200",
      fill: "bg-slate-800",
    },
    {
      label: translations.dashboard.toDo,
      value: todoCount,
      tone: "text-amber-700",
      rail: "bg-amber-100",
      fill: "bg-amber-500",
    },
    {
      label: translations.dashboard.inProgress,
      value: inProgressCount,
      tone: "text-blue-700",
      rail: "bg-blue-100",
      fill: "bg-blue-500",
    },
    {
      label: translations.dashboard.inTesting,
      value: inTestingCount,
      tone: "text-violet-700",
      rail: "bg-violet-100",
      fill: "bg-violet-500",
    },
    {
      label: translations.dashboard.done,
      value: doneCount,
      tone: "text-emerald-700",
      rail: "bg-emerald-100",
      fill: "bg-emerald-500",
    },
  ];

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
                    <span className={getStatusBadgeClass(issue.status)}>
                      {getStatusLabel(issue.status, locale)}
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
                          {locale === "zh" ? "进行中" : "Active"}
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
                      {locale === "zh" ? "看板" : translations.dashboard.viewBoard}
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

                  <div className="text-sm text-slate-500">
                    {translations.dashboard.sprintEnds}:{" "}
                    <span className="font-medium text-slate-700">
                      {typedActiveIteration.endDate.toLocaleDateString(localeDateMap[locale])}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {translations.dashboard.activeSprint}
                    </p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
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
                    key={stat.label}
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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <IssueCollectionCard
              title={translations.dashboard.assignedToMe}
              issues={myIssues}
              emptyText={translations.dashboard.noTasksAssigned}
              locale={locale}
              meta="status"
              accent="blue"
            />
            <IssueCollectionCard
              title={translations.dashboard.highPriority}
              issues={highPriorityIssues}
              emptyText={translations.dashboard.noHighPriorityIssues}
              locale={locale}
              meta="priority"
              accent="rose"
            />
            <IssueCollectionCard
              title={translations.dashboard.overdue}
              issues={overdueIssues}
              emptyText={translations.dashboard.noOverdueIssues}
              locale={locale}
              meta="dueDate"
              accent="rose"
            />
            <IssueCollectionCard
              title={translations.dashboard.dueSoon}
              issues={dueSoonIssues}
              emptyText={translations.dashboard.noTasksDueThisWeek}
              locale={locale}
              meta="dueDate"
              accent="orange"
            />
          </div>
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

function IssueCollectionCard({
  title,
  issues,
  emptyText,
  locale,
  meta,
  accent,
}: {
  title: string;
  issues: DashboardIssue[];
  emptyText: string;
  locale: Locale;
  meta: "status" | "priority" | "dueDate";
  accent: "blue" | "orange" | "rose";
}) {
  const accentClass =
    accent === "blue"
      ? "hover:border-blue-300 hover:bg-blue-50/40"
      : accent === "orange"
        ? "hover:border-orange-300 hover:bg-orange-50/40"
        : "hover:border-rose-300 hover:bg-rose-50/40";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-80">
      <div className="p-5 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="p-4 space-y-3">
        {issues.length > 0 ? (
          issues.map((issue) => (
            <Link
              key={issue.id}
              href={`/issues/${issue.id}`}
              className={`block rounded-xl border border-slate-200 p-3 transition-colors ${accentClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold text-slate-500">{issue.key}</span>
                <span className={getIssueMetaBadge(meta, issue)}>{getIssueMetaText(meta, issue, locale)}</span>
              </div>
              <h4 className="mt-2 text-sm font-medium text-slate-800 line-clamp-2">{issue.title}</h4>
            </Link>
          ))
        ) : (
          <div className="text-center text-sm text-slate-400 py-10">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

function getIssueMetaText(meta: "status" | "priority" | "dueDate", issue: DashboardIssue, locale: Locale) {
  if (meta === "dueDate") {
    return issue.dueDate ? issue.dueDate.toLocaleDateString(localeDateMap[locale]) : "--";
  }

  if (meta === "priority") {
    return getPriorityLabel(issue.priority, locale);
  }

  return getStatusLabel(issue.status, locale);
}

function getIssueMetaBadge(meta: "status" | "priority" | "dueDate", issue: DashboardIssue) {
  if (meta === "dueDate") {
    return "text-[11px] font-bold text-rose-600";
  }

  if (meta === "priority") {
    return getPriorityBadgeClass(issue.priority);
  }

  return getStatusBadgeClass(issue.status);
}

function getStatusBadgeClass(status: string) {
  if (status === "DONE") {
    return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700";
  }

  if (status === "IN_PROGRESS" || status === "IN_TESTING") {
    return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700";
  }

  return "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600";
}

function getPriorityBadgeClass(priority: string) {
  if (priority === "URGENT") {
    return `text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700`;
  }

  if (priority === "HIGH") {
    return `text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700`;
  }

  if (priority === "MEDIUM") {
    return `text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700`;
  }

  return `text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700`;
}
