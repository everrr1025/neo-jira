import prisma from "@/lib/prisma";

export type UserDepartmentMembership = {
  departmentId: string;
  departmentName: string;
  role: string;
};

export async function getUserDepartmentMembership(userId?: string | null): Promise<UserDepartmentMembership | null> {
  if (!userId) return null;

  const membership = await prisma.departmentMember.findFirst({
    where: { userId },
    select: {
      role: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!membership) return null;

  return {
    departmentId: membership.department.id,
    departmentName: membership.department.name,
    role: membership.role,
  };
}
