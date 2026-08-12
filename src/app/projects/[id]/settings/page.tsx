import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import ProjectSettingsForm from "@/components/ProjectSettingsForm";
import { authOptions } from "@/lib/authOptions";
import { getProjectRole } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getRequestedProjectRouteContext } from "@/lib/activeProject";
import { getProjectPath } from "@/lib/projectRoutes";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getCurrentLocale();
  const text =
    locale === "zh"
      ? {
          accessDeniedTitle: "访问被拒绝",
          accessDeniedDesc: "你没有权限管理这个项目的设置。",
          backToProjects: "返回项目列表",
          detailsTitle: "项目设置",
          detailsDesc: "更新项目标识和基础信息。",
        }
      : {
          accessDeniedTitle: "Access Denied",
          accessDeniedDesc: "You don't have permission to manage this project's settings.",
          backToProjects: "Back to Projects",
          detailsTitle: "Project Settings",
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

  if (!project || !project.departmentId) {
    notFound();
  }

  if (!(await getRequestedProjectRouteContext())) {
    redirect(getProjectPath(project.departmentId, project.id, "settings"));
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{text.detailsTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{text.detailsDesc}</p>
        </div>

        <ProjectSettingsForm project={project} locale={locale} />
      </div>
    </div>
  );
}
