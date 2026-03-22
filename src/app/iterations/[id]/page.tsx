import prisma from "@/lib/prisma";
import KanbanBoard from "@/components/KanbanBoard";
import CreateIssueButton from "@/components/CreateIssueButton";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function IterationKanbanPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const iteration = await prisma.iteration.findUnique({
    where: { id: resolvedParams.id },
    include: {
      issues: {
        include: { assignee: true, reporter: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!iteration) {
    notFound();
  }

  const issues = iteration.issues;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <Link href="/iterations" className="text-sm font-medium text-slate-500 hover:text-blue-600 flex items-center gap-1 w-fit transition-colors">
          <ArrowLeft size={16} /> Back to Sprints
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{iteration.name} Board</h2>
          <p className="text-sm text-slate-500 mt-1">
            {iteration.status} • Ends {iteration.endDate.toLocaleDateString()}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <CreateIssueButton />
          </div>
          <div className="h-6 w-px bg-slate-200 mx-2"></div>
          <button className="bg-white border hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm">
            {iteration.status === 'ACTIVE' ? 'Complete Sprint' : 'Start Sprint'}
          </button>
        </div>
      </div>

      <KanbanBoard initialIssues={issues} />
    </div>
  );
}
