import prisma from "@/lib/prisma";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getProjectRole } from "@/lib/permissions";
import { CreateSprintButton } from "@/components/CreateSprintButton";

export const dynamic = 'force-dynamic';

export default async function IterationsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  const isGlobalAdmin = (session?.user as any)?.role === "ADMIN";

  // Get projects where user is an admin (for sprint creation)
  let adminProjects: { id: string; name: string; key: string }[] = [];
  if (isGlobalAdmin) {
    adminProjects = await prisma.project.findMany({
      select: { id: true, name: true, key: true },
    });
  } else if (userId) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId, role: "ADMIN" },
      include: { project: { select: { id: true, name: true, key: true } } },
    });
    adminProjects = memberships.map(m => m.project);
  }

  const canManageSprints = adminProjects.length > 0;

  const iterations = await prisma.iteration.findMany({
    include: {
      project: { select: { name: true, key: true } },
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
        {canManageSprints && (
          <CreateSprintButton projects={adminProjects} />
        )}
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
                    <span className="text-xs text-slate-400 font-medium">{iteration.project.key}</span>
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
