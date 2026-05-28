import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import DepartmentProjectMembersClient from "@/components/DepartmentProjectMembersClient";
import { authOptions } from "@/lib/authOptions";
import {
  filterDepartmentWorkspaceProjectsForUser,
  getDepartmentWorkspaceData,
} from "@/lib/departmentWorkspace";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

export default async function DepartmentProjectMembersPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id: departmentId, projectId } = await params;
  const locale = await getCurrentLocale();
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const currentUser = session.user as { id: string; role?: string | null };
  const userId = currentUser.id;
  const userRole = currentUser.role;
  const isGlobalAdmin = userRole === "ADMIN";

  const department = await getDepartmentWorkspaceData(departmentId, locale);
  if (!department) redirect("/");

  const myMembership = department.members.find((member) => member.userId === userId);
  const isDepartmentAdmin = Boolean(myMembership?.isDepartmentAdmin);
  const isDepartmentMember = Boolean(myMembership);

  if (!isGlobalAdmin && !isDepartmentMember) {
    redirect("/");
  }
  const canViewAllProjects = Boolean(isDepartmentAdmin || myMembership?.projectScopeType === "ALL_PROJECTS");
  const visibleDepartment = filterDepartmentWorkspaceProjectsForUser(department, userId, canViewAllProjects);

  const project = visibleDepartment.projects.find((item) => item.id === projectId);
  if (!project) {
    redirect(`/departments/${departmentId}/projects`);
  }

  return (
    <div className="flex h-full w-full flex-col space-y-6">
      <DepartmentProjectMembersClient
        departmentId={department.id}
        project={project}
        departmentMembers={visibleDepartment.members}
        locale={locale}
        canManage={isDepartmentAdmin}
      />
    </div>
  );
}
