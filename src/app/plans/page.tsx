import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { CircleDot } from "lucide-react";

import CreatePlanButton from "@/components/CreatePlanButton";
import DeadlineHint from "@/components/DeadlineHint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getActiveProjectForUser, getRequestedProjectRouteContext } from "@/lib/activeProject";
import { buildProjectItemsWhere } from "@/lib/activeProjectUtils";
import { authOptions } from "@/lib/authOptions";
import { canManageProjectPlanning } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";
import { localeDateMap } from "@/lib/i18n";
import { getWorkflowStatusCategory } from "@/lib/workflows";
import { getProjectPath } from "@/lib/projectRoutes";
import { getIterationTiming } from "@/lib/projectDashboard";
import { getPlanDateHint, getPlanStatusOrder, getPlanStatusPresentation } from "@/lib/planLifecycle";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
  role?: string | null;
};

function getProgressClassName(statusKey: string) {
  if (statusKey === "COMPLETED") return "bg-emerald-500";
  if (statusKey === "CANCELLED") return "bg-slate-400";
  return "bg-blue-500";
}

function getPlanPageText(locale: "en" | "zh") {
  if (locale === "zh") {
    return {
      title: "计划",
      subtitle: "按阶段目标管理任务池，并跟踪整体推进情况。",
      empty: "当前项目下还没有计划。",
      completion: "完成情况",
      period: "周期",
      status: "状态",
    };
  }

  return {
    title: "Plans",
    subtitle: "Track medium-term delivery goals and their overall progress.",
    empty: "No plans have been created for the active project yet.",
    completion: "Completion",
    period: "Period",
    status: "Status",
  };
}

export default async function PlansPage() {
  const locale = await getCurrentLocale();
  const text = getPlanPageText(locale);
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as typeof session.user & SessionUser;
  const userId = sessionUser.id;
  const userRole = sessionUser.role ?? "USER";
  if (!userId) redirect("/login");
  const activeProject = await getActiveProjectForUser(userId, userRole);
  if (!activeProject) redirect("/projects");
  if (!(await getRequestedProjectRouteContext())) {
    redirect(getProjectPath(activeProject.departmentId, activeProject.id, "plans"));
  }

  const [plans, workflowProject] = await Promise.all([
    prisma.plan.findMany({
      where: buildProjectItemsWhere(activeProject.id),
      include: {
        issues: {
          select: {
            status: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.project.findUnique({
      where: { id: activeProject.id },
      select: {
        workflowStatuses: {
          orderBy: { position: "asc" },
        },
      },
    }),
  ]);

  const canCreatePlans = await canManageProjectPlanning(userId, activeProject.id);
  const workflowStatuses = workflowProject?.workflowStatuses || [];
  const sortedPlans = [...plans].sort((a, b) => {
    if (getPlanStatusOrder(a.status) !== getPlanStatusOrder(b.status)) {
      return getPlanStatusOrder(a.status) - getPlanStatusOrder(b.status);
    }

    if (a.status === "ACTIVE") {
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    }

    if (a.status === "PLANNED") {
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{text.title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{text.subtitle}</p>
        </div>
        {canCreatePlans ? (
          <CreatePlanButton projectId={activeProject.id} locale={locale} />
        ) : null}
      </div>

      {plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <CircleDot className="size-5" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{text.empty}</p>
          </CardContent>
        </Card>
      ) : (
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
                <TableHead>{text.title}</TableHead>
                <TableHead>{text.status}</TableHead>
                <TableHead>{text.period}</TableHead>
                <TableHead>{text.completion}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlans.map((plan) => {
                const totalIssues = plan.issues.length;
                const status = getPlanStatusPresentation(plan.status, locale);
                const statusKey = plan.status;
                const dateHint = getPlanDateHint(plan, locale);
                const deadlineTiming = plan.status === "ACTIVE" ? getIterationTiming(plan.endDate) : null;
                const doneIssues = plan.issues.filter(
                  (issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "DONE"
                ).length;
                const progress = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;

                return (
                  <TableRow key={plan.id}>
                    <TableCell className="min-w-0">
                      <Link
                        href={getProjectPath(activeProject.departmentId, activeProject.id, "plans", plan.id)}
                        className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                        title={plan.name}
                      >
                        {plan.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span>
                          {plan.startDate.toLocaleDateString(localeDateMap[locale])} -{" "}
                          {plan.endDate.toLocaleDateString(localeDateMap[locale])}
                        </span>
                        <DeadlineHint timing={deadlineTiming} locale={locale} />
                        {!deadlineTiming && dateHint ? <span className="text-xs">{dateHint}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                          {doneIssues}/{totalIssues}
                        </span>
                        <div className="h-2 min-w-12 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${getProgressClassName(statusKey)}`}
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
    </div>
  );
}
