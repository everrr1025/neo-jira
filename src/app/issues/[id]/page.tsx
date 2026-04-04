import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import IssueDetailClient from "@/components/IssueDetailClient";
import BackButton from "@/components/BackButton";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getActiveProjectIdForUser } from "@/lib/activeProject";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getTranslations } from "@/lib/i18n";
import { getProjectRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getCurrentLocale();
  const translations = getTranslations(locale);
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;
  const userRole = (session.user as any).role as string;
  const isGlobalAdmin = userRole === "ADMIN";

  let activeProjectId: string | null = null;
  if (!isGlobalAdmin) {
    activeProjectId = await getActiveProjectIdForUser(userId, userRole);
    if (!activeProjectId) redirect("/projects");
  }

  const resolvedParams = await params;
  const issue = await prisma.issue.findFirst({
    where: isGlobalAdmin
      ? { id: resolvedParams.id }
      : { id: resolvedParams.id, projectId: activeProjectId! },
    include: { assignee: true, reporter: true },
  });

  if (!issue) return notFound();

  const users = await prisma.user.findMany({
    where: isGlobalAdmin
      ? {}
      : {
          OR: [
            { role: "ADMIN" },
            { projectMemberships: { some: { projectId: issue.projectId } } },
          ],
        },
    orderBy: { name: "asc" },
  });

  const iterations = await prisma.iteration.findMany({
    where: isGlobalAdmin ? {} : { projectId: issue.projectId },
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
        currentUserId={userId}
        locale={locale}
        canDeleteIssue={canDeleteIssue}
      />
    </div>
  );
}
