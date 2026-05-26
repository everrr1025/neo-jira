import prisma from "@/lib/prisma";

export const PROJECT_SCOPE_TYPES = ["NONE", "ALL_PROJECTS", "SELECTED_PROJECTS"] as const;
export type ProjectScopeType = (typeof PROJECT_SCOPE_TYPES)[number];

export function isProjectScopeType(value: string): value is ProjectScopeType {
  return PROJECT_SCOPE_TYPES.includes(value as ProjectScopeType);
}

export function buildDepartmentProjectAccessWhere(userId: string) {
  return {
    department: {
      members: {
        some: {
          userId,
          OR: [
            { isDepartmentAdmin: true },
            { projectScopeType: "ALL_PROJECTS" },
          ],
        },
      },
    },
  };
}

export function buildVisibleDepartmentProjectsWhere(userId: string) {
  return {
    OR: [
      { ownerId: userId },
      { members: { some: { userId } } },
      { managedByDepartmentMembers: { some: { userId } } },
      buildDepartmentProjectAccessWhere(userId),
    ],
  };
}

export async function canManageDepartment(userId: string, departmentId: string, userRole?: string | null) {
  if (userRole === "ADMIN") return true;
  const membership = await prisma.departmentMember.findUnique({
    where: { departmentId_userId: { departmentId, userId } },
    select: { isDepartmentAdmin: true },
  });
  return Boolean(membership?.isDepartmentAdmin);
}

export async function assertDepartmentAdmin(departmentId: string, userId: string, userRole?: string | null) {
  const canManage = await canManageDepartment(userId, departmentId, userRole);
  if (!canManage) {
    throw new Error("Unauthorized. Department admin access required.");
  }
}

export async function canAssignDepartmentTask(params: {
  assignerId: string;
  assigneeId: string;
  departmentId: string;
  userRole?: string | null;
}) {
  const { assignerId, assigneeId, departmentId, userRole } = params;
  if (assignerId === assigneeId) return true;
  if (userRole === "ADMIN") return true;

  const [assignerMembership, assigneeMembership] = await Promise.all([
    prisma.departmentMember.findUnique({
      where: { departmentId_userId: { departmentId, userId: assignerId } },
      select: {
        id: true,
        isDepartmentAdmin: true,
        projectScopeType: true,
      },
    }),
    prisma.departmentMember.findUnique({
      where: { departmentId_userId: { departmentId, userId: assigneeId } },
      select: { id: true },
    }),
  ]);

  if (!assignerMembership || !assigneeMembership) return false;
  if (assignerMembership.isDepartmentAdmin) return true;

  const explicitAssignee = await prisma.departmentMemberTaskAssigneeScope.findUnique({
    where: {
      departmentMemberId_assigneeUserId: {
        departmentMemberId: assignerMembership.id,
        assigneeUserId: assigneeId,
      },
    },
    select: { id: true },
  });
  if (explicitAssignee) return true;

  if (assignerMembership.projectScopeType === "ALL_PROJECTS") {
    const assigneeProject = await prisma.projectMember.findFirst({
      where: {
        userId: assigneeId,
        project: { departmentId },
      },
      select: { id: true },
    });
    if (assigneeProject) return true;
  }

  const managedProjectAssignee = await prisma.departmentMemberManagedProject.findFirst({
    where: {
      departmentMemberId: assignerMembership.id,
      project: {
        members: { some: { userId: assigneeId } },
      },
    },
    select: { id: true },
  });
  if (managedProjectAssignee) return true;

  const ownedProjectAssignee = await prisma.project.findFirst({
    where: {
      departmentId,
      ownerId: assignerId,
      members: { some: { userId: assigneeId } },
    },
    select: { id: true },
  });

  return Boolean(ownedProjectAssignee);
}
