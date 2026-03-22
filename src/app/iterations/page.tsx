import prisma from "@/lib/prisma";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function IterationsPage() {
  const iterations = await prisma.iteration.findMany({
    include: {
      _count: {
        select: { issues: true }
      },
      issues: {
        select: { status: true }
      }
    },
    orderBy: { startDate: 'asc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Iterations / Sprints</h2>
          <p className="text-sm text-slate-500 mt-1">Plan and manage team iterations.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm">
          Create Sprint
        </button>
      </div>

      <div className="grid gap-4">
        {iterations.map((iteration) => {
          const totalIssues = iteration._count.issues;
          const completedIssues = iteration.issues.filter(i => i.status === 'DONE').length;
          const progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

          return (
            <Link href={`/iterations/${iteration.id}`} key={iteration.id} className="block">
              <div className="bg-white rounded-xl border shadow-sm p-5 hover:border-slate-300 hover:shadow-md transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-800">{iteration.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                      iteration.status === 'ACTIVE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      iteration.status === 'PLANNED' ? 'bg-slate-50 text-slate-600 border-slate-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {iteration.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 font-medium">
                    {iteration.startDate.toLocaleDateString()} - {iteration.endDate.toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-4">
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-slate-500">Issues</span>
                      <span className="font-semibold text-slate-800">{totalIssues}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-500">Completed</span>
                      <span className="font-semibold text-slate-800">{completedIssues}</span>
                    </div>
                  </div>
                  
                  <div className="w-full sm:w-1/3 min-w-[200px]">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">Progress</span>
                      <span className="font-bold text-slate-700">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${iteration.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        {iterations.length === 0 && (
           <div className="text-center py-12 bg-white border border-dashed rounded-xl">
              <p className="text-slate-500 font-medium">No iterations found.</p>
           </div>
        )}
      </div>
    </div>
  );
}
