import prisma from "@/lib/prisma";
import KanbanBoard from "@/components/KanbanBoard";
import CreateIssueButton from "@/components/CreateIssueButton";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getProjectRole } from "@/lib/permissions";
import { SprintActionButton } from "@/components/SprintActionButton";
import { getActiveProjectIdForUser } from "@/lib/activeProject";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getIterationStatusLabel, getTranslations, localeDateMap } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function IterationKanbanPage({ params }: { params: Promise<{ id: string }> }) {
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
  const iteration = await prisma.iteration.findFirst({
    where: isGlobalAdmin
      ? { id: resolvedParams.id }
      : { id: resolvedParams.id, projectId: activeProjectId! },
    include: {
      project: { select: { id: true, name: true } },
      issues: {
        include: { assignee: true, reporter: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!iteration) {
    return notFound();
  }

  let canManage = isGlobalAdmin;
  if (!canManage) {
    const role = await getProjectRole(userId, iteration.project.id);
    canManage = role === "ADMIN";
  }

  const issues = iteration.issues;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <Link href="/iterations" className="text-sm font-medium text-slate-500 hover:text-blue-600 flex items-center gap-1 w-fit transition-colors">
          <ArrowLeft size={16} /> {translations.iterationDetail.backToSprints}
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{iteration.name} {translations.iterationDetail.board}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {getIterationStatusLabel(iteration.status, locale)} | {translations.iterationDetail.ends} {iteration.endDate.toLocaleDateString(localeDateMap[locale])}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <CreateIssueButton locale={locale} />
          </div>
          {canManage && iteration.status !== "COMPLETED" && (
            <>
              <div className="h-6 w-px bg-slate-200 mx-2"></div>
              <SprintActionButton sprintId={iteration.id} status={iteration.status} locale={locale} />
            </>
          )}
        </div>
      </div>

      <KanbanBoard initialIssues={issues} currentUserId={userId} locale={locale} />
    </div>
  );
}
