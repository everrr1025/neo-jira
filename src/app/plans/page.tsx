import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { CircleDot } from "lucide-react";

import CreatePlanButton from "@/components/CreatePlanButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      current: "当前问题数",
      done: "已完成",
      progress: "进度",
      target: "目标数",
      period: "周期",
      status: "状态",
    };
  }

  return {
    title: "Plans",
    subtitle: "Track medium-term delivery goals and their overall progress.",
    empty: "No plans have been created for the active project yet.",
    current: "Current Issues",
    done: "Done",
    progress: "Progress",
    target: "Target",
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
        <Card className="gap-0 py-0">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[280px]">{text.title}</TableHead>
                <TableHead>{text.status}</TableHead>
                <TableHead>{text.period}</TableHead>
                <TableHead className="text-right">{text.target}</TableHead>
                <TableHead className="text-right">{text.current}</TableHead>
                <TableHead className="text-right">{text.done}</TableHead>
                <TableHead className="w-[180px]">{text.progress}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlans.map((plan) => {
                const totalIssues = plan.issues.length;
                const status = getPlanStatus({ startDate: plan.startDate, endDate: plan.endDate }, locale);
                const statusKey = getPlanStatusKey({ startDate: plan.startDate, endDate: plan.endDate });
                const doneIssues = plan.issues.filter(
                  (issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "DONE"
                ).length;
                const progress = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;

                return (
                  <TableRow key={plan.id}>
                    <TableCell className="max-w-[280px]">
                      <Link
                        href={`/plans/${plan.id}`}
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
                      {plan.startDate.toLocaleDateString(localeDateMap[locale])} -{" "}
                      {plan.endDate.toLocaleDateString(localeDateMap[locale])}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {typeof plan.targetCount === "number" ? plan.targetCount : null}
                    </TableCell>
                    <TableCell className="text-right font-medium">{totalIssues}</TableCell>
                    <TableCell className="text-right font-medium">{doneIssues}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${getProgressClassName(statusKey)}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="w-9 text-right text-xs font-semibold">{progress}%</span>
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
