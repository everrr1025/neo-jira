import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, CircleDot, ListChecks, Target } from "lucide-react";

import CreatePlanButton from "@/components/CreatePlanButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveProjectForUser } from "@/lib/activeProject";
import { buildProjectItemsWhere } from "@/lib/activeProjectUtils";
import { authOptions } from "@/lib/authOptions";
import { canManageProjectPlanning } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";
import { localeDateMap } from "@/lib/i18n";
import { getWorkflowStatusCategory } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
  role?: string | null;
};

function normalizeDateOnly(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getPlanStatusKey(dateRange: { startDate: Date; endDate: Date }) {
  const today = normalizeDateOnly(new Date());
  const startDate = normalizeDateOnly(new Date(dateRange.startDate));
  const endDate = normalizeDateOnly(new Date(dateRange.endDate));

  if (today < startDate) return "PLANNED";
  if (today > endDate) return "COMPLETED";
  return "ACTIVE";
}

function getPlanStatus(dateRange: { startDate: Date; endDate: Date }, locale: "en" | "zh") {
  const statusKey = getPlanStatusKey(dateRange);

  if (statusKey === "PLANNED") {
    return {
      label: locale === "zh" ? "未开始" : "Planned",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (statusKey === "COMPLETED") {
    return {
      label: locale === "zh" ? "已结束" : "Completed",
      className: "border-slate-200 bg-slate-100 text-slate-700",
    };
  }

  return {
    label: locale === "zh" ? "进行中" : "Active",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  };
}

function getProgressClassName(statusKey: string) {
  return statusKey === "COMPLETED" ? "bg-emerald-500" : "bg-blue-500";
}

function getPlanPageText(locale: "en" | "zh") {
  if (locale === "zh") {
    return {
      title: "计划",
      subtitle: "按阶段目标管理任务池，并跟踪整体推进情况。",
      empty: "当前项目下还没有计划。",
      total: "问题数",
      done: "已完成",
      backlog: "未进迭代",
      progress: "进度",
      target: "目标数",
    };
  }

  return {
    title: "Plans",
    subtitle: "Track medium-term delivery goals and their overall progress.",
    empty: "No plans have been created for the active project yet.",
    total: "Issue Count",
    done: "Done",
    backlog: "Not in sprint",
    progress: "Progress",
    target: "Target",
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

  const [plans, workflowProject] = await Promise.all([
    prisma.plan.findMany({
      where: buildProjectItemsWhere(activeProject.id),
      include: {
        issues: {
          select: {
            status: true,
            iterationId: true,
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
    const aStatus = getPlanStatusKey({ startDate: a.startDate, endDate: a.endDate });
    const bStatus = getPlanStatusKey({ startDate: b.startDate, endDate: b.endDate });
    const statusOrder = { ACTIVE: 0, PLANNED: 1, COMPLETED: 2 } as const;

    if (statusOrder[aStatus] !== statusOrder[bStatus]) {
      return statusOrder[aStatus] - statusOrder[bStatus];
    }

    if (aStatus === "ACTIVE") {
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    }

    if (aStatus === "PLANNED") {
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    }

    return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
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
        <div className="grid gap-4">
          {sortedPlans.map((plan) => {
            const totalIssues = plan.issues.length;
            const status = getPlanStatus({ startDate: plan.startDate, endDate: plan.endDate }, locale);
            const statusKey = getPlanStatusKey({ startDate: plan.startDate, endDate: plan.endDate });
            const doneIssues = plan.issues.filter(
              (issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "DONE"
            ).length;
            const backlogIssues = plan.issues.filter((issue) => issue.iterationId == null).length;
            const progress = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;

            return (
              <Link href={`/plans/${plan.id}`} key={plan.id} className="block">
                <Card className="gap-0 py-0 transition-colors hover:border-foreground/20">
                  <CardHeader className="border-b px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <CardTitle className="truncate text-lg" title={plan.name}>
                            {plan.name}
                          </CardTitle>
                          <Badge variant="outline" className={status.className}>
                            {status.label}
                          </Badge>
                          {typeof plan.targetCount === "number" && plan.targetCount > 0 ? (
                            <Badge variant="secondary" className="rounded-md">
                              {text.target} {plan.targetCount}
                            </Badge>
                          ) : null}
                        </div>
                        {plan.description ? (
                          <p className="line-clamp-2 text-sm text-muted-foreground">{plan.description}</p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <CalendarDays className="size-4" />
                        <span>
                          {plan.startDate.toLocaleDateString(localeDateMap[locale])} -{" "}
                          {plan.endDate.toLocaleDateString(localeDateMap[locale])}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_minmax(220px,33%)] lg:items-center">
                    <div className="grid gap-2 text-sm sm:grid-cols-3">
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                        <ListChecks className="size-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{text.total}</span>
                        <span className="ml-auto font-semibold">{totalIssues}</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                        <CheckCircle2 className="size-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{text.done}</span>
                        <span className="ml-auto font-semibold">{doneIssues}</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                        <Target className="size-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{text.backlog}</span>
                        <span className="ml-auto font-semibold">{backlogIssues}</span>
                      </div>
                    </div>

                    <div className="w-full">
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="font-medium text-muted-foreground">{text.progress}</span>
                        <span className="font-semibold">{progress}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${getProgressClassName(statusKey)}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
