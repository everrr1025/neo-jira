import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import DeletePlanButton from "@/components/DeletePlanButton";
import EditPlanButton from "@/components/EditPlanButton";
import IssueList from "@/components/IssueList";
import { getActiveProjectForUser } from "@/lib/activeProject";
import { buildProjectItemsWhere, buildProjectUsersWhere } from "@/lib/activeProjectUtils";
import { authOptions } from "@/lib/authOptions";
import { canConfigureProjectFields, getProjectRole } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getWorkflowStatusCategory } from "@/lib/workflows";
import { parseIssueSearchParams } from "@/lib/issueFilterUtils";

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

export default async function PlanDetailPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const locale = await getCurrentLocale();
  const text = getPlanDetailText(locale);
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as typeof session.user & SessionUser;
  const userId = sessionUser.id;
  const userRole = sessionUser.role ?? "USER";
  if (!userId) redirect("/login");

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

  const searchParamsData = await searchParams;
  const [issueFieldDefinitions, planFieldDefinitions, workflowProjects] = await Promise.all([
    prisma.issueFieldDefinition.findMany({
      where: { projectId: activeProject.id },
      orderBy: { position: "asc" },
    }),
    prisma.planFieldDefinition.findMany({
      where: { planId: plan.id },
      orderBy: { position: "asc" },
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
  ]);
  const doneStatusKeys = workflowProjects[0]?.workflowStatuses
    .filter((status) => status.category === "DONE")
    .map((status) => status.key);
  const { where: parsedWhere, skip, take, orderBy, page, pageSize } = await parseIssueSearchParams(
    searchParamsData,
    activeProject.id,
    {
      lockedPlanId: plan.id,
      currentUserId: userId,
      doneStatusKeys,
      issueFieldDefinitions: issueFieldDefinitions.map((field) => ({
        id: field.id,
        type: field.type,
        source: "issue",
      })),
      planFieldDefinitions: planFieldDefinitions.map((field) => ({
        id: field.id,
        type: field.type,
        source: "plan",
      })),
    }
  );

  const [issues, totalIssues, basicPlanIssues, users, plans, iterations, currentUser] = await Promise.all([
    prisma.issue.findMany({
      where: parsedWhere,
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
        parentIssue: {
          select: {
            id: true,
            key: true,
            title: true,
            type: true,
          },
        },
        childIssues: {
          select: {
            id: true,
            status: true,
          },
        },
        _count: {
          select: {
            childIssues: true,
          },
        },
        watchers: {
          select: { id: true },
        },
        planFieldValues: {
          where: { planId: plan.id },
          select: {
            id: true,
            fieldDefinitionId: true,
            valueBoolean: true,
            valueNumber: true,
            valueText: true,
            valueOption: true,
          },
        },
        issueFieldValues: {
          select: {
            id: true,
            fieldDefinitionId: true,
            valueBoolean: true,
            valueNumber: true,
            valueText: true,
            valueOption: true,
          },
        },
      },
      orderBy,
      skip,
      take,
    }),
    prisma.issue.count({ where: parsedWhere }),
    // For progress bar calculation, we need ALL issues in the plan, unconditionally
    prisma.issue.findMany({
      where: {
        projectId: activeProject.id,
        planId: plan.id,
      },
      select: { status: true },
    }),
    prisma.user.findMany({
      where: buildProjectUsersWhere(activeProject.id, false),
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
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  const projectRole = await getProjectRole(userId, activeProject.id);
  const canManagePlans = projectRole === "ADMIN";
  const canManageIssueFields = await canConfigureProjectFields(userId, activeProject.id);
  const status = getPlanStatus({ startDate: plan.startDate, endDate: plan.endDate }, locale);

  const workflowStatuses = workflowProjects[0]?.workflowStatuses || [];
  const planTotalIssues = basicPlanIssues.length;
  const doneIssues = basicPlanIssues.filter((issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "DONE").length;
  const inProgressIssues = basicPlanIssues.filter(
    (issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "IN_PROGRESS"
  ).length;
  const todoIssues = basicPlanIssues.filter((issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "TODO").length;
  const summaryItems = [
    {
      label: text.total,
      value: planTotalIssues,
    },
    {
      label: text.done,
      value: doneIssues,
    },
    {
      label: text.inProgress,
      value: inProgressIssues,
    },
    {
      label: text.todo,
      value: todoIssues,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="break-words text-2xl font-bold tracking-tight text-slate-800" title={plan.name}>{plan.name}</h2>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${status.className}`}>
              {status.label}
            </span>
            <span className="whitespace-nowrap text-sm text-slate-500">
              <span aria-hidden="true" className="mr-2 text-slate-300">
                ·
              </span>
              {plan.startDate.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")} -{" "}
              {plan.endDate.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
            </span>
            {summaryItems.map((item) => (
              <span key={item.label} className="whitespace-nowrap text-sm text-slate-500">
                <span aria-hidden="true" className="mr-2 text-slate-300">
                  ·
                </span>
                <span>{item.label}</span>{" "}
                <span className="font-semibold text-slate-700">{item.value}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canManagePlans ? <EditPlanButton plan={plan} locale={locale} /> : null}
          {canManagePlans ? <DeletePlanButton planId={plan.id} projectId={plan.projectId} locale={locale} /> : null}
        </div>
      </div>

      <IssueList
        initialIssues={issues}
        totalIssues={totalIssues}
        page={page}
        pageSize={pageSize}
        users={users}
        plans={plans}
        iterations={iterations}
        workflowProjects={workflowProjects}
        currentUser={currentUser}
        locale={locale}
        activeProjectId={activeProject.id}
        issueFieldDefinitions={issueFieldDefinitions}
        canManageIssueFields={false}
        lockedPlanId={plan.id}
        planFieldDefinitions={planFieldDefinitions}
        canManagePlanFields={canManageIssueFields}
        canManagePlans={canManagePlans}
      />
    </div>
  );
}
