import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getProjectRole } from "@/lib/permissions";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import ProjectSettingsForm from "@/components/ProjectSettingsForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = 'force-dynamic';

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getCurrentLocale();
  const text =
    locale === "zh"
      ? {
          accessDeniedTitle: "访问被拒绝",
          accessDeniedDesc: "你没有权限管理该项目设置。",
          backToProjects: "返回项目列表",
          projects: "项目",
          settingsSuffix: "设置",
          detailsTitle: "项目详情",
          detailsDesc: "更新项目标识和基础信息。",
        }
      : {
          accessDeniedTitle: "Access Denied",
          accessDeniedDesc: "You don't have permission to manage this project's settings.",
          backToProjects: "Back to Projects",
          projects: "Projects",
          settingsSuffix: "Settings",
          detailsTitle: "Project Details",
          detailsDesc: "Update your project's identity and basic information.",
        };

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
        <h2 className="text-xl font-bold text-red-800">{text.accessDeniedTitle}</h2>
        <p className="text-red-600 mt-2">{text.accessDeniedDesc}</p>
        <Link href="/projects" className="inline-block mt-4 text-sm font-medium text-blue-600 hover:underline">
          {text.backToProjects}
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
          {text.projects}
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">{project.name} {text.settingsSuffix}</span>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800">{text.detailsTitle}</h2>
          <p className="text-sm text-slate-500 mt-1">{text.detailsDesc}</p>
        </div>

        <ProjectSettingsForm project={project} users={users} locale={locale} />
      </div>
    </div>
  );
}
