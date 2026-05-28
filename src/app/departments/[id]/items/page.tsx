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
} from "@/lib/departmentReminders";
import { canAssignDepartmentTask } from "@/lib/departmentPermissions";
import { getNoteFoldersForUser, getNotesForUser, getNoteTaskOptionsForUser } from "@/lib/notes";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

export default async function DepartmentItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; selected?: string }>;
}) {
  const { id: departmentId } = await params;
  const { tab, selected } = await searchParams;
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
  if (!isGlobalAdmin && !myMembership) redirect("/");

  const isDepartmentAdmin = Boolean(myMembership?.isDepartmentAdmin);
  const canViewAllProjects = Boolean(isDepartmentAdmin || myMembership?.projectScopeType === "ALL_PROJECTS");
  const canCreateDepartmentItem = Boolean(isGlobalAdmin || myMembership);
  const visibleDepartment = filterDepartmentWorkspaceProjectsForUser(department, userId, canViewAllProjects);
  const visibleProjectIds = visibleDepartment.projects.map((project) => project.id);
  const reminderProjectOptions = visibleDepartment.projects.map((project) => ({ id: project.id, name: project.name, key: project.key }));
  const assignableMembers = await Promise.all(
    visibleDepartment.members.map(async (member) => ({
      member,
      canAssign: await canAssignDepartmentTask({
        assignerId: userId,
        assigneeId: member.userId,
        departmentId,
        userRole,
      }),
    })),
  );
  const assigneeOptions = assignableMembers
    .filter((entry) => entry.canAssign)
    .map(({ member }) => ({
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
      canManageDepartment: isDepartmentAdmin,
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
      initialSelectedScheduleItemId={selected || null}
      currentUserId={userId}
      canCreateDepartmentItem={canCreateDepartmentItem}
      projectOptions={reminderProjectOptions}
      assigneeOptions={assigneeOptions}
    />
  );
}
