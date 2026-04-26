"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { checkGlobalAdmin, getRequiredSession } from "@/lib/permissions";
import { createAuditLogs } from "@/lib/audit";
import { createDefaultWorkflowForProject } from "@/lib/workflows";
import { deleteProjectData } from "@/lib/projectDataCleanup";

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

function normalizeDepartmentInput(data: {
  name: string;
  key: string;
  description?: string;
}) {
  return {
    name: data.name.trim(),
    key: data.key.trim().toUpperCase(),
    description: data.description?.trim() || null,
  };
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
    const { name, key, description } = normalizeDepartmentInput(data);

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
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, department: newDept };
  } catch (error: unknown) {
    console.error("Failed to create department:", error);
    return { success: false, error: getErrorMessage(error, "Failed to create department") };
  }
}

export async function updateDepartment(
  departmentId: string,
  data: {
    name: string;
    key: string;
    description?: string;
  }
) {
  try {
    const session = await checkGlobalAdmin();
    const actorId = getSessionUser(session).id;
    const { name, key, description } = normalizeDepartmentInput(data);

    if (!name || !key) {
      return { success: false, error: "Department name and key are required" };
    }

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true, key: true, description: true },
    });
    if (!department) {
      return { success: false, error: "Department not found" };
    }

    const existingKey = await prisma.department.findUnique({
      where: { key },
      select: { id: true },
    });
    if (existingKey && existingKey.id !== departmentId) {
      return { success: false, error: "Department key already exists" };
    }

    const existingName = await prisma.department.findUnique({
      where: { name },
      select: { id: true },
    });
    if (existingName && existingName.id !== departmentId) {
      return { success: false, error: "Department name already exists" };
    }

    const updatedDepartment = await prisma.$transaction(async (tx) => {
      const updated = await tx.department.update({
        where: { id: departmentId },
        data: {
          name,
          key,
          description,
        },
      });

      const auditEntries = [
        department.name !== name
          ? {
              entityType: "DEPARTMENT" as const,
              entityId: departmentId,
              action: "UPDATE" as const,
              field: "name",
              oldValue: department.name,
              newValue: name,
              actorId,
            }
          : null,
        department.key !== key
          ? {
              entityType: "DEPARTMENT" as const,
              entityId: departmentId,
              action: "UPDATE" as const,
              field: "key",
              oldValue: department.key,
              newValue: key,
              actorId,
            }
          : null,
        (department.description || null) !== description
          ? {
              entityType: "DEPARTMENT" as const,
              entityId: departmentId,
              action: "UPDATE" as const,
              field: "description",
              actorId,
            }
          : null,
      ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      if (auditEntries.length > 0) {
        await createAuditLogs(tx, auditEntries);
      }

      return updated;
    });

    revalidatePath("/admin/departments");
    revalidatePath(`/admin/departments/${departmentId}/members`);
    revalidatePath(`/departments/${departmentId}`);
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, department: updatedDepartment };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to update department") };
  }
}

export async function setDepartmentMemberRole(
  departmentId: string,
  userId: string,
  role: "HEAD" | "ASSISTANT" | "MEMBER"
) {
  try {
    const session = await getRequiredSession();
    const currentUser = getSessionUser(session);
    const currentUserId = currentUser.id;
    const isGlobalAdmin = currentUser.role === "ADMIN";
    if (!isGlobalAdmin) {
      const membership = await prisma.departmentMember.findUnique({
        where: { departmentId_userId: { departmentId, userId: currentUserId } },
        select: { role: true },
      });
      if (membership?.role !== "HEAD") {
        throw new Error("Unauthorized. Must be Admin or Department Head.");
      }
      if (role === "HEAD") {
        return { success: false, error: "Only system admin can assign department head." };
      }
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
    revalidatePath(`/departments/${departmentId}/members`);
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
    revalidatePath("/admin/users");
    revalidatePath("/admin");
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

async function checkDeptHeadOnly(departmentId: string) {
  const session = await getRequiredSession();
  const currentUser = getSessionUser(session);
  const currentUserId = currentUser.id;
  const isGlobalAdmin = currentUser.role === "ADMIN";
  if (isGlobalAdmin) {
    return { currentUserId, isGlobalAdmin: true };
  }

  const membership = await prisma.departmentMember.findUnique({
    where: { departmentId_userId: { departmentId, userId: currentUserId } },
  });
  if (membership?.role === "HEAD") {
    return { currentUserId, isGlobalAdmin: false };
  }
  throw new Error("Unauthorized. Must be Department Head.");
}

function normalizeProjectMemberIds(memberIds: unknown) {
  const ids = Array.isArray(memberIds) ? memberIds.filter((id): id is string => typeof id === "string") : [];
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export async function addMemberToDepartment(departmentId: string, userId: string, role = "MEMBER") {
  try {
    await checkGlobalAdmin();

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
    revalidatePath(`/departments/${departmentId}/members`);
    revalidatePath(`/admin/departments/${departmentId}/members`);
    revalidatePath("/admin/departments");
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to add member") };
  }
}

export async function addMembersToDepartment(departmentId: string, userIds: string[], role = "MEMBER") {
  try {
    await checkGlobalAdmin();

    const uniqueUserIds = Array.from(new Set(userIds.map((userId) => userId.trim()).filter(Boolean)));
    if (uniqueUserIds.length === 0) {
      return { success: false, error: "No users selected" };
    }

    const users = await prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true, role: true },
    });
    if (users.length !== uniqueUserIds.length) {
      return { success: false, error: "User not found" };
    }

    if (users.some((user) => user.role === "ADMIN")) {
      return { success: false, error: "Cannot add system admin to department" };
    }

    const existingMemberships = await prisma.departmentMember.findMany({
      where: { userId: { in: uniqueUserIds } },
      select: { userId: true, departmentId: true },
    });
    const conflict = existingMemberships.find((membership) => membership.departmentId !== departmentId);
    if (conflict) {
      return { success: false, error: "User already belongs to another department" };
    }

    await prisma.$transaction(
      uniqueUserIds.map((userId) =>
        prisma.departmentMember.upsert({
          where: { departmentId_userId: { departmentId, userId } },
          update: { role },
          create: { departmentId, userId, role },
        })
      )
    );

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath(`/departments/${departmentId}/members`);
    revalidatePath(`/admin/departments/${departmentId}/members`);
    revalidatePath("/admin/departments");
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to add member") };
  }
}

export async function removeMemberFromDepartment(departmentId: string, userId: string) {
  try {
    await checkGlobalAdmin();

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
    revalidatePath(`/departments/${departmentId}/members`);
    revalidatePath(`/admin/departments/${departmentId}/members`);
    revalidatePath("/admin/departments");
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to remove member") };
  }
}

export async function createDepartmentProject(
  departmentId: string,
  data: {
    name?: string;
    key?: string;
    description?: string;
    ownerId?: string;
    memberIds?: unknown;
  }
) {
  try {
    await checkDeptHeadOnly(departmentId);
    const name = typeof data?.name === "string" ? data.name.trim() : "";
    const key = typeof data?.key === "string" ? data.key.trim().toUpperCase() : "";
    const description = typeof data?.description === "string" ? data.description.trim() : "";
    const ownerId = typeof data?.ownerId === "string" ? data.ownerId.trim() : "";
    const memberIds = normalizeProjectMemberIds(data?.memberIds);

    if (!name || !key) {
      return { success: false, error: "Project name and key are required." };
    }
    if ((memberIds.length > 0 && !ownerId) || (ownerId && !memberIds.includes(ownerId))) {
      return { success: false, error: "Project owner must be selected from project members." };
    }

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true, key: true },
    });
    if (!department) {
      return { success: false, error: "Department not found." };
    }

    const existing = await prisma.project.findUnique({
      where: { key },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: "Project key already exists." };
    }

    const finalMemberIds = Array.from(new Set(memberIds));
    const departmentMembers = await prisma.departmentMember.findMany({
      where: { departmentId, userId: { in: finalMemberIds } },
      select: { userId: true },
    });
    if (departmentMembers.length !== finalMemberIds.length) {
      return { success: false, error: "Selected project members must belong to this department." };
    }

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          name,
          key,
          description: description || null,
          ownerId: ownerId || null,
          departmentId,
        },
      });

      if (finalMemberIds.length > 0) {
        await tx.projectMember.createMany({
          data: finalMemberIds.map((memberId) => ({
            userId: memberId,
            projectId: createdProject.id,
            role: memberId === ownerId ? "ADMIN" : "MEMBER",
          })),
        });
      }

      await createDefaultWorkflowForProject(tx, createdProject.id);

      return createdProject;
    });

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath(`/departments/${departmentId}/members`);
    revalidatePath(`/departments/${departmentId}/projects`);
    revalidatePath("/projects");
    revalidatePath("/");
    return { success: true, project };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to create project") };
  }
}

export async function updateDepartmentProjectMembers(
  departmentId: string,
  projectId: string,
  data: {
    ownerId?: string;
    memberIds: string[];
  }
) {
  try {
    await checkDeptHeadOnly(departmentId);
    const ownerId = typeof data.ownerId === "string" ? data.ownerId.trim() : "";
    const uniqueMemberIds = Array.from(new Set(data.memberIds.map((id) => id.trim()).filter(Boolean)));
    if ((uniqueMemberIds.length > 0 && !ownerId) || (ownerId && !uniqueMemberIds.includes(ownerId))) {
      return { success: false, error: "Project owner must be selected from project members." };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: true,
      },
    });
    if (!project || project.departmentId !== departmentId) {
      return { success: false, error: "Project not found." };
    }

    const finalMemberIds = uniqueMemberIds;
    const departmentMembers = await prisma.departmentMember.findMany({
      where: { departmentId, userId: { in: finalMemberIds } },
      select: { userId: true },
    });
    if (departmentMembers.length !== finalMemberIds.length) {
      return { success: false, error: "Selected project members must belong to this department." };
    }

    await prisma.$transaction(async (tx) => {
      const currentMemberIds = project.members.map((member) => member.userId);
      const toRemove = currentMemberIds.filter((userId) => !finalMemberIds.includes(userId));
      const toAdd = finalMemberIds.filter((userId) => !currentMemberIds.includes(userId));

      if (toRemove.length > 0) {
        await tx.projectMember.deleteMany({
          where: {
            projectId,
            userId: { in: toRemove },
          },
        });
      }

      if (toAdd.length > 0) {
        await tx.projectMember.createMany({
          data: toAdd.map((userId) => ({
            userId,
            projectId,
            role: "MEMBER",
          })),
        });
      }

      await tx.projectMember.updateMany({
        where: {
          projectId,
          role: "ADMIN",
        },
        data: { role: "MEMBER" },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { ownerId: ownerId || null },
      });

      if (ownerId) {
        await tx.projectMember.update({
          where: { userId_projectId: { userId: ownerId, projectId } },
          data: { role: "ADMIN" },
        });
      }
    });

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath(`/departments/${departmentId}/members`);
    revalidatePath(`/departments/${departmentId}/projects`);
    revalidatePath(`/departments/${departmentId}/projects/${projectId}/members`);
    revalidatePath(`/projects/${projectId}/settings`);
    revalidatePath("/projects");
    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to update project members") };
  }
}

export async function deleteDepartmentProject(departmentId: string, projectId: string) {
  try {
    await checkDeptHeadOnly(departmentId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, departmentId: true },
    });
    if (!project || project.departmentId !== departmentId) {
      return { success: false, error: "Project not found." };
    }

    await prisma.$transaction(async (tx) => {
      await deleteProjectData(tx, [projectId]);
    });

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath(`/departments/${departmentId}/members`);
    revalidatePath(`/departments/${departmentId}/projects`);
    revalidatePath(`/departments/${departmentId}/projects/${projectId}/members`);
    revalidatePath("/projects");
    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to delete project") };
  }
}
