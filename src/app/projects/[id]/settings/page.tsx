import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getProjectRole } from "@/lib/permissions";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import ProjectSettingsForm from "@/components/ProjectSettingsForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const resolvedParams = await params;
  const userId = (session.user as any).id;
  const projectId = resolvedParams.id;

  // Permission check: Project admin or global admin
  const role = await getProjectRole(userId, projectId);
  if (role !== 'ADMIN') {
    return (
      <div className="bg-red-50 border border-red-200 p-8 rounded-xl text-center">
        <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
        <p className="text-red-600 mt-2">You don't have permission to manage this project's settings.</p>
        <Link href="/projects" className="inline-block mt-4 text-sm font-medium text-blue-600 hover:underline">
          Back to Projects
        </Link>
      </div>
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { owner: true }
  });

  if (!project) notFound();

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/projects" className="hover:text-blue-600 transition-colors flex items-center gap-1">
          <ChevronLeft size={16} />
          Projects
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">{project.name} Settings</span>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800">Project Details</h2>
          <p className="text-sm text-slate-500 mt-1">Update your project's identity and basic information.</p>
        </div>

        <ProjectSettingsForm project={project} users={users} />
      </div>
    </div>
  );
}
