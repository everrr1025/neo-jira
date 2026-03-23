import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import IssueDetailClient from "@/components/IssueDetailClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getActiveProjectIdForUser } from "@/lib/activeProject";

export const dynamic = "force-dynamic";

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full pb-10">
      <div className="mb-6">
        <Link href="/issues" className="text-sm font-medium text-slate-500 hover:text-blue-600 flex items-center gap-1 w-fit transition-colors">
          <ArrowLeft size={16} /> Back to Issues
        </Link>
      </div>

      <IssueDetailClient initialIssue={issue} users={users} iterations={iterations} />
    </div>
  );
}
