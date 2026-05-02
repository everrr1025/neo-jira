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
import { getNoteFoldersForUser, getNotesForUser, getNoteTaskOptionsForUser } from "@/lib/notes";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

export default async function DepartmentItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id: departmentId } = await params;
  const { tab } = await searchParams;
  const initialTab = tab === "schedule" || tab === "notes" ? tab : "tasks";
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
  const assigneeOptions = visibleDepartment.members.map((member) => ({
    id: member.userId,
    name: member.userName || member.userEmail,
    email: member.userEmail,
    projectIds: member.projects.map((project) => project.id),
  }));

  const [items, noteFolders, notes, noteIssueOptions, noteTaskOptions] = await Promise.all([
    getDepartmentItemCenterItems({
      departmentId,
      userId,
      userRole,
      visibleProjectIds,
      manageableProjectIds: reminderProjectOptions.map((project) => project.id),
      canManageDepartment: canCreateDepartmentItem,
      locale,
    }),
    getNoteFoldersForUser(userId),
    getNotesForUser(userId),
    getDepartmentReminderIssueOptions(visibleProjectIds),
    getNoteTaskOptionsForUser({ userId, departmentId, visibleProjectIds }),
  ]);

  return (
    <DepartmentItemsClient
      departmentId={departmentId}
      locale={locale}
      items={items}
      noteFolders={noteFolders}
      notes={notes}
      noteIssueOptions={noteIssueOptions}
      noteTaskOptions={noteTaskOptions}
      noteProjectOptions={visibleDepartment.projects.map((project) => ({ id: project.id, name: project.name, key: project.key }))}
      initialTab={initialTab}
      currentUserId={userId}
      canCreateDepartmentItem={canCreateDepartmentItem}
      projectOptions={reminderProjectOptions}
      assigneeOptions={assigneeOptions}
    />
  );
}
