import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import IssueDetailClient from "@/components/IssueDetailClient";
import { getActiveProjectForUser, getRequestedProjectRouteContext } from "@/lib/activeProject";
import { buildProjectEntityWhere, buildProjectItemsWhere, buildProjectUsersWhere, buildVisibleProjectsWhere } from "@/lib/activeProjectUtils";
import { authOptions } from "@/lib/authOptions";
import { getProjectRole } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getProjectPath } from "@/lib/projectRoutes";

export const dynamic = "force-dynamic";

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getCurrentLocale();
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as { id?: string; role?: string | null };
  const userId = sessionUser.id as string;
  const userRole = sessionUser.role as string;

  const resolvedParams = await params;
  const issueProject = await prisma.issue.findFirst({
    where: {
      id: resolvedParams.id,
      project: buildVisibleProjectsWhere(userId, userRole),
    },
    select: { id: true, projectId: true, project: { select: { departmentId: true } } },
  });

  if (!issueProject) return notFound();
  if (!issueProject.project.departmentId) return notFound();

  const activeProject = await getActiveProjectForUser(userId, userRole);
  const canonicalPath = getProjectPath(
    issueProject.project.departmentId,
    issueProject.projectId,
    "issues",
    resolvedParams.id,
  );
  const routeContext = await getRequestedProjectRouteContext();
  if (
    activeProject?.id !== issueProject.projectId ||
    !routeContext ||
    routeContext.departmentId !== issueProject.project.departmentId
  ) {
    redirect(canonicalPath);
  }

  const issue = await prisma.issue.findFirst({
    where: buildProjectEntityWhere(resolvedParams.id, issueProject.projectId),
    include: {
      assignee: true,
      reporter: {
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
        },
      },
      watchers: {
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
        },
        orderBy: {
          name: "asc",
        },
      },
      parentIssue: {
        select: {
          id: true,
          key: true,
          title: true,
          type: true,
          status: true,
        },
      },
      childIssues: {
        select: {
          id: true,
          key: true,
          title: true,
          type: true,
          status: true,
          dueDate: true,
          assignee: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ createdAt: "asc" }, { key: "asc" }],
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
      project: {
        select: {
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

  if (!issue) return notFound();

  const users = await prisma.user.findMany({
    where: buildProjectUsersWhere(issue.projectId, false),
    orderBy: { name: "asc" },
  });

  const iterations = await prisma.iteration.findMany({
    where: buildProjectItemsWhere(issue.projectId),
    orderBy: { startDate: "desc" },
  });
  const plans = await prisma.plan.findMany({
    where: buildProjectItemsWhere(issue.projectId),
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  const issueFieldDefinitions = await prisma.issueFieldDefinition.findMany({
    where: { projectId: issue.projectId },
    orderBy: { position: "asc" },
  });
  const parentIssueOptions = await prisma.issue.findMany({
    where: { projectId: issue.projectId },
    select: {
      id: true,
      key: true,
      title: true,
      type: true,
      status: true,
      parentIssueId: true,
    },
    orderBy: [{ createdAt: "desc" }, { key: "asc" }],
  });

  const role = await getProjectRole(userId, issue.projectId);
  const canDeleteIssue = role === "ADMIN";
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col pb-10">
      <IssueDetailClient
        initialIssue={issue}
        users={users}
        plans={plans}
        iterations={iterations}
        workflowStatuses={issue.project.workflowStatuses}
        workflowTransitions={issue.project.workflowTransitions}
        currentUserId={userId}
        locale={locale}
        canDeleteIssue={canDeleteIssue}
        canManagePlans={canDeleteIssue}
        issueFieldDefinitions={issueFieldDefinitions}
        parentIssueOptions={parentIssueOptions}
      />
    </div>
  );
}
