"use server";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { checkGlobalAdmin, getRequiredSession } from "@/lib/permissions";
import { isProjectScopeType } from "@/lib/departmentPermissions";
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

function getDepartmentUniqueError(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const targets = Array.isArray(error.meta?.target) ? error.meta.target : [];
    if (targets.includes("key")) return "Department key already exists";
    if (targets.includes("name")) return "Department name already exists";
  }
  return getErrorMessage(error, fallback);
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
    const existingName = await prisma.department.findFirst({
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
        const headUser = await tx.user.findUnique({
          where: { id: data.headUserId },
          select: { role: true, disabledAt: true },
        });
        if (!headUser) {
          throw new Error("Selected head user not found");
        }
        if (headUser.role === "ADMIN") {
          throw new Error("Cannot add system admin to department");
        }
        if (headUser.disabledAt) throw new Error("Cannot add disabled user to department");

        const existingHeadMembership = await tx.departmentMember.findFirst({
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
            isDepartmentAdmin: true,
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
    return { success: false, error: getDepartmentUniqueError(error, "Failed to create department") };
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

    const existingName = await prisma.department.findFirst({
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
              metadata: { name: updated.name, key: updated.key },
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
              metadata: { name: updated.name, key: updated.key },
              actorId,
            }
          : null,
        (department.description || null) !== description
          ? {
              entityType: "DEPARTMENT" as const,
              entityId: departmentId,
              action: "UPDATE" as const,
              field: "description",
              metadata: { name: updated.name, key: updated.key },
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
    return { success: false, error: getDepartmentUniqueError(error, "Failed to update department") };
  }
}

export async function setDepartmentMemberRole(
  departmentId: string,
  userId: string,
  role: "HEAD" | "ASSISTANT" | "MEMBER"
) {
  return setDepartmentMemberAdmin(departmentId, userId, role === "HEAD" || role === "ASSISTANT");
}

export async function setDepartmentMemberAdmin(
  departmentId: string,
  userId: string,
  isDepartmentAdmin: boolean
) {
  try {
    const session = await checkGlobalAdmin();
    const currentUserId = getSessionUser(session).id;

    const targetMembership = await prisma.departmentMember.findUnique({
      where: { departmentId_userId: { departmentId, userId } },
      select: { id: true, user: { select: { role: true } } },
    });
    if (!targetMembership) {
      return { success: false, error: "Department admin must be selected from current department members." };
    }
    if (targetMembership.user.role === "ADMIN") {
      return { success: false, error: "System admin cannot be a department admin." };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const member = await tx.departmentMember.update({
        where: { departmentId_userId: { departmentId, userId } },
        data: {
          isDepartmentAdmin,
          role: isDepartmentAdmin ? "HEAD" : "MEMBER",
        },
      });

      await createAuditLogs(tx, [
        {
          entityType: "DEPARTMENT",
          entityId: departmentId,
          action: "UPDATE",
          field: "departmentAdmin",
          newValue: String(isDepartmentAdmin),
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
    return { success: false, error: getErrorMessage(error, "Failed to set department admin") };
  }
}

export async function deleteDepartment(departmentId: string, confirmName?: string) {
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
    if ((confirmName || "").trim() !== department.name) {
      return { success: false, error: "Department name confirmation does not match." };
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

async function checkDepartmentAdminOnly(departmentId: string) {
  const session = await getRequiredSession();
  const currentUser = getSessionUser(session);
  const currentUserId = currentUser.id;

  const membership = await prisma.departmentMember.findUnique({
    where: { departmentId_userId: { departmentId, userId: currentUserId } },
    select: { isDepartmentAdmin: true },
  });
  if (membership?.isDepartmentAdmin) {
    return { currentUserId };
  }
  throw new Error("Unauthorized. Department admin access required.");
}

function normalizeProjectMemberIds(memberIds: unknown) {
  const ids = Array.isArray(memberIds) ? memberIds.filter((id): id is string => typeof id === "string") : [];
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export async function addMemberToDepartment(departmentId: string, userId: string, role = "MEMBER") {
  try {
    const session = await checkGlobalAdmin();
    const actorId = getSessionUser(session).id;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, disabledAt: true } });
    if (!user) return { success: false, error: "User not found" };
    if (user.role === "ADMIN") return { success: false, error: "Cannot add system admin to department" };
    if (user.disabledAt) return { success: false, error: "Cannot add disabled user to department" };

    const existingMembership = await prisma.departmentMember.findFirst({
      where: { userId },
      select: { departmentId: true },
    });
    if (existingMembership && existingMembership.departmentId !== departmentId) {
      return { success: false, error: "User already belongs to another department" };
    }

    await prisma.departmentMember.upsert({
      where: { departmentId_userId: { departmentId, userId } },
      update: { role, isDepartmentAdmin: role === "HEAD" || role === "ASSISTANT" },
      create: { departmentId, userId, role, isDepartmentAdmin: role === "HEAD" || role === "ASSISTANT" },
    });
    await createAuditLogs(prisma, [{ entityType: "DEPARTMENT", entityId: departmentId, action: "UPDATE", field: "members", metadata: { userId }, actorId }]);

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
    const session = await checkGlobalAdmin();
    const actorId = getSessionUser(session).id;

    const uniqueUserIds = Array.from(new Set(userIds.map((userId) => userId.trim()).filter(Boolean)));
    if (uniqueUserIds.length === 0) {
      return { success: false, error: "No users selected" };
    }

    const users = await prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true, role: true, disabledAt: true },
    });
    if (users.length !== uniqueUserIds.length) {
      return { success: false, error: "User not found" };
    }

    if (users.some((user) => user.role === "ADMIN")) {
      return { success: false, error: "Cannot add system admin to department" };
    }
    if (users.some((user) => user.disabledAt)) return { success: false, error: "Cannot add disabled user to department" };

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
          update: { role, isDepartmentAdmin: role === "HEAD" || role === "ASSISTANT" },
          create: { departmentId, userId, role, isDepartmentAdmin: role === "HEAD" || role === "ASSISTANT" },
        })
      )
    );
    await createAuditLogs(prisma, [{ entityType: "DEPARTMENT", entityId: departmentId, action: "UPDATE", field: "members", metadata: { userIds: uniqueUserIds.join(",") }, actorId }]);

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
    const session = await checkGlobalAdmin();
    const actorId = getSessionUser(session).id;

    const membership = await prisma.departmentMember.findUnique({
      where: { departmentId_userId: { departmentId, userId } },
    });
    if (!membership) return { success: false, error: "User is not in this department" };

    await prisma.departmentMember.delete({
      where: { departmentId_userId: { departmentId, userId } },
    });
    await createAuditLogs(prisma, [{ entityType: "DEPARTMENT", entityId: departmentId, action: "UPDATE", field: "members", metadata: { userId }, actorId }]);

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
    const { currentUserId } = await checkDepartmentAdminOnly(departmentId);
    const name = typeof data?.name === "string" ? data.name.trim() : "";
    const key = typeof data?.key === "string" ? data.key.trim().toUpperCase() : "";
    const description = typeof data?.description === "string" ? data.description.trim() : "";
    const ownerId = typeof data?.ownerId === "string" ? data.ownerId.trim() : "";
    const memberIds = normalizeProjectMemberIds(data?.memberIds);

    if (!name || !key) {
      return { success: false, error: "Project name and key are required." };
    }
    if (ownerId && !memberIds.includes(ownerId)) {
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
      where: { departmentId, userId: { in: finalMemberIds }, user: { disabledAt: null } },
      select: { userId: true },
    });
    if (departmentMembers.length !== finalMemberIds.length) {
      return { success: false, error: "Selected project members must belong to this department." };
    }

    const project = await prisma.$transaction(async (tx) => {
      const projectData = {
        name,
        key,
        description: description || null,
        departmentId,
        ...(ownerId ? { ownerId } : {}),
      };

      const createdProject = await tx.project.create({
        data: projectData,
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

      await createAuditLogs(tx, [{
        entityType: "PROJECT", entityId: createdProject.id, action: "CREATE",
        metadata: { name: createdProject.name, key: createdProject.key, departmentName: department.name }, actorId: currentUserId,
      }]);

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
    const { currentUserId } = await checkDepartmentAdminOnly(departmentId);
    const ownerId = typeof data.ownerId === "string" ? data.ownerId.trim() : "";
    const uniqueMemberIds = Array.from(new Set(data.memberIds.map((id) => id.trim()).filter(Boolean)));
    if (ownerId && !uniqueMemberIds.includes(ownerId)) {
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
    const currentMemberIds = project.members.map((member) => member.userId);
    const newlyAddedIds = finalMemberIds.filter((userId) => !currentMemberIds.includes(userId));
    const unavailableNewMembers = newlyAddedIds.length > 0
      ? await prisma.user.count({ where: { id: { in: newlyAddedIds }, disabledAt: { not: null } } })
      : 0;
    if (unavailableNewMembers > 0) return { success: false, error: "Cannot add disabled user to project" };
    if (ownerId) {
      const activeOwner = await prisma.user.findFirst({ where: { id: ownerId, disabledAt: null }, select: { id: true } });
      if (!activeOwner) return { success: false, error: "Project owner must be active" };
    }
    const departmentMembers = await prisma.departmentMember.findMany({
      where: { departmentId, userId: { in: finalMemberIds } },
      select: { userId: true },
    });
    if (departmentMembers.length !== finalMemberIds.length) {
      return { success: false, error: "Selected project members must belong to this department." };
    }

    await prisma.$transaction(async (tx) => {
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

      if (ownerId) {
        await tx.projectMember.update({
          where: { userId_projectId: { userId: ownerId, projectId } },
          data: { role: "ADMIN" },
        });
      }

      await tx.project.update({
        where: { id: projectId },
        data: ownerId ? { ownerId } : { ownerId: null },
      });
      await createAuditLogs(tx, [{
        entityType: "PROJECT", entityId: projectId, action: "UPDATE", field: "members",
        metadata: { name: project.name }, actorId: currentUserId,
      }]);
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

export async function updateDepartmentProject(
  departmentId: string,
  projectId: string,
  data: {
    name?: string;
    key?: string;
    description?: string;
  }
) {
  try {
    const { currentUserId } = await checkDepartmentAdminOnly(departmentId);

    const name = typeof data?.name === "string" ? data.name.trim() : "";
    const key = typeof data?.key === "string" ? data.key.trim().toUpperCase() : "";
    const description = typeof data?.description === "string" ? data.description.trim() : "";

    if (!name || !key) {
      return { success: false, error: "Project name and key are required." };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, departmentId: true, name: true, key: true },
    });
    if (!project || project.departmentId !== departmentId) {
      return { success: false, error: "Project not found." };
    }

    const existing = await prisma.project.findFirst({
      where: {
        key,
        id: { not: projectId },
      },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: "Project key already exists." };
    }

    const updatedProject = await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data: { name, key, description: description || null },
      });
      await createAuditLogs(tx, [{
        entityType: "PROJECT", entityId: projectId, action: "UPDATE", field: "details",
        metadata: { name: updated.name, key: updated.key }, actorId: currentUserId,
      }]);
      return updated;
    });

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath(`/departments/${departmentId}/projects`);
    revalidatePath(`/departments/${departmentId}/projects/${projectId}/members`);
    revalidatePath(`/projects/${projectId}/settings`);
    revalidatePath("/projects");
    revalidatePath("/");
    return { success: true, project: updatedProject };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to update project") };
  }
}

export async function deleteDepartmentProject(departmentId: string, projectId: string, confirmName?: string) {
  try {
    const { currentUserId } = await checkDepartmentAdminOnly(departmentId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, departmentId: true, name: true },
    });
    if (!project || project.departmentId !== departmentId) {
      return { success: false, error: "Project not found." };
    }
    if ((confirmName || "").trim() !== project.name) {
      return { success: false, error: "Project name confirmation does not match." };
    }

    await prisma.$transaction(async (tx) => {
      await deleteProjectData(tx, [projectId]);
      await createAuditLogs(tx, [{
        entityType: "PROJECT", entityId: project.id, action: "DELETE",
        metadata: { name: project.name }, actorId: currentUserId,
      }]);
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

export async function createDepartmentPosition(departmentId: string, data: { name?: string }) {
  try {
    const { currentUserId } = await checkDepartmentAdminOnly(departmentId);
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!name) return { success: false, error: "Position name is required." };

    const count = await prisma.departmentPosition.count({ where: { departmentId } });
    const position = await prisma.departmentPosition.create({
      data: { departmentId, name, sortOrder: count },
    });
    await createAuditLogs(prisma, [{ entityType: "DEPARTMENT", entityId: departmentId, action: "UPDATE", field: "positions", metadata: { name }, actorId: currentUserId }]);

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath(`/departments/${departmentId}/members`);
    return { success: true, position };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to create position") };
  }
}

export async function updateDepartmentPosition(departmentId: string, positionId: string, data: { name?: string }) {
  try {
    const { currentUserId } = await checkDepartmentAdminOnly(departmentId);
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!name) return { success: false, error: "Position name is required." };

    const position = await prisma.departmentPosition.findUnique({ where: { id: positionId }, select: { departmentId: true } });
    if (!position || position.departmentId !== departmentId) return { success: false, error: "Position not found." };

    const updated = await prisma.departmentPosition.update({
      where: { id: positionId },
      data: { name },
    });
    await createAuditLogs(prisma, [{ entityType: "DEPARTMENT", entityId: departmentId, action: "UPDATE", field: "positions", metadata: { name }, actorId: currentUserId }]);

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath(`/departments/${departmentId}/members`);
    return { success: true, position: updated };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to update position") };
  }
}

export async function deleteDepartmentPosition(departmentId: string, positionId: string) {
  try {
    const { currentUserId } = await checkDepartmentAdminOnly(departmentId);
    const position = await prisma.departmentPosition.findUnique({ where: { id: positionId }, select: { departmentId: true, name: true } });
    if (!position || position.departmentId !== departmentId) return { success: false, error: "Position not found." };

    await prisma.$transaction(async (tx) => {
      await tx.departmentMember.updateMany({
        where: { departmentId, positionId },
        data: { positionId: null },
      });
      await tx.departmentPosition.delete({ where: { id: positionId } });
      await createAuditLogs(tx, [{ entityType: "DEPARTMENT", entityId: departmentId, action: "UPDATE", field: "positions", metadata: { name: position.name }, actorId: currentUserId }]);
    });

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath(`/departments/${departmentId}/members`);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to delete position") };
  }
}

export async function updateDepartmentMemberSettings(
  departmentId: string,
  userId: string,
  data: {
    positionId?: string | null;
    projectScopeType?: string;
    managedProjectIds?: string[];
    taskAssigneeIds?: string[];
    taskPositionIds?: string[];
    taskProjectScopeType?: string;
    taskProjectIds?: string[];
    canCreateDepartmentAnnouncements?: boolean;
    announcementProjectScopeType?: string;
    announcementProjectIds?: string[];
  }
) {
  try {
    const { currentUserId } = await checkDepartmentAdminOnly(departmentId);

    const membership = await prisma.departmentMember.findUnique({
      where: { departmentId_userId: { departmentId, userId } },
      select: { id: true },
    });
    if (!membership) return { success: false, error: "Department member not found." };

    const positionId = data.positionId?.trim() || null;
    if (positionId) {
      const position = await prisma.departmentPosition.findUnique({
        where: { id: positionId },
        select: { departmentId: true },
      });
      if (!position || position.departmentId !== departmentId) {
        return { success: false, error: "Position not found." };
      }
    }

    const projectScopeType = isProjectScopeType(data.projectScopeType || "")
      ? data.projectScopeType!
      : "NONE";
    const taskProjectScopeType = isProjectScopeType(data.taskProjectScopeType || "")
      ? data.taskProjectScopeType!
      : "NONE";
    const announcementProjectScopeType = isProjectScopeType(data.announcementProjectScopeType || "")
      ? data.announcementProjectScopeType!
      : "NONE";
    const managedProjectIds = Array.from(new Set((data.managedProjectIds || []).map((id) => id.trim()).filter(Boolean)));
    const taskAssigneeIds = Array.from(new Set((data.taskAssigneeIds || []).map((id) => id.trim()).filter(Boolean)));
    const taskPositionIds = Array.from(new Set((data.taskPositionIds || []).map((id) => id.trim()).filter(Boolean)));
    const taskProjectIds = Array.from(new Set((data.taskProjectIds || []).map((id) => id.trim()).filter(Boolean)));
    const announcementProjectIds = Array.from(new Set((data.announcementProjectIds || []).map((id) => id.trim()).filter(Boolean)));

    const projectIdsToValidate = Array.from(new Set([...managedProjectIds, ...taskProjectIds, ...announcementProjectIds]));
    if (projectIdsToValidate.length > 0) {
      const projects = await prisma.project.findMany({
        where: { departmentId, id: { in: projectIdsToValidate } },
        select: { id: true },
      });
      if (projects.length !== projectIdsToValidate.length) {
        return { success: false, error: "Selected projects must belong to this department." };
      }
    }

    if (taskAssigneeIds.length > 0) {
      const assignees = await prisma.departmentMember.findMany({
        where: { departmentId, userId: { in: taskAssigneeIds } },
        select: { userId: true },
      });
      if (assignees.length !== taskAssigneeIds.length) {
        return { success: false, error: "Task assignees must belong to this department." };
      }
    }

    if (taskPositionIds.length > 0) {
      const positions = await prisma.departmentPosition.findMany({
        where: { departmentId, id: { in: taskPositionIds } },
        select: { id: true },
      });
      if (positions.length !== taskPositionIds.length) {
        return { success: false, error: "Selected positions must belong to this department." };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.departmentMember.update({
        where: { departmentId_userId: { departmentId, userId } },
        data: {
          positionId,
          projectScopeType,
          taskProjectScopeType,
          canCreateDepartmentAnnouncements: Boolean(data.canCreateDepartmentAnnouncements),
          announcementProjectScopeType,
        },
      });

      await tx.departmentMemberManagedProject.deleteMany({
        where: { departmentMemberId: membership.id },
      });
      if (projectScopeType === "SELECTED_PROJECTS" && managedProjectIds.length > 0) {
        await tx.departmentMemberManagedProject.createMany({
          data: managedProjectIds.map((projectId) => ({
            departmentMemberId: membership.id,
            projectId,
            userId,
          })),
        });
      }

      await tx.departmentMemberTaskAssigneeScope.deleteMany({
        where: { departmentMemberId: membership.id },
      });
      if (taskAssigneeIds.length > 0) {
        await tx.departmentMemberTaskAssigneeScope.createMany({
          data: taskAssigneeIds.map((assigneeUserId) => ({
            departmentMemberId: membership.id,
            assigneeUserId,
          })),
        });
      }

      await tx.departmentMemberTaskPositionScope.deleteMany({
        where: { departmentMemberId: membership.id },
      });
      if (taskPositionIds.length > 0) {
        await tx.departmentMemberTaskPositionScope.createMany({
          data: taskPositionIds.map((positionId) => ({
            departmentMemberId: membership.id,
            positionId,
          })),
        });
      }

      await tx.departmentMemberTaskProjectScope.deleteMany({
        where: { departmentMemberId: membership.id },
      });
      if (taskProjectScopeType === "SELECTED_PROJECTS" && taskProjectIds.length > 0) {
        await tx.departmentMemberTaskProjectScope.createMany({
          data: taskProjectIds.map((projectId) => ({
            departmentMemberId: membership.id,
            projectId,
          })),
        });
      }

      await tx.departmentMemberAnnouncementProjectScope.deleteMany({
        where: { departmentMemberId: membership.id },
      });
      if (announcementProjectScopeType === "SELECTED_PROJECTS" && announcementProjectIds.length > 0) {
        await tx.departmentMemberAnnouncementProjectScope.createMany({
          data: announcementProjectIds.map((projectId) => ({
            departmentMemberId: membership.id,
            projectId,
          })),
        });
      }
      await createAuditLogs(tx, [{
        entityType: "DEPARTMENT", entityId: departmentId, action: "UPDATE", field: "memberPermissions",
        metadata: { userId }, actorId: currentUserId,
      }]);
    });

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath(`/departments/${departmentId}/members`);
    revalidatePath(`/departments/${departmentId}/projects`);
    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Failed to update member settings") };
  }
}
