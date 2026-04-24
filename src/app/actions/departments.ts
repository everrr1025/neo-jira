"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { checkGlobalAdmin, getRequiredSession } from "@/lib/permissions";

export async function createDepartment(data: {
  name: string;
  key: string;
  description?: string;
  headUserId?: string; // Optional at creation
}) {
  try {
    await checkGlobalAdmin();

    const existingKey = await prisma.department.findUnique({
      where: { key: data.key },
    });
    if (existingKey) {
      return { success: false, error: "Department key already exists" };
    }

    const newDept = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.create({
        data: {
          name: data.name,
          key: data.key,
          description: data.description,
        },
      });

      if (data.headUserId) {
        await tx.departmentMember.create({
          data: {
            departmentId: dept.id,
            userId: data.headUserId,
            role: "HEAD",
          },
        });
      }

      return dept;
    });

    revalidatePath("/admin/departments");
    return { success: true, department: newDept };
  } catch (error: any) {
    console.error("Failed to create department:", error);
    return { success: false, error: error.message || "Failed to create department" };
  }
}

export async function setDepartmentMemberRole(
  departmentId: string,
  userId: string,
  role: "HEAD" | "ASSISTANT" | "MEMBER"
) {
  try {
    // Both GLOBAL ADMIN and the current department's HEAD can change roles
    // But let's verify logic:
    const session = await getRequiredSession();
    const currentUserId = (session.user as any).id;
    const isGlobalAdmin = (session.user as any).role === "ADMIN";

    let isDeptHead = false;
    if (!isGlobalAdmin) {
      const headCheck = await prisma.departmentMember.findUnique({
        where: { departmentId_userId: { departmentId, userId: currentUserId } },
      });
      if (headCheck?.role === "HEAD") {
        isDeptHead = true;
      }
    }

    if (!isGlobalAdmin && !isDeptHead) {
      throw new Error("Unauthorized. Must be Admin or Department Head.");
    }

    const updated = await prisma.departmentMember.upsert({
      where: {
        departmentId_userId: { departmentId, userId },
      },
      update: {
        role,
      },
      create: {
        departmentId,
        userId,
        role,
      },
    });

    revalidatePath(`/admin/departments`);
    revalidatePath(`/admin`);
    return { success: true, member: updated };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to set member role" };
  }
}

export async function deleteDepartment(departmentId: string) {
  try {
    await checkGlobalAdmin();
    
    await prisma.department.delete({
      where: { id: departmentId }
    });
    
    revalidatePath("/admin/departments");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete department" };
  }
}

async function checkDeptHeadOrAdmin(departmentId: string) {
  const session = await getRequiredSession();
  const currentUserId = (session.user as any).id;
  const isGlobalAdmin = (session.user as any).role === "ADMIN";
  if (isGlobalAdmin) return { currentUserId, isGlobalAdmin };

  const membership = await prisma.departmentMember.findUnique({
    where: { departmentId_userId: { departmentId, userId: currentUserId } },
  });
  if (membership?.role === "HEAD" || membership?.role === "ASSISTANT") {
    return { currentUserId, isGlobalAdmin: false };
  }
  throw new Error("Unauthorized. Must be Admin, Department Head or Assistant.");
}

export async function addMemberToDepartment(departmentId: string, userId: string, role = "MEMBER") {
  try {
    await checkDeptHeadOrAdmin(departmentId);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) return { success: false, error: "User not found" };
    if (user.role === "ADMIN") return { success: false, error: "Cannot add system admin to department" };

    await prisma.departmentMember.upsert({
      where: { departmentId_userId: { departmentId, userId } },
      update: { role },
      create: { departmentId, userId, role },
    });

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to add member" };
  }
}

export async function removeMemberFromDepartment(departmentId: string, userId: string) {
  try {
    await checkDeptHeadOrAdmin(departmentId);

    // Prevent removing the HEAD
    const membership = await prisma.departmentMember.findUnique({
      where: { departmentId_userId: { departmentId, userId } },
    });
    if (!membership) return { success: false, error: "User is not in this department" };
    if (membership.role === "HEAD") return { success: false, error: "Cannot remove department head" };

    await prisma.departmentMember.delete({
      where: { departmentId_userId: { departmentId, userId } },
    });

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to remove member" };
  }
}
