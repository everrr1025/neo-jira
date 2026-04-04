import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveProjectIdForUser } from "@/lib/activeProject";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getStatusLabel, getTranslations, localeDateMap } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const params = await searchParams;
  const locale = await getCurrentLocale();
  const translations = getTranslations(locale);
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;
  const userRole = (session.user as any).role as string;
  const isGlobalAdmin = userRole === "ADMIN";

  let activeProjectId: string | null = null;
  let activeProject: { name: string; key: string } | null = null;

  if (!isGlobalAdmin) {
    activeProjectId = await getActiveProjectIdForUser(userId, userRole);
    if (!activeProjectId) {
      redirect("/projects");
    }

    activeProject = await prisma.project.findUnique({
      where: { id: activeProjectId },
      select: { name: true, key: true },
    });

    if (!activeProject) {
      redirect("/projects");
    }
  }

  const projectFilter = isGlobalAdmin ? {} : { projectId: activeProjectId! };

  const totalIssues = await prisma.issue.count({ where: projectFilter });
  const todoCount = await prisma.issue.count({ where: { ...projectFilter, status: "TODO" } });
  const inProgressCount = await prisma.issue.count({ where: { ...projectFilter, status: "IN_PROGRESS" } });
  const doneCount = await prisma.issue.count({ where: { ...projectFilter, status: "DONE" } });

  const myIssues = await prisma.issue.findMany({
    where: { ...projectFilter, assigneeId: userId, status: { not: "DONE" } },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  const watchedIssues = await prisma.issue.findMany({
    where: { ...projectFilter, watchers: { some: { id: userId } }, status: { not: "DONE" } },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const dueSoonIssues = await prisma.issue.findMany({
    where: { 
      ...projectFilter, 
      status: { not: "DONE" },
      dueDate: { lte: nextWeek, not: null }
    },
    orderBy: { dueDate: "asc" },
    take: 5,
  });

  const query = typeof params?.search === "string" ? params.search : "";
  let searchResults: any[] = [];
  if (query) {
    searchResults = await prisma.issue.findMany({
      where: {
        ...projectFilter,
        OR: [
          { key: { contains: query } },
          { title: { contains: query } },
        ]
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  return (
    <div className="space-y-6">
      {query ? (
        <div className="bg-white rounded-xl border shadow-sm flex flex-col h-fit">
          <div className="p-5 border-b border-slate-100 flex justify-between">
            <h3 className="font-semibold text-slate-800">{translations.dashboard.searchResultsFor} "{query}"</h3>
            <Link href="/" className="text-sm text-blue-600 hover:underline">{translations.dashboard.clearSearch}</Link>
          </div>
          <div className="p-4 space-y-3">
            {searchResults.length > 0 ? searchResults.map((issue) => (
              <Link key={issue.id} href={`/issues/${issue.id}`} className="block p-3 border rounded-lg hover:border-blue-300 hover:bg-slate-50 transition-colors group">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-blue-600">{issue.key}</span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    issue.status === "IN_PROGRESS" ? "bg-amber-100 text-amber-700" :
                    issue.status === "DONE" ? "bg-emerald-100 text-emerald-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>{getStatusLabel(issue.status, locale)}</span>
                </div>
                <h4 className="text-sm font-medium text-slate-800 mt-1">{issue.title}</h4>
              </Link>
            )) : (
              <div className="text-center text-sm text-slate-400 py-6">{translations.dashboard.noIssuesFound} "{query}"</div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: translations.dashboard.totalIssues, value: String(totalIssues), color: "text-blue-600", bg: "bg-blue-50" },
          { label: translations.dashboard.toDo, value: String(todoCount), color: "text-amber-600", bg: "bg-amber-50" },
          { label: translations.dashboard.inProgress, value: String(inProgressCount), color: "text-purple-600", bg: "bg-purple-50" },
          { label: translations.dashboard.done, value: String(doneCount), color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-slate-500 text-sm font-medium">{stat.label}</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${stat.color}`}>{stat.value}</span>
            </div>
            <div className={`mt-3 h-1 w-full rounded-full ${stat.bg}`}>
              <div
                className={`h-full rounded-full bg-current ${stat.color} opacity-50`}
                style={{ width: totalIssues > 0 ? `${Math.round((parseInt(stat.value, 10) / totalIssues) * 100)}%` : "0%" }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Assigned */}
        <div className="bg-white rounded-xl border shadow-sm flex flex-col h-fit">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">{translations.dashboard.assignedToMe}</h3>
          </div>
          <div className="p-4 space-y-3">
            {myIssues.length > 0 ? myIssues.map((issue) => (
              <Link key={issue.id} href={`/issues/${issue.id}`} className="block p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors group">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-blue-600">{issue.key}</span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    issue.status === "IN_PROGRESS" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                  }`}>{getStatusLabel(issue.status, locale)}</span>
                </div>
                <h4 className="text-sm font-medium text-slate-800 mt-1 line-clamp-2">{issue.title}</h4>
              </Link>
            )) : (
              <div className="text-center text-sm text-slate-400 py-6">{translations.dashboard.noTasksAssigned}</div>
            )}
          </div>
        </div>

        {/* Watched */}
        <div className="bg-white rounded-xl border shadow-sm flex flex-col h-fit">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">{translations.dashboard.watchedIssues}</h3>
          </div>
          <div className="p-4 space-y-3">
            {watchedIssues.length > 0 ? watchedIssues.map((issue) => (
              <Link key={issue.id} href={`/issues/${issue.id}`} className="block p-3 border rounded-lg hover:border-blue-300 hover:bg-slate-50 transition-colors group">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-semibold text-slate-500 group-hover:text-blue-600">{issue.key}</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{getStatusLabel(issue.status, locale)}</span>
                </div>
                <h4 className="text-sm font-medium text-slate-800 mt-1 line-clamp-2">{issue.title}</h4>
              </Link>
            )) : (
              <div className="text-center text-sm text-slate-400 py-6">{translations.dashboard.notWatchingAnyActiveIssues}</div>
            )}
          </div>
        </div>

        {/* Due Soon */}
        <div className="bg-white rounded-xl border shadow-sm flex flex-col h-fit">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">{translations.dashboard.dueSoon}</h3>
          </div>
          <div className="p-4 space-y-3">
            {dueSoonIssues.length > 0 ? dueSoonIssues.map((issue) => (
              <Link key={issue.id} href={`/issues/${issue.id}`} className="block p-3 border rounded-lg hover:border-red-300 hover:bg-red-50/50 transition-colors group">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-semibold text-red-500 group-hover:text-red-700">{issue.key}</span>
                  <span className="text-[10px] font-bold text-red-600">{new Date(issue.dueDate!).toLocaleDateString(localeDateMap[locale])}</span>
                </div>
                <h4 className="text-sm font-medium text-slate-800 mt-1 line-clamp-2">{issue.title}</h4>
              </Link>
            )) : (
              <div className="text-center text-sm text-slate-400 py-6">{translations.dashboard.noTasksDueThisWeek}</div>
            )}
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
