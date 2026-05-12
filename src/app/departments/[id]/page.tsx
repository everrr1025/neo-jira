import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getCurrentLocale } from "@/lib/serverLocale";
import DepartmentManageClient from "@/components/DepartmentManageClient";
import {
  filterDepartmentWorkspaceProjectsForUser,
  getDepartmentWorkspaceData,
} from "@/lib/departmentWorkspace";
import { getLatestDepartmentNotifications } from "@/lib/departmentNotifications";

export const dynamic = "force-dynamic";

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: departmentId } = await params;
  const locale = await getCurrentLocale();
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const currentUser = session.user as { id: string; role?: string | null };
  const userId = currentUser.id;
  const userRole = currentUser.role;
  const isGlobalAdmin = userRole === "ADMIN";

  const department = await getDepartmentWorkspaceData(departmentId, locale);

  if (!department) redirect("/");

  // Check authorization: must be HEAD, ASSISTANT, or global admin
  const myMembership = department.members.find((m) => m.userId === userId);
  const isHead = myMembership?.role === "HEAD";
  const isAssistant = myMembership?.role === "ASSISTANT";
  const isDepartmentMember = Boolean(myMembership);
  if (!isGlobalAdmin && !isDepartmentMember) {
    redirect("/");
  }
  const canViewAllProjects = Boolean(isGlobalAdmin || isHead || isAssistant);
  const visibleDepartment = filterDepartmentWorkspaceProjectsForUser(
    department,
    userId,
    canViewAllProjects,
  );
  const latestNotifications = await getLatestDepartmentNotifications({
    departmentId,
    userId,
    userRole,
    locale,
    take: 5,
  });

  return (
    <div className="flex h-full w-full flex-col space-y-6">
      <DepartmentManageClient
        department={visibleDepartment}
        locale={locale}
        currentUserId={userId}
        isHead={isHead}
        canManageProjects={canViewAllProjects}
        mode="dashboard"
        notifications={latestNotifications.notifications}
        notificationPermission={latestNotifications.permission}
      />
    </div>
  );
}
