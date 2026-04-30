import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import DepartmentItemsClient from "@/components/DepartmentItemsClient";
import { authOptions } from "@/lib/authOptions";
import {
  filterDepartmentWorkspaceProjectsForUser,
  getDepartmentWorkspaceData,
} from "@/lib/departmentWorkspace";
import {
  getDepartmentItemCenterItems,
  getDepartmentReminderIssueOptions,
  getManageableReminderProjects,
} from "@/lib/departmentReminders";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

export default async function DepartmentItemsPage({
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

  const myMembership = department.members.find((member) => member.userId === userId);
  const isHead = myMembership?.role === "HEAD";
  const isAssistant = myMembership?.role === "ASSISTANT";
  if (!isGlobalAdmin && !myMembership) redirect("/");

  const canViewAllProjects = Boolean(isGlobalAdmin || isHead || isAssistant);
  const canCreateDepartmentItem = Boolean(isGlobalAdmin || isHead || isAssistant);
  const visibleDepartment = filterDepartmentWorkspaceProjectsForUser(department, userId, canViewAllProjects);
  const visibleProjectIds = visibleDepartment.projects.map((project) => project.id);
  const reminderProjectOptions = getManageableReminderProjects({
    projects: visibleDepartment.projects,
    userId,
    canManageDepartment: canCreateDepartmentItem,
  });

  const [items, issueOptions] = await Promise.all([
    getDepartmentItemCenterItems({
      departmentId,
      userId,
      userRole,
      visibleProjectIds,
      manageableProjectIds: reminderProjectOptions.map((project) => project.id),
      canManageDepartment: canCreateDepartmentItem,
      locale,
    }),
    getDepartmentReminderIssueOptions(visibleProjectIds),
  ]);

  return (
    <DepartmentItemsClient
      departmentId={departmentId}
      locale={locale}
      items={items}
      canCreateDepartmentItem={canCreateDepartmentItem}
      projectOptions={reminderProjectOptions}
      issueOptions={issueOptions}
    />
  );
}
