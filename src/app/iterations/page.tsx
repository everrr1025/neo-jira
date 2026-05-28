import prisma from "@/lib/prisma";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { CreateSprintButton } from "@/components/CreateSprintButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { getActiveProjectForUser } from "@/lib/activeProject";
import { buildProjectItemsWhere } from "@/lib/activeProjectUtils";
import { canManageProjectPlanning } from "@/lib/permissions";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getIterationStatusLabel, getTranslations, localeDateMap } from "@/lib/i18n";
import { getWorkflowStatusCategory } from "@/lib/workflows";
import { CalendarDays, CheckCircle2, CircleDot, ListChecks } from "lucide-react";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
  role?: string | null;
};

function getIterationStatusClassName(status: string) {
  if (status === "ACTIVE") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "PLANNED") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getProgressClassName(status: string) {
  return status === "COMPLETED" ? "bg-emerald-500" : "bg-blue-500";
}

export default async function IterationsPage() {
  const locale = await getCurrentLocale();
  const translations = getTranslations(locale);
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as typeof session.user & SessionUser;
  const userId = sessionUser.id;
  const userRole = sessionUser.role ?? "USER";
  if (!userId) redirect("/login");

  const activeProject = await getActiveProjectForUser(userId, userRole);
  if (!activeProject) redirect("/projects");

  const canCreateSprints = await canManageProjectPlanning(userId, activeProject.id);
  const sprintCreateProjects = canCreateSprints ? [activeProject] : [];

  let iterations = await prisma.iteration.findMany({
    where: buildProjectItemsWhere(activeProject.id),
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{translations.iterationsPage.title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {translations.iterationsPage.subtitle}
          </p>
        </div>
        {canCreateSprints && (
          <CreateSprintButton projects={sprintCreateProjects} locale={locale} />
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
              <Card className="gap-0 py-0 transition-colors hover:border-foreground/20">
                <CardHeader className="border-b px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <CardTitle className="truncate text-lg" title={iteration.name}>
                          {iteration.name}
                        </CardTitle>
                        <Badge variant="outline" className={getIterationStatusClassName(iteration.status)}>
                          {getIterationStatusLabel(iteration.status, locale)}
                        </Badge>
                        <Badge variant="secondary" className="rounded-md">
                          {iteration.project.key}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      <CalendarDays className="size-4" />
                      <span>
                        {iteration.startDate.toLocaleDateString(localeDateMap[locale])} -{" "}
                        {iteration.endDate.toLocaleDateString(localeDateMap[locale])}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_minmax(220px,33%)] sm:items-center">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                      <ListChecks className="size-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{translations.iterationsPage.issues}</span>
                      <span className="ml-auto font-semibold">{totalIssues}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                      <CheckCircle2 className="size-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{translations.iterationsPage.completed}</span>
                      <span className="ml-auto font-semibold">{completedIssues}</span>
                    </div>
                  </div>

                  <div className="w-full">
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="font-medium text-muted-foreground">{translations.iterationsPage.progress}</span>
                      <span className="font-semibold">{progress}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${getProgressClassName(iteration.status)}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {iterations.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                <CircleDot className="size-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{translations.iterationsPage.noIterations}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
