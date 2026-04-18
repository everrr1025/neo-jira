import prisma from "@/lib/prisma";
import IssueList from "@/components/IssueList";
import CreateIssueButton from "@/components/CreateIssueButton";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getActiveProjectIdForUser } from "@/lib/activeProject";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getTranslations } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
  role?: string | null;
};

export default async function IssuesPage() {
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
  let activeProject: { name: string; key: string } | null = null;
  if (!isGlobalAdmin) {
    activeProjectId = await getActiveProjectIdForUser(userId, userRole);
    if (!activeProjectId) redirect("/projects");

    activeProject = await prisma.project.findUnique({
      where: { id: activeProjectId },
      select: { name: true, key: true },
    });
    if (!activeProject) redirect("/projects");
  }

  const whereClause = isGlobalAdmin ? {} : { projectId: activeProjectId! };
  const issues = await prisma.issue.findMany({
    where: whereClause,
    include: { assignee: true, reporter: true, iteration: true },
    orderBy: { createdAt: "desc" },
  });

  const users = await prisma.user.findMany({
    where: isGlobalAdmin
      ? {}
      : {
          projectMemberships: { some: { projectId: activeProjectId! } },
        },
    orderBy: { name: "asc" },
  });

  const iterations = await prisma.iteration.findMany({
    where: isGlobalAdmin ? {} : { projectId: activeProjectId! },
    orderBy: { startDate: "desc" },
  });
  const workflowProjects = await prisma.project.findMany({
    where: isGlobalAdmin ? {} : { id: activeProjectId! },
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
  });

  const currentUser = await prisma.user.findUnique({ where: { id: userId } });

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{translations.issuesPage.title}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {translations.issuesPage.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CreateIssueButton users={users} iterations={iterations} locale={locale} currentUserId={userId} />
        </div>
      </div>

      <IssueList
        initialIssues={issues}
        users={users}
        iterations={iterations}
        workflowProjects={workflowProjects}
        currentUser={currentUser}
        locale={locale}
      />
    </div>
  );
}
