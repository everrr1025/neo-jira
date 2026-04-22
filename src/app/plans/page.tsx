import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import CreatePlanButton from "@/components/CreatePlanButton";
import { getActiveProjectForUser } from "@/lib/activeProject";
import { buildProjectItemsWhere } from "@/lib/activeProjectUtils";
import { authOptions } from "@/lib/authOptions";
import { getProjectRole } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";
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

function getPlanPageText(locale: "en" | "zh") {
  if (locale === "zh") {
    return {
      title: "计划",
      subtitle: "按阶段目标管理任务池，并跟踪整体推进情况。",
      empty: "当前项目下还没有计划。",
      total: "问题数",
      done: "已完成",
      inProgress: "进行中",
      backlog: "未进迭代",
    };
  }

  return {
    title: "Plans",
    subtitle: "Track medium-term delivery goals and their overall progress.",
    empty: "No plans have been created for the active project yet.",
    total: "Issue Count",
    done: "Done",
    inProgress: "In progress",
    backlog: "Not in sprint",
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
  const isGlobalAdmin = userRole === "ADMIN";

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

  const projectRole = isGlobalAdmin ? "ADMIN" : await getProjectRole(userId, activeProject.id);
  const canManagePlans = projectRole === "ADMIN";
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">{text.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{text.subtitle}</p>
        </div>
        {canManagePlans ? (
          <CreatePlanButton projectId={activeProject.id} locale={locale} />
        ) : null}
      </div>

      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white px-6 py-16 text-center text-slate-500">
          {text.empty}
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedPlans.map((plan) => {
            const totalIssues = plan.issues.length;
            const status = getPlanStatus({ startDate: plan.startDate, endDate: plan.endDate }, locale);
            const doneIssues = plan.issues.filter(
              (issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "DONE"
            ).length;
            const inProgressIssues = plan.issues.filter(
              (issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "IN_PROGRESS"
            ).length;
            const backlogIssues = plan.issues.filter((issue) => issue.iterationId == null).length;
            const summaryCards = [
              {
                label: text.total,
                value: totalIssues,
                valueClassName: "text-slate-800",
              },
              {
                label: text.done,
                value: doneIssues,
                valueClassName: "text-emerald-700",
              },
              {
                label: text.inProgress,
                value: inProgressIssues,
                valueClassName: "text-blue-700",
              },
              {
                label: text.backlog,
                value: backlogIssues,
                valueClassName: "text-amber-700",
              },
            ];

            return (
              <Link href={`/plans/${plan.id}`} key={plan.id} className="block">
                <div className="rounded-xl border bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
                  <div className="flex flex-col gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-800">{plan.name}</h3>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          {plan.startDate.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")} -{" "}
                          {plan.endDate.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
                        </p>
                      </div>
                      {plan.description ? <p className="text-sm text-slate-600">{plan.description}</p> : null}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {summaryCards.map((card) => (
                      <div key={card.label} className="rounded-lg bg-slate-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</div>
                        <div className={`mt-1 text-lg font-bold ${card.valueClassName}`}>{card.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
