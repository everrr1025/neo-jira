import prisma from "@/lib/prisma";
import KanbanBoard from "@/components/KanbanBoard";
import CreateIssueButton from "@/components/CreateIssueButton";
import AddExistingIssuesButton from "@/components/AddExistingIssuesButton";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getProjectRole } from "@/lib/permissions";
import { SprintActionButton } from "@/components/SprintActionButton";
import { getActiveProjectIdForUser } from "@/lib/activeProject";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getIterationStatusLabel, getTranslations, localeDateMap } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
  role?: string | null;
};

export default async function IterationKanbanPage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getCurrentLocale();
  const translations = getTranslations(locale);
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as typeof session.user & SessionUser;
  const userId = sessionUser.id;
  const userRole = sessionUser.role ?? "USER";
  if (!userId) redirect("/login");
  const isGlobalAdmin = userRole === "ADMIN";

  let activeProjectId: string | null = null;
  if (!isGlobalAdmin) {
    activeProjectId = await getActiveProjectIdForUser(userId, userRole);
    if (!activeProjectId) redirect("/projects");
  }

  const resolvedParams = await params;
  const iteration = await prisma.iteration.findFirst({
    where: isGlobalAdmin
      ? { id: resolvedParams.id }
      : { id: resolvedParams.id, projectId: activeProjectId! },
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
      issues: {
        include: { assignee: true, reporter: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!iteration) redirect("/iterations");

  let canManage = isGlobalAdmin;
  if (!canManage) {
    const role = await getProjectRole(userId, iteration.project.id);
    canManage = role === "ADMIN";
  }

  const issues = iteration.issues;
  const doneStatusKeys = iteration.project.workflowStatuses
    .filter((status) => status.category === "DONE")
    .map((status) => status.key);
  const [users, iterations, backlogIssues] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { role: "ADMIN" },
          { projectMemberships: { some: { projectId: iteration.project.id } } },
        ],
      },
      orderBy: { name: "asc" },
    }),
    prisma.iteration.findMany({
      where: { projectId: iteration.project.id },
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
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);
  const defaultDueDate = iteration.endDate.toISOString().slice(0, 10);
  const unfinishedIssueCount = issues.filter((issue) => !doneStatusKeys.includes(issue.status)).length;
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
  const canChangeSprintIssues = iteration.status !== "COMPLETED";

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <Link href="/iterations" className="text-sm font-medium text-slate-500 hover:text-blue-600 flex items-center gap-1 w-fit transition-colors">
          <ArrowLeft size={16} /> {translations.iterationDetail.backToSprints}
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{iteration.name} {translations.iterationDetail.board}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {getIterationStatusLabel(iteration.status, locale)} | {translations.iterationDetail.ends} {iteration.endDate.toLocaleDateString(localeDateMap[locale])}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {canChangeSprintIssues && (
            <div className="flex flex-wrap items-center gap-2">
              {canManage && (
                <AddExistingIssuesButton
                  sprintId={iteration.id}
                  sprintName={iteration.name}
                  issues={backlogIssues}
                  locale={locale}
                  workflowStatuses={iteration.project.workflowStatuses}
                  users={users}
                  iterations={iterations}
                  currentUserId={userId}
                  defaultDueDate={defaultDueDate}
                />
              )}
              {!canManage && (
                <CreateIssueButton
                  locale={locale}
                  users={users}
                  iterations={iterations}
                  defaultIterationId={iteration.id}
                  defaultDueDate={defaultDueDate}
                />
              )}
            </div>
          )}
          {canManage && (
            <div className={`flex items-center gap-2 ${canChangeSprintIssues ? "border-l border-slate-200 pl-2" : ""}`}>
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
              />
            </div>
          )}
        </div>
      </div>

      <KanbanBoard
        initialIssues={issues}
        workflowStatuses={iteration.project.workflowStatuses}
        workflowTransitions={iteration.project.workflowTransitions}
        currentUserId={userId}
        locale={locale}
      />
    </div>
  );
}
