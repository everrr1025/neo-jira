"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { checkGlobalAdmin, getRequiredSession } from "@/lib/permissions";
import { createAuditLogs } from "@/lib/audit";

function getSessionUser(session: unknown) {
  const user = (session as { user?: { id?: string; role?: string | null } }).user;
  return {
    id: user?.id || "",
    role: user?.role || "USER",
  };
}

function getErrorMessage(error: unknown, fallback = "Unexpected error") {
  return error instanceof Error ? error.message : fallback;
}

export async function createDepartment(data: {
  name: string;
  key: string;
  description?: string;
  headUserId?: string; // Optional at creation
}) {
  try {
    const session = await checkGlobalAdmin();
    const actorId = getSessionUser(session).id;
    const name = data.name.trim();
    const key = data.key.trim().toUpperCase();
    const description = data.description?.trim() || null;

    if (!name || !key) {
      return { success: false, error: "Department name and key are required" };
    }

    const existingKey = await prisma.department.findUnique({
      where: { key },
    });
    if (existingKey) {
      return { success: false, error: "Department key already exists" };
    }
    const existingName = await prisma.department.findUnique({
      where: { name },
    });
    if (existingName) {
      return { success: false, error: "Department name already exists" };
    }

    const newDept = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.create({
        data: {
          name,
          key,
          description,
        },
      });

      if (data.headUserId) {
        const existingHeadMembership = await tx.departmentMember.findUnique({
          where: { userId: data.headUserId },
          select: { departmentId: true },
        });
        if (existingHeadMembership) {
          throw new Error("Selected head already belongs to another department");
        }

        await tx.departmentMember.create({
          data: {
            departmentId: dept.id,
            userId: data.headUserId,
            role: "HEAD",
          },
        });
      }

      await createAuditLogs(tx, [
        {
          entityType: "DEPARTMENT",
          entityId: dept.id,
          action: "CREATE",
          metadata: { name: dept.name, key: dept.key },
          actorId,
        },
      ]);

      return dept;
    });

    revalidatePath("/admin/departments");
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, department: newDept };
  } catch (error: unknown) {
    console.error("Failed to create department:", error);
    return { success: false, error: getErrorMessage(error, "Failed to create department") };
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
    const currentUser = getSessionUser(session);
    const currentUserId = currentUser.id;
    const isGlobalAdmin = currentUser.role === "ADMIN";

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

    const targetMembership = await prisma.departmentMember.findUnique({
      where: { departmentId_userId: { departmentId, userId } },
      select: { id: true },
    });
    if (!targetMembership) {
      return { success: false, error: "Department head must be selected from current department members." };
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (role === "HEAD") {
        await tx.departmentMember.updateMany({
          where: { departmentId, role: "HEAD", userId: { not: userId } },
          data: { role: "MEMBER" },
        });
      }

      const member = await tx.departmentMember.update({
        where: { departmentId_userId: { departmentId, userId } },
        data: { role },
      });

      await createAuditLogs(tx, [
        {
          entityType: "DEPARTMENT",
          entityId: departmentId,
          action: "UPDATE",
          field: "memberRole",
          newValue: role,
          metadata: { userId },
          actorId: currentUserId,
        },
      ]);

      return member;
    });

    revalidatePath(`/admin/departments`);
    revalidatePath(`/admin/departments/${departmentId}/members`);
    revalidatePath(`/admin/users`);
    revalidatePath(`/admin`);
    return { success: true, member: updated };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to set member role") };
  }
}

export async function deleteDepartment(departmentId: string) {
  try {
    const session = await checkGlobalAdmin();
    const actorId = getSessionUser(session).id;

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true, key: true },
    });
    if (!department) {
      return { success: false, error: "Department not found" };
    }
    
    await prisma.$transaction(async (tx) => {
      await tx.department.delete({
        where: { id: departmentId },
      });

      await createAuditLogs(tx, [
        {
          entityType: "DEPARTMENT",
          entityId: department.id,
          action: "DELETE",
          metadata: { name: department.name, key: department.key },
          actorId,
        },
      ]);
    });
    
    revalidatePath("/admin/departments");
    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to delete department") };
  }
}

async function checkDeptHeadOrAdmin(departmentId: string) {
  const session = await getRequiredSession();
  const currentUser = getSessionUser(session);
  const currentUserId = currentUser.id;
  const isGlobalAdmin = currentUser.role === "ADMIN";
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

    const existingMembership = await prisma.departmentMember.findUnique({
      where: { userId },
      select: { departmentId: true },
    });
    if (existingMembership && existingMembership.departmentId !== departmentId) {
      return { success: false, error: "User already belongs to another department" };
    }

    await prisma.departmentMember.upsert({
      where: { departmentId_userId: { departmentId, userId } },
      update: { role },
      create: { departmentId, userId, role },
    });

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath(`/admin/departments/${departmentId}/members`);
    revalidatePath("/admin/departments");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to add member") };
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
    revalidatePath(`/admin/departments/${departmentId}/members`);
    revalidatePath("/admin/departments");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to remove member") };
  }
}
