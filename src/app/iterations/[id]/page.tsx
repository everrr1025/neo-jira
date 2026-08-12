import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import CreateIssueButton from "@/components/CreateIssueButton";
import IssueList from "@/components/IssueList";
import IssueSearchInput from "@/components/IssueSearchInput";
import IterationLayoutToggle from "@/components/IterationLayoutToggle";
import KanbanBoard from "@/components/KanbanBoard";
import { SprintActionButton } from "@/components/SprintActionButton";
import { getActiveProjectForUser, getRequestedProjectRouteContext } from "@/lib/activeProject";
import { getProjectPath } from "@/lib/projectRoutes";
import { buildProjectEntityWhere, buildProjectItemsWhere, buildProjectUsersWhere } from "@/lib/activeProjectUtils";
import { authOptions } from "@/lib/authOptions";
import { getIterationStatusLabel, getTranslations, localeDateMap } from "@/lib/i18n";
import { parseIssueSearchParams } from "@/lib/issueFilterUtils";
import { ITERATION_LAYOUT_COOKIE, parseIterationLayout } from "@/lib/iterationLayout";
import { getProjectRole } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";
import { isDoneWorkflowStatus } from "@/lib/workflows";
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

type IterationDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function IterationDetailPage({ params, searchParams }: IterationDetailPageProps) {
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

  const [resolvedParams, searchParamsData, cookieStore] = await Promise.all([
    params,
    searchParams,
    cookies(),
  ]);
  if (!(await getRequestedProjectRouteContext())) {
    redirect(getProjectPath(activeProject.departmentId, activeProject.id, "iterations", resolvedParams.id));
  }
  const layout =
    parseIterationLayout(searchParamsData.layout) ??
    parseIterationLayout(cookieStore.get(ITERATION_LAYOUT_COOKIE)?.value) ??
    "board";

  const iteration = await prisma.iteration.findFirst({
    where: buildProjectEntityWhere(resolvedParams.id, activeProject.id),
    include: {
      project: {
        select: {
          id: true,
          name: true,
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
      },
    },
  });

  if (!iteration) redirect(getProjectPath(activeProject.departmentId, activeProject.id, "iterations"));

  const role = await getProjectRole(userId, iteration.project.id);
  const canCreateIssues = Boolean(role);
  const canManage = role === "ADMIN";
  const canChangeSprintIssues = iteration.status !== "COMPLETED";
  const preferenceScope: IssueListPreferenceScope = {
    projectId: iteration.project.id,
    surface: "ITERATION",
    contextKey: iteration.id,
  };
  const doneStatusKeys = iteration.project.workflowStatuses
    .filter((status) => isDoneWorkflowStatus(status.key, iteration.project.workflowStatuses))
    .map((status) => status.key);

  const [users, plans, iterations, backlogIssuePage, parentIssues, currentUser, iterationIssueStatuses, issueFieldDefinitions] =
    await Promise.all([
      prisma.user.findMany({
        where: buildProjectUsersWhere(iteration.project.id, false),
        orderBy: { name: "asc" },
      }),
      prisma.plan.findMany({
        where: buildProjectItemsWhere(iteration.project.id),
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      }),
      prisma.iteration.findMany({
        where: buildProjectItemsWhere(iteration.project.id),
        orderBy: { startDate: "desc" },
      }),
      canManage
        ? prisma.issue.findMany({
            where: {
              projectId: iteration.project.id,
              iterationId: null,
              ...(doneStatusKeys.length > 0 ? { status: { notIn: doneStatusKeys } } : {}),
            },
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
      prisma.issue.findMany({
        where: { projectId: iteration.project.id },
        select: {
          id: true,
          key: true,
          title: true,
          type: true,
          parentIssueId: true,
        },
        orderBy: [{ createdAt: "desc" }, { key: "asc" }],
      }),
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.issue.findMany({
        where: { projectId: iteration.project.id, iterationId: iteration.id },
        select: { status: true },
      }),
      layout === "list"
        ? prisma.issueFieldDefinition.findMany({
            where: { projectId: iteration.project.id },
            orderBy: { position: "asc" },
          })
        : Promise.resolve([]),
    ]);

  const backlogIssues = backlogIssuePage.slice(0, 20);
  const backlogIssuesHasMore = backlogIssuePage.length > 20;
  const [initialPreferences, savedFilterQuery] =
    layout === "list"
      ? await Promise.all([
          getIssueListInitialPreferences(userId, preferenceScope),
          hasExplicitIssueListParams(searchParamsData)
            ? Promise.resolve("")
            : getSavedIssueListFilterQuery(userId, preferenceScope),
        ])
      : [{ baseLayout: null, contextLayout: null }, ""];
  if (savedFilterQuery) {
    const restored = searchParamsRecordToUrlSearchParams(searchParamsData);
    new URLSearchParams(savedFilterQuery).forEach((value, key) => restored.set(key, value));
    redirect(`${getProjectPath(activeProject.departmentId, activeProject.id, "iterations", iteration.id)}?${restored.toString()}`);
  }

  const boardIssues =
    layout === "board"
      ? await prisma.issue.findMany({
          where: { projectId: iteration.project.id, iterationId: iteration.id },
          include: { assignee: true, reporter: true },
          orderBy: { createdAt: "desc" },
        })
      : [];

  const listData =
    layout === "list"
      ? await (async () => {
          const { where, skip, take, orderBy, page, pageSize } = await parseIssueSearchParams(
            searchParamsData,
            iteration.project.id,
            {
              lockedIterationId: iteration.id,
              currentUserId: userId,
              doneStatusKeys,
              issueFieldDefinitions: issueFieldDefinitions.map((field) => ({
                id: field.id,
                type: field.type,
                source: "issue",
              })),
            }
          );
          const [issues, totalIssues] = await Promise.all([
            prisma.issue.findMany({
              where,
              include: {
                assignee: true,
                plan: { select: { id: true, name: true } },
                reporter: true,
                iteration: true,
                parentIssue: {
                  select: { id: true, key: true, title: true, type: true },
                },
                childIssues: { select: { id: true, status: true } },
                _count: { select: { childIssues: true } },
                watchers: { select: { id: true } },
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
            prisma.issue.count({ where }),
          ]);

          return { issues, totalIssues, page, pageSize };
        })()
      : null;

  const defaultDueDate = iteration.endDate.toISOString().slice(0, 10);
  const unfinishedIssueCount = iterationIssueStatuses.filter(
    (issue) => !doneStatusKeys.includes(issue.status)
  ).length;
  const plannedSprintOptions = iterations
    .filter((item) => item.id !== iteration.id && item.status === "PLANNED")
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const recommendedSprint =
    plannedSprintOptions.find((item) => item.startDate.getTime() >= iteration.endDate.getTime()) || null;
  const plannedSprints = plannedSprintOptions.map((item) => ({
    id: item.id,
    name: item.name,
    startDate: item.startDate.toISOString(),
    endDate: item.endDate.toISOString(),
    recommended: item.id === recommendedSprint?.id,
  }));
  const movableIterations = iterations.filter(
    (item) => item.id !== iteration.id && item.status !== "COMPLETED"
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="break-words text-2xl font-bold tracking-tight text-slate-800" title={iteration.name}>
            {iteration.name}
          </h2>
          <p className="text-sm text-slate-500">
            {getIterationStatusLabel(iteration.status, locale)} | {translations.iterationDetail.ends}{" "}
            {iteration.endDate.toLocaleDateString(localeDateMap[locale])}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {layout === "list" ? <IssueSearchInput locale={locale} /> : null}
          {canManage && (
            <SprintActionButton
              sprintId={iteration.id}
              status={iteration.status}
              locale={locale}
              plannedSprints={plannedSprints}
              unfinishedIssueCount={unfinishedIssueCount}
              sprintData={{
                id: iteration.id,
                name: iteration.name,
                startDate: iteration.startDate.toISOString(),
                endDate: iteration.endDate.toISOString(),
              }}
              createIssue={
                canChangeSprintIssues
                  ? {
                      locale,
                      users,
                      plans,
                      iterations,
                      currentUserId: userId,
                      canManagePlans: true,
                      defaultIterationId: iteration.id,
                      defaultDueDate,
                      parentIssues,
                    }
                  : undefined
              }
              addExistingIssues={
                canChangeSprintIssues
                  ? {
                      target: { type: "iteration" as const, id: iteration.id, name: iteration.name },
                      issues: backlogIssues,
                      initialHasMore: backlogIssuesHasMore,
                      locale,
                      workflowStatuses: iteration.project.workflowStatuses,
                    }
                  : undefined
              }
            />
          )}
          {canChangeSprintIssues && !canManage && canCreateIssues && (
            <CreateIssueButton
              locale={locale}
              users={users}
              plans={plans}
              iterations={iterations}
              canManagePlans={false}
              defaultIterationId={iteration.id}
              defaultDueDate={defaultDueDate}
              parentIssues={parentIssues}
              buttonLabel={locale === "zh" ? "问题" : "Issue"}
            />
          )}
          <IterationLayoutToggle layout={layout} locale={locale} />
        </div>
      </div>

      {layout === "board" ? (
        <KanbanBoard
          initialIssues={boardIssues}
          workflowStatuses={iteration.project.workflowStatuses}
          workflowTransitions={iteration.project.workflowTransitions}
          currentUserId={userId}
          locale={locale}
        />
      ) : listData ? (
        <IssueList
          initialIssues={listData.issues}
          totalIssues={listData.totalIssues}
          page={listData.page}
          pageSize={listData.pageSize}
          users={users}
          plans={plans}
          iterations={movableIterations}
          workflowProjects={[iteration.project]}
          currentUser={currentUser}
          locale={locale}
          activeProjectId={iteration.project.id}
          issueFieldDefinitions={issueFieldDefinitions}
          canManageIssueFields={false}
          lockedIterationId={iteration.id}
          canManagePlans={canManage}
          canMoveIssuesBetweenIterations={canChangeSprintIssues}
          preferenceScope={preferenceScope}
          initialPreferences={initialPreferences}
        />
      ) : null}
    </div>
  );
}
