import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import ProjectSettingsForm from "@/components/ProjectSettingsForm";
import { authOptions } from "@/lib/authOptions";
import { getProjectRole } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getCurrentLocale();
  const text =
    locale === "zh"
      ? {
          accessDeniedTitle: "访问被拒绝",
          accessDeniedDesc: "你没有权限管理这个项目的设置。",
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
  if (!session?.user) {
    redirect("/login");
  }

  const resolvedParams = await params;
  const currentUser = session.user as { id?: string };
  const userId = currentUser.id;
  const projectId = resolvedParams.id;

  if (!userId) {
    redirect("/login");
  }

  const role = await getProjectRole(userId, projectId);
  if (role !== "ADMIN") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <h2 className="text-xl font-bold text-red-800">{text.accessDeniedTitle}</h2>
        <p className="mt-2 text-red-600">{text.accessDeniedDesc}</p>
        <Link href="/projects" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
          {text.backToProjects}
        </Link>
      </div>
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      workflowStatuses: {
        orderBy: { position: "asc" },
      },
      workflowTransitions: {
        select: {
          fromStatusId: true,
          toStatusId: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/projects" className="flex items-center gap-1 transition-colors hover:text-blue-600">
          <ChevronLeft size={16} />
          {text.projects}
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-800">
          {project.name} {text.settingsSuffix}
        </span>
      </div>

      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800">{text.detailsTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">{text.detailsDesc}</p>
        </div>

        <ProjectSettingsForm project={project} locale={locale} />
      </div>
    </div>
  );
}
