import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import IssueDetailClient from "@/components/IssueDetailClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const issue = await prisma.issue.findUnique({
    where: { id: resolvedParams.id },
    include: { assignee: true, reporter: true }
  });

  if (!issue) return notFound();

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' }
  });
  
  const iterations = await prisma.iteration.findMany({
    orderBy: { startDate: 'desc' }
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
