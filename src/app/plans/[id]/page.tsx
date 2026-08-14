import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import DeletePlanButton from "@/components/DeletePlanButton";
import EditPlanButton from "@/components/EditPlanButton";
import IssueList from "@/components/IssueList";
import PlanIssueActionButton from "@/components/PlanIssueActionButton";
import PlanLifecycleActions from "@/components/PlanLifecycleActions";
import { getActiveProjectForUser, getRequestedProjectRouteContext } from "@/lib/activeProject";
import { getProjectPath } from "@/lib/projectRoutes";
import { buildProjectItemsWhere, buildProjectUsersWhere } from "@/lib/activeProjectUtils";
import { authOptions } from "@/lib/authOptions";
import { canConfigureProjectFields, getProjectRole } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getWorkflowStatusCategory } from "@/lib/workflows";
import { getPlanDateHint, getPlanStatusPresentation, isTerminalPlanStatus } from "@/lib/planLifecycle";
import { parseIssueSearchParams } from "@/lib/issueFilterUtils";
import {
  hasExplicitIssueListParams,
  searchParamsRecordToUrlSearchParams,
  type IssueListPreferenceScope,
} from "@/lib/issueListPreferences";
import {
  getIssueListInitialPreferences,
  getSavedIssueListFilterQuery,
} from "@/lib/issueListPreferenceServer";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
  role?: string | null;
};

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
  if (!(await getRequestedProjectRouteContext())) {
    redirect(getProjectPath(activeProject.departmentId, activeProject.id, "plans", resolvedParams.id));
  }
  const plan = await prisma.plan.findFirst({
    where: {
      id: resolvedParams.id,
      projectId: activeProject.id,
    },
  });

  if (!plan) return notFound();

  const projectRole = await getProjectRole(userId, activeProject.id);
  const canManagePlans = projectRole === "ADMIN";

  const searchParamsData = await searchParams;
  const preferenceScope: IssueListPreferenceScope = {
    projectId: activeProject.id,
    surface: "PLAN",
    contextKey: plan.id,
  };
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
  const [initialPreferences, savedFilterQuery] = await Promise.all([
    getIssueListInitialPreferences(userId, preferenceScope),
    hasExplicitIssueListParams(searchParamsData)
      ? Promise.resolve("")
      : getSavedIssueListFilterQuery(userId, preferenceScope),
  ]);
  if (savedFilterQuery) {
    const restored = searchParamsRecordToUrlSearchParams(searchParamsData);
    new URLSearchParams(savedFilterQuery).forEach((value, key) => restored.set(key, value));
    redirect(`${getProjectPath(activeProject.departmentId, activeProject.id, "plans", plan.id)}?${restored.toString()}`);
  }
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

  const [
    issues,
    totalIssues,
    basicPlanIssues,
    users,
    plans,
    iterations,
    currentUser,
    unplannedIssuePage,
    parentIssues,
  ] = await Promise.all([
    prisma.issue.findMany({
      where: parsedWhere,
      include: {
        assignee: true,
        plan: {
          select: {
            id: true,
            name: true,
            status: true,
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
      select: { key: true, status: true },
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
    canManagePlans
      ? prisma.issue.findMany({
          where: { projectId: activeProject.id, planId: null },
          select: {
            id: true,
            key: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            assignee: { select: { name: true } },
          },
          orderBy: [{ status: "asc" }, { key: "asc" }],
          take: 21,
        })
      : Promise.resolve([]),
    canManagePlans
      ? prisma.issue.findMany({
          where: { projectId: activeProject.id },
          select: {
            id: true,
            key: true,
            title: true,
            type: true,
            parentIssueId: true,
          },
          orderBy: [{ createdAt: "desc" }, { key: "asc" }],
        })
      : Promise.resolve([]),
  ]);
  const canManageIssueFields = await canConfigureProjectFields(userId, activeProject.id);
  const unplannedIssues = unplannedIssuePage.slice(0, 20);
  const unplannedIssuesHasMore = unplannedIssuePage.length > 20;
  const status = getPlanStatusPresentation(plan.status, locale);
  const dateHint = getPlanDateHint(plan, locale);
  const isTerminal = isTerminalPlanStatus(plan.status);

  const workflowStatuses = workflowProjects[0]?.workflowStatuses || [];
  const planTotalIssues = basicPlanIssues.length;
  const doneIssues = basicPlanIssues.filter((issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "DONE").length;
  const inProgressIssues = basicPlanIssues.filter(
    (issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "IN_PROGRESS"
  ).length;
  const todoIssues = basicPlanIssues.filter((issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) === "TODO").length;
  const blockingIssueKeys = basicPlanIssues
    .filter((issue) => getWorkflowStatusCategory(issue.status, workflowStatuses) !== "DONE")
    .slice(0, 5)
    .map((issue) => issue.key);
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
            {dateHint ? <span className={`text-xs font-medium ${plan.status === "ACTIVE" && dateHint.includes(locale === "zh" ? "逾期" : "overdue") ? "text-red-600" : "text-muted-foreground"}`}>{dateHint}</span> : null}
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
          {canManagePlans && !isTerminal ? (
            <PlanIssueActionButton
              locale={locale}
              createIssue={{
                locale,
                users,
                plans,
                iterations,
                currentUserId: userId,
                canManagePlans: true,
                defaultPlanId: plan.id,
                parentIssues,
              }}
              addExistingIssues={{
                target: { type: "plan", id: plan.id, name: plan.name },
                issues: unplannedIssues,
                initialHasMore: unplannedIssuesHasMore,
                locale,
                workflowStatuses,
              }}
            />
          ) : null}
          {canManagePlans ? <PlanLifecycleActions planId={plan.id} status={plan.status} totalIssues={planTotalIssues} unfinishedIssues={planTotalIssues - doneIssues} blockingIssueKeys={blockingIssueKeys} locale={locale} /> : null}
          {canManagePlans && !isTerminal ? <EditPlanButton plan={plan} locale={locale} /> : null}
          {canManagePlans ? <DeletePlanButton planId={plan.id} projectId={plan.projectId} locale={locale} status={plan.status} /> : null}
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
        canManagePlanFields={canManageIssueFields && !isTerminal}
        canManagePlans={canManagePlans && !isTerminal}
        lockedPlanStatus={plan.status}
        preferenceScope={preferenceScope}
        initialPreferences={initialPreferences}
      />
    </div>
  );
}
