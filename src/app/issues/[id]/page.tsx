import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import IssueDetailClient from "@/components/IssueDetailClient";
import BackButton from "@/components/BackButton";
import { getActiveProjectForUser } from "@/lib/activeProject";
import { buildProjectEntityWhere, buildProjectItemsWhere, buildProjectUsersWhere } from "@/lib/activeProjectUtils";
import { authOptions } from "@/lib/authOptions";
import { getTranslations } from "@/lib/i18n";
import { getProjectRole } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getCurrentLocale();
  const translations = getTranslations(locale);
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as { id?: string; role?: string | null };
  const userId = sessionUser.id as string;
  const userRole = sessionUser.role as string;
  const isGlobalAdmin = userRole === "ADMIN";

  const activeProject = await getActiveProjectForUser(userId, userRole);
  if (!activeProject) redirect("/projects");

  const resolvedParams = await params;
  const issue = await prisma.issue.findFirst({
    where: buildProjectEntityWhere(resolvedParams.id, activeProject.id),
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
    where: buildProjectUsersWhere(issue.projectId),
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

  let canDeleteIssue = isGlobalAdmin;
  if (!canDeleteIssue) {
    const role = await getProjectRole(userId, issue.projectId);
    canDeleteIssue = role === "ADMIN";
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col pb-10">
      <div className="mb-6">
        <BackButton label={translations.issueDetail.back} />
      </div>

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
      />
    </div>
  );
}
