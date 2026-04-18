import prisma from "@/lib/prisma";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { CreateSprintButton } from "@/components/CreateSprintButton";
import { redirect } from "next/navigation";
import { getActiveProjectIdForUser } from "@/lib/activeProject";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getIterationStatusLabel, getTranslations, localeDateMap } from "@/lib/i18n";
import { getWorkflowStatusCategory } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
  role?: string | null;
};

export default async function IterationsPage() {
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
  let activeProject: { id: string; name: string; key: string } | null = null;

  if (!isGlobalAdmin) {
    activeProjectId = await getActiveProjectIdForUser(userId, userRole);
    if (!activeProjectId) redirect("/projects");

    activeProject = await prisma.project.findUnique({
      where: { id: activeProjectId },
      select: { id: true, name: true, key: true },
    });
    if (!activeProject) redirect("/projects");
  }

  let adminProjects: { id: string; name: string; key: string }[] = [];
  if (isGlobalAdmin) {
    adminProjects = await prisma.project.findMany({
      select: { id: true, name: true, key: true },
    });
  } else {
    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: activeProjectId! } },
      include: { project: { select: { id: true, name: true, key: true } } },
    });

    if (membership?.role === "ADMIN") {
      adminProjects = [membership.project];
    }
  }

  const canManageSprints = adminProjects.length > 0;

  let iterations = await prisma.iteration.findMany({
    where: isGlobalAdmin ? {} : { projectId: activeProjectId! },
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
      _count: {
        select: { issues: true },
      },
      issues: {
        select: { status: true },
      },
    },
    orderBy: { startDate: "desc" },
  });

  iterations = [...iterations].sort((a, b) => {
    const statusOrder: Record<string, number> = { ACTIVE: 0, PLANNED: 1, COMPLETED: 2 };
    const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return b.startDate.getTime() - a.startDate.getTime();
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{translations.iterationsPage.title}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {translations.iterationsPage.subtitle}
          </p>
        </div>
        {canManageSprints && (
          <CreateSprintButton projects={adminProjects} locale={locale} />
        )}
      </div>

      <div className="grid gap-4">
        {iterations.map((iteration) => {
          const totalIssues = iteration._count.issues;
          const completedIssues = iteration.issues.filter(
            (issue) => getWorkflowStatusCategory(issue.status, iteration.project.workflowStatuses) === "DONE"
          ).length;
          const progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

          return (
            <Link href={`/iterations/${iteration.id}`} key={iteration.id} className="block">
              <div className="bg-white rounded-xl border shadow-sm p-5 hover:border-slate-300 hover:shadow-md transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-800">{iteration.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                      iteration.status === "ACTIVE" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      iteration.status === "PLANNED" ? "bg-slate-50 text-slate-600 border-slate-200" :
                      "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {getIterationStatusLabel(iteration.status, locale)}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{iteration.project.key}</span>
                  </div>
                  <div className="text-sm text-slate-500 font-medium">
                    {iteration.startDate.toLocaleDateString(localeDateMap[locale])} - {iteration.endDate.toLocaleDateString(localeDateMap[locale])}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-4">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">{translations.iterationsPage.issues}</span>
                      <span className="font-semibold text-slate-800">{totalIssues}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">{translations.iterationsPage.completed}</span>
                      <span className="font-semibold text-slate-800">{completedIssues}</span>
                    </div>
                  </div>

                  <div className="w-full sm:w-1/3 min-w-[200px]">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">{translations.iterationsPage.progress}</span>
                      <span className="font-bold text-slate-700">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${iteration.status === "COMPLETED" ? "bg-emerald-500" : "bg-blue-500"}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        {iterations.length === 0 && (
          <div className="text-center py-12 bg-white border border-dashed rounded-xl">
            <p className="text-slate-500 font-medium">{translations.iterationsPage.noIterations}</p>
          </div>
        )}
      </div>
    </div>
  );
}
