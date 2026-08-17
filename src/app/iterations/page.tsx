import prisma from "@/lib/prisma";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { CreateSprintButton } from "@/components/CreateSprintButton";
import DeadlineHint from "@/components/DeadlineHint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { redirect } from "next/navigation";
import { getActiveProjectForUser, getRequestedProjectRouteContext } from "@/lib/activeProject";
import { buildProjectItemsWhere } from "@/lib/activeProjectUtils";
import { canManageProjectPlanning } from "@/lib/permissions";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getIterationStatusLabel, getTranslations, localeDateMap } from "@/lib/i18n";
import { getWorkflowStatusCategory } from "@/lib/workflows";
import { CircleDot } from "lucide-react";
import { getProjectPath } from "@/lib/projectRoutes";
import { getIterationTiming } from "@/lib/projectDashboard";

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
  if (!(await getRequestedProjectRouteContext())) {
    redirect(getProjectPath(activeProject.departmentId, activeProject.id, "iterations"));
  }

  const canCreateSprints = await canManageProjectPlanning(userId, activeProject.id);
  const sprintCreateProjects = canCreateSprints ? [activeProject] : [];

  let iterations = await prisma.iteration.findMany({
    where: buildProjectItemsWhere(activeProject.id),
    include: {
      project: {
        select: {
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
    if (a.status === "ACTIVE") return a.endDate.getTime() - b.endDate.getTime();
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
        {iterations.length > 0 && (
          <Card className="gap-0 py-0">
            <Table className="table-fixed min-w-[960px]">
              <colgroup>
                <col />
                <col className="w-[120px]" />
                <col className="w-[320px]" />
                <col className="w-[240px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{translations.iterationsPage.title}</TableHead>
                  <TableHead>{translations.issueList.status}</TableHead>
                  <TableHead>{locale === "zh" ? "周期" : "Period"}</TableHead>
                  <TableHead>{translations.iterationsPage.completion}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {iterations.map((iteration) => {
                  const totalIssues = iteration._count.issues;
                  const completedIssues = iteration.issues.filter(
                    (issue) => getWorkflowStatusCategory(issue.status, iteration.project.workflowStatuses) === "DONE"
                  ).length;
                  const progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;
                  const deadlineTiming = iteration.status === "ACTIVE" ? getIterationTiming(iteration.endDate) : null;

                  return (
                    <TableRow key={iteration.id}>
                      <TableCell className="min-w-0">
                        <Link
                          href={getProjectPath(activeProject.departmentId, activeProject.id, "iterations", iteration.id)}
                          className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                          title={iteration.name}
                        >
                          {iteration.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getIterationStatusClassName(iteration.status)}>
                          {getIterationStatusLabel(iteration.status, locale)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span>
                            {iteration.startDate.toLocaleDateString(localeDateMap[locale])} -{" "}
                            {iteration.endDate.toLocaleDateString(localeDateMap[locale])}
                          </span>
                          <DeadlineHint timing={deadlineTiming} locale={locale} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                            {completedIssues}/{totalIssues}
                          </span>
                          <div className="h-2 min-w-12 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${getProgressClassName(iteration.status)}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums">{progress}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
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
