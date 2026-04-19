import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import IssueDetailClient from "@/components/IssueDetailClient";
import BackButton from "@/components/BackButton";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getActiveProjectForUser } from "@/lib/activeProject";
import { buildProjectEntityWhere, buildProjectItemsWhere, buildProjectUsersWhere } from "@/lib/activeProjectUtils";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getTranslations } from "@/lib/i18n";
import { getProjectRole } from "@/lib/permissions";

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
      reporter: true,
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

  let canDeleteIssue = isGlobalAdmin;
  if (!canDeleteIssue) {
    const role = await getProjectRole(userId, issue.projectId);
    canDeleteIssue = role === "ADMIN";
  }

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full pb-10">
      <div className="mb-6">
        <BackButton label={translations.issueDetail.back} />
      </div>

      <IssueDetailClient
        initialIssue={issue}
        users={users}
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
