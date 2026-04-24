import prisma from "@/lib/prisma";
import IssueList from "@/components/IssueList";
import CreateIssueButton from "@/components/CreateIssueButton";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getActiveProjectForUser } from "@/lib/activeProject";
import { buildProjectItemsWhere, buildProjectUsersWhere } from "@/lib/activeProjectUtils";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getTranslations } from "@/lib/i18n";
import { getProjectRole } from "@/lib/permissions";

import { parseIssueSearchParams } from "@/lib/issueFilterUtils";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
  role?: string | null;
};

export default async function IssuesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const locale = await getCurrentLocale();
  const translations = getTranslations(locale);
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as typeof session.user & SessionUser;
  const userId = sessionUser.id;
  const userRole = sessionUser.role ?? "USER";
  if (!userId) redirect("/login");
  const isGlobalAdmin = userRole === "ADMIN";

  const activeProject = await getActiveProjectForUser(userId, userRole);
  if (!activeProject) redirect("/projects");
  const projectRole = isGlobalAdmin ? "ADMIN" : await getProjectRole(userId, activeProject.id);
  const canManagePlans = projectRole === "ADMIN";

  const searchParamsData = await searchParams;
  const { where: parsedWhere, skip, take, orderBy, page, pageSize } = await parseIssueSearchParams(
    searchParamsData,
    activeProject.id
  );

  const issues = await prisma.issue.findMany({
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
      watchers: {
        select: { id: true },
      },
    },
    orderBy,
    skip,
    take,
  });

  const totalIssues = await prisma.issue.count({ where: parsedWhere });

  const users = await prisma.user.findMany({
    where: buildProjectUsersWhere(activeProject.id),
    orderBy: { name: "asc" },
  });

  const iterations = await prisma.iteration.findMany({
    where: buildProjectItemsWhere(activeProject.id),
    orderBy: { startDate: "desc" },
  });
  const plans = await prisma.plan.findMany({
    where: buildProjectItemsWhere(activeProject.id),
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  const workflowProjects = await prisma.project.findMany({
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
  });

  const currentUser = await prisma.user.findUnique({ where: { id: userId } });

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{translations.issuesPage.title}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {translations.issuesPage.subtitle}
            {isGlobalAdmin ? ` | ${activeProject.name} (${activeProject.key})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CreateIssueButton
            users={users}
            plans={plans}
            iterations={iterations}
            locale={locale}
            currentUserId={userId}
            canManagePlans={canManagePlans}
          />
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
        canManagePlans={canManagePlans}
      />
    </div>
  );
}
