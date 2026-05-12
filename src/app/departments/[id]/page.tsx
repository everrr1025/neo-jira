import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getCurrentLocale } from "@/lib/serverLocale";
import DepartmentManageClient from "@/components/DepartmentManageClient";
import {
  filterDepartmentWorkspaceProjectsForUser,
  getDepartmentWorkspaceData,
} from "@/lib/departmentWorkspace";
import {
  getDepartmentReminderIssueOptions,
  getDepartmentUpcomingItems,
  getManageableReminderProjects,
} from "@/lib/departmentReminders";
import { getLatestDepartmentNotifications } from "@/lib/departmentNotifications";
import prisma from "@/lib/prisma";

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
  const visibleProjectIds = visibleDepartment.projects.map((project) => project.id);
  const canCreateDepartmentReminder = Boolean(isGlobalAdmin || isHead || isAssistant);
  const reminderProjectOptions = getManageableReminderProjects({
    projects: visibleDepartment.projects,
    userId,
    canManageDepartment: canCreateDepartmentReminder,
  });
  const workflowProjects = visibleProjectIds.length
    ? await prisma.project.findMany({
        where: { id: { in: visibleProjectIds } },
        select: {
          workflowStatuses: {
            where: { category: "DONE" },
            select: { key: true },
          },
        },
      })
    : [];
  const doneStatusKeys = Array.from(
    new Set(workflowProjects.flatMap((project) => project.workflowStatuses.map((status) => status.key)))
  );
  const [upcomingItems, reminderIssueOptions, latestNotifications] = await Promise.all([
    getDepartmentUpcomingItems({
      departmentId,
      userId,
      userRole,
      visibleProjectIds,
      manageableProjectIds: reminderProjectOptions.map((project) => project.id),
      doneStatusKeys,
      canManageDepartment: canCreateDepartmentReminder,
      locale,
    }),
    getDepartmentReminderIssueOptions(visibleProjectIds),
    getLatestDepartmentNotifications({
      departmentId,
      userId,
      userRole,
      locale,
      take: 5,
    }),
  ]);

  return (
    <div className="flex h-full w-full flex-col space-y-6">
      <DepartmentManageClient
        department={visibleDepartment}
        locale={locale}
        currentUserId={userId}
        isHead={isHead}
        canManageProjects={canViewAllProjects}
        mode="dashboard"
        upcomingItems={upcomingItems}
        reminderProjectOptions={reminderProjectOptions}
        reminderIssueOptions={reminderIssueOptions}
        canCreateDepartmentReminder={canCreateDepartmentReminder}
        notifications={latestNotifications.notifications}
        notificationPermission={latestNotifications.permission}
      />
    </div>
  );
}
