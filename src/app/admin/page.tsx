import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import AdminPanelClient from "@/components/AdminPanelClient";

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  const projects = await prisma.project.findMany({
    include: {
      owner: true,
      members: {
        include: { user: true }
      },
      _count: { select: { issues: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Extract safe structures to pass to client component bypassing TS constraints
  const safeUsers = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString()
  }));

  const safeProjects = projects.map(p => ({
    id: p.id,
    name: p.name,
    key: p.key,
    description: p.description,
    owner: { name: p.owner.name },
    members: p.members.map(m => ({
      userId: m.userId,
      role: m.role,
    })),
    issuesCount: p._count.issues,
    createdAt: p.createdAt.toISOString()
  }));

  return (
    <div className="flex flex-col h-full space-y-6 max-w-6xl mx-auto w-full">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Administration</h2>
        <p className="text-sm text-slate-500 mt-1">Manage workspace users, projects, and access control.</p>
      </div>

      <AdminPanelClient initialUsers={safeUsers} initialProjects={safeProjects} />
    </div>
  );
}
