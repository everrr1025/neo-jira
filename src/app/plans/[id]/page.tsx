import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import DeletePlanButton from "@/components/DeletePlanButton";
import EditPlanButton from "@/components/EditPlanButton";
import IssueList from "@/components/IssueList";
import { getActiveProjectForUser } from "@/lib/activeProject";
import { buildProjectItemsWhere, buildProjectUsersWhere } from "@/lib/activeProjectUtils";
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

function getPlanStatus(dateRange: { startDate: Date; endDate: Date }, locale: "en" | "zh") {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(dateRange.startDate);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(dateRange.endDate);
  endDate.setHours(0, 0, 0, 0);

  if (today < startDate) {
    return {
      label: locale === "zh" ? "未开始" : "Planned",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (today > endDate) {
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

function getPlanDetailText(locale: "en" | "zh") {
  if (locale === "zh") {
    return {
      total: "问题数",
      done: "已完成",
      inProgress: "进行中",
      todo: "未开始",
    };
  }

  return {
    total: "Issue Count",
    done: "Done",
    inProgress: "In progress",
    todo: "Not started",
  };
}

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getCurrentLocale();
  const text = getPlanDetailText(locale);
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as typeof session.user & SessionUser;
  const userId = sessionUser.id;
  const userRole = sessionUser.role ?? "USER";
  if (!userId) redirect("/login");
  const isGlobalAdmin = userRole === "ADMIN";

  const activeProject = await getActiveProjectForUser(userId, userRole);
  if (!activeProject) redirect("/projects");

  const resolvedParams = await params;
  const plan = await prisma.plan.findFirst({
    where: {
      id: resolvedParams.id,
      projectId: activeProject.id,
    },
  });

  if (!plan) return notFound();

  const [issues, users, plans, iterations, workflowProjects, currentUser] = await Promise.all([
    prisma.issue.findMany({
      where: {
        projectId: activeProject.id,
        planId: plan.id,
      },
      include: {
        assignee: true,
        plan: {
          select: {
            id: true,
            name: true,
          },
        },
        reporter: true,
        iteration: true,
        watchers: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: buildProjectUsersWhere(activeProject.id),
      orderBy: { name: "asc" },
    }),
    prisma.plan.findMany({
      where: buildProjectItemsWhere(activeProject.id),
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.iteration.findMany({
      where: buildProjectItemsWhere(activeProject.id),
      orderBy: { startDate: "desc" },
    }),
    prisma.project.findMany({
      where: { id: activeProject.id },
      select: {
        id: true,
        workflowStatuses: {
          orderBy: { position: "asc" },
        },
        workflowTransitions: {
          select: {
            fromStatusId: true,
            toStatusId: true,
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  const projectRole = isGlobalAdmin ? "ADMIN" : await getProjectRole(userId, activeProject.id);
  const canManagePlans = projectRole === "ADMIN";
  const status = getPlanStatus({ startDate: plan.startDate, endDate: plan.endDate }, locale);

  const workflowStatuses = workflowProjects[0]?.workflowStatuses || [];
  const totalIssues = issues.length;
  const doneIssues = issues.filter((issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "DONE").length;
  const inProgressIssues = issues.filter(
    (issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "IN_PROGRESS"
  ).length;
  const todoIssues = issues.filter((issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "TODO").length;
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
      label: text.todo,
      value: todoIssues,
      valueClassName: "text-slate-800",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">{plan.name}</h2>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${status.className}`}>
              {status.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span>
              {plan.startDate.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")} -{" "}
              {plan.endDate.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
            </span>
          </div>
          {plan.description ? <p className="max-w-3xl text-sm text-slate-600">{plan.description}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canManagePlans ? <EditPlanButton plan={plan} locale={locale} /> : null}
          {canManagePlans ? <DeletePlanButton planId={plan.id} projectId={plan.projectId} locale={locale} /> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</div>
            <div className={`mt-2 text-2xl font-bold ${card.valueClassName}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <IssueList
          initialIssues={issues}
          users={users}
          plans={plans}
          iterations={iterations}
          workflowProjects={workflowProjects}
          currentUser={currentUser}
          locale={locale}
          lockedPlanId={plan.id}
          canManagePlans={canManagePlans}
        />
      </div>
    </div>
  );
}
