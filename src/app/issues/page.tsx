import prisma from "@/lib/prisma";
import IssueList from "@/components/IssueList";
import CreateIssueButton from "@/components/CreateIssueButton";

export const dynamic = 'force-dynamic';

export default async function IssuesPage() {
  const issues = await prisma.issue.findMany({
    include: { assignee: true, reporter: true, iteration: true },
    orderBy: { createdAt: 'desc' }
  });

  const users = await prisma.user.findMany({ orderBy: { name: 'asc' }});
  const iterations = await prisma.iteration.findMany({ orderBy: { startDate: 'desc' }});
  
  // Mock current user
  const currentUser = users.find(u => u.role === 'ADMIN') || users[0];

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">All Issues</h2>
          <p className="text-sm text-slate-500 mt-1">View, filter, and search all issues across the workspace.</p>
        </div>
        <div className="flex items-center gap-3">
          <CreateIssueButton users={users} iterations={iterations} />
        </div>
      </div>
      
      <IssueList initialIssues={issues} users={users} iterations={iterations} currentUser={currentUser} />
    </div>
  );
}
