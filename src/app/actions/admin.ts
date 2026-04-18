"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { checkGlobalAdmin } from "@/lib/permissions";
import { createDefaultWorkflowForProject } from "@/lib/workflows";

import { isValidPassword } from "@/lib/validation";

function generateSecurePassword(length = 12) {
  const special = "!@#$%^&*()-_=+[]{};:,.?/|";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const pools = [upper, lower, digits, special];
  const requiredPools = [upper, lower, digits];

  let generated = requiredPools.map((pool) => pool[randomInt(pool.length)]).join("");
  const allChars = pools.join("");
  while (generated.length < Math.max(8, length)) {
    generated += allChars[randomInt(allChars.length)];
  }

  const chars = generated.split("");
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export async function createUser(data: any) {
  try {
    await checkGlobalAdmin();
    const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
    const password = typeof data?.password === "string" ? data.password : "";

    if (!email || !password) {
      return { success: false, error: "Email and password are required." };
    }
    if (!isValidPassword(password)) {
      return {
        success: false,
        error: "Password must be at least 8 characters and include at least 3 of: uppercase, lowercase, number, special character.",
      };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "Email is already in use" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email,
        password: hashedPassword,
        role: data.role || "USER",
      }
    });
    revalidatePath("/admin");
    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteUser(userId: string) {
  try {
    const session = await checkGlobalAdmin();
    const currentAdminId = (session.user as any).id as string;
    if (!userId) {
      return { success: false, error: "User id is required." };
    }
    if (userId === currentAdminId) {
      return { success: false, error: "You cannot delete your own account." };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return { success: false, error: "User not found." };
    }

    const ownedProject = await prisma.project.findFirst({
      where: { ownerId: userId },
      select: { id: true, name: true },
    });
    if (ownedProject) {
      return { success: false, error: "Cannot delete user who is a project owner." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.issue.updateMany({
        where: { assigneeId: userId },
        data: { assigneeId: null },
      });

      await tx.issue.updateMany({
        where: { reporterId: userId },
        data: { reporterId: currentAdminId },
      });

      await tx.comment.updateMany({
        where: { authorId: userId },
        data: { authorId: currentAdminId },
      });

      await tx.attachment.updateMany({
        where: { uploaderId: userId },
        data: { uploaderId: currentAdminId },
      });

      await tx.notification.updateMany({
        where: { actorId: userId },
        data: { actorId: null },
      });

      await tx.projectMember.deleteMany({
        where: { userId },
      });

      await tx.user.update({
        where: { id: userId },
        data: { watchedIssues: { set: [] } },
      });

      await tx.user.delete({
        where: { id: userId },
      });
    });

    revalidatePath("/admin");
    revalidatePath("/projects");
    revalidatePath("/");
    revalidatePath("/issues");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function resetUserPassword(userId: string) {
  try {
    await checkGlobalAdmin();

    if (!userId) {
      return { success: false, error: "User id is required." };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return { success: false, error: "User not found." };
    }

    const nextPassword = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(nextPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    revalidatePath("/admin");
    return { success: true, password: nextPassword };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createProject(data: any) {
  try {
    await checkGlobalAdmin();
    const name = typeof data?.name === "string" ? data.name.trim() : "";
    const key = typeof data?.key === "string" ? data.key.trim().toUpperCase() : "";
    const description = typeof data?.description === "string" ? data.description.trim() : "";
    const ownerId = typeof data?.ownerId === "string" ? data.ownerId : "";
    const rawMemberIds: string[] = Array.isArray(data?.memberIds)
      ? data.memberIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const memberIds = Array.from(new Set(rawMemberIds));

    if (!name || !key) {
      return { success: false, error: "Project name and key are required." };
    }
    if (!ownerId) {
      return { success: false, error: "Project owner is required." };
    }
    if (!memberIds.includes(ownerId)) {
      memberIds.push(ownerId);
    }

    const existing = await prisma.project.findUnique({ where: { key } });
    if (existing) {
      return { success: false, error: "Project Key already exists" };
    }

    const candidateUsers = await prisma.user.findMany({
      where: { id: { in: [ownerId, ...memberIds] } },
      select: { id: true, role: true },
    });
    if (candidateUsers.length !== new Set([ownerId, ...memberIds]).size) {
      return { success: false, error: "Some selected users do not exist." };
    }
    if (candidateUsers.some((u) => u.role === "ADMIN")) {
      return { success: false, error: "System admin cannot be project owner or project member." };
    }

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          name,
          key,
          description: description || null,
          ownerId,
        }
      });

      await tx.projectMember.createMany({
        data: memberIds.map((memberId) => ({
          userId: memberId,
          projectId: createdProject.id,
          role: memberId === ownerId ? "ADMIN" : "MEMBER",
        })),
      });

      await createDefaultWorkflowForProject(tx, createdProject.id);

      return createdProject;
    });

    revalidatePath("/admin");
    revalidatePath("/projects");
    return { success: true, project };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateProjectMembers(projectId: string, memberIds: string[]) {
  try {
    await checkGlobalAdmin();
    const uniqueMemberIds = Array.from(new Set(memberIds));
    if (uniqueMemberIds.length < 1) {
      return { success: false, error: "At least one project member is required." };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { owner: { select: { role: true } }, members: true },
    });
    if (!project) {
      return { success: false, error: "Project not found." };
    }

    const users = await prisma.user.findMany({
      where: { id: { in: uniqueMemberIds } },
      select: { id: true, role: true },
    });
    if (users.length !== uniqueMemberIds.length) {
      return { success: false, error: "Some selected users do not exist." };
    }
    if (users.some((u) => u.role === "ADMIN")) {
      return { success: false, error: "System admin cannot be project member." };
    }

    let ownerId = project.ownerId;
    const ownerIsSystemAdmin = project.owner?.role === "ADMIN";
    if (ownerIsSystemAdmin) {
      ownerId = uniqueMemberIds[0];
      await prisma.project.update({
        where: { id: projectId },
        data: { ownerId },
      });
    }

    if (!uniqueMemberIds.includes(ownerId)) {
      return { success: false, error: "Cannot remove current project owner. Assign a new owner first." };
    }

    // Get current members
    const currentMembers = await prisma.projectMember.findMany({
      where: { projectId },
    });
    const currentMemberIds = currentMembers.map(m => m.userId);

    // Remove members not in new list
    const toRemove = currentMemberIds.filter(id => !uniqueMemberIds.includes(id));
    for (const userId of toRemove) {
      await prisma.projectMember.delete({
        where: { userId_projectId: { userId, projectId } },
      });
    }

    // Add new members
    const toAdd = uniqueMemberIds.filter(id => !currentMemberIds.includes(id));
    for (const userId of toAdd) {
      await prisma.projectMember.create({
        data: { userId, projectId, role: "MEMBER" },
      });
    }

    // Keep owner and project admin in sync
    const ownerMembership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: ownerId, projectId } },
    });
    if (!ownerMembership) {
      await prisma.projectMember.create({
        data: { userId: ownerId, projectId, role: "ADMIN" },
      });
    } else if (ownerMembership.role !== "ADMIN") {
      await prisma.projectMember.update({
        where: { id: ownerMembership.id },
        data: { role: "ADMIN" },
      });
    }
    await prisma.projectMember.updateMany({
      where: { projectId, role: "ADMIN", userId: { not: ownerId } },
      data: { role: "MEMBER" },
    });

    revalidatePath("/admin");
    revalidatePath("/projects");
    revalidatePath("/");
    revalidatePath("/issues");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateProjectOwner(projectId: string, ownerId: string) {
  try {
    await checkGlobalAdmin();

    if (!projectId || !ownerId) {
      return { success: false, error: "Project id and owner id are required." };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { role: true } },
        members: true,
      },
    });
    if (!project) {
      return { success: false, error: "Project not found." };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, role: true },
    });
    if (!targetUser) {
      return { success: false, error: "Target owner not found." };
    }
    if (targetUser.role === "ADMIN") {
      return { success: false, error: "System admin cannot be project owner." };
    }

    const targetMembership = project.members.find((m) => m.userId === ownerId);
    if (!targetMembership) {
      return { success: false, error: "Project owner must be a project member." };
    }

    if (project.ownerId === ownerId && targetMembership.role === "ADMIN") {
      return { success: true };
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { ownerId },
      });

      await tx.projectMember.updateMany({
        where: { projectId, role: "ADMIN", userId: { not: ownerId } },
        data: { role: "MEMBER" },
      });

      await tx.projectMember.update({
        where: { userId_projectId: { userId: ownerId, projectId } },
        data: { role: "ADMIN" },
      });
    });

    revalidatePath("/admin");
    revalidatePath("/projects");
    revalidatePath("/");
    revalidatePath("/issues");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateMemberRole(projectId: string, userId: string, role: string) {
  try {
    await checkGlobalAdmin();

    if (role !== "ADMIN" && role !== "MEMBER") {
      return { success: false, error: "Invalid role. Must be ADMIN or MEMBER." };
    }

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!membership) {
      return { success: false, error: "User is not a member of this project." };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) {
      return { success: false, error: "User not found." };
    }
    if (user.role === "ADMIN") {
      return { success: false, error: "System admin cannot be project member." };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { owner: { select: { role: true } } },
    });
    if (!project) {
      return { success: false, error: "Project not found." };
    }

    let currentOwnerId = project.ownerId;
    if (project.owner?.role === "ADMIN") {
      currentOwnerId = userId;
      await prisma.project.update({
        where: { id: projectId },
        data: { ownerId: currentOwnerId },
      });
    }

    if (role === "ADMIN") {
      await prisma.$transaction(async (tx) => {
        // Keep one project admin and align ownerId to it.
        await tx.projectMember.updateMany({
          where: { projectId, role: "ADMIN", userId: { not: userId } },
          data: { role: "MEMBER" },
        });
        await tx.projectMember.update({
          where: { id: membership.id },
          data: { role: "ADMIN" },
        });
        await tx.project.update({
          where: { id: projectId },
          data: { ownerId: userId },
        });
      });
    } else {
      if (currentOwnerId === userId) {
        const replacementAdmin = await prisma.projectMember.findFirst({
          where: { projectId, userId: { not: userId }, role: "ADMIN" },
          orderBy: { id: "asc" },
        });
        if (!replacementAdmin) {
          return { success: false, error: "Cannot demote current project admin. Promote another member first." };
        }

        await prisma.$transaction(async (tx) => {
          await tx.projectMember.update({
            where: { id: membership.id },
            data: { role: "MEMBER" },
          });
          await tx.project.update({
            where: { id: projectId },
            data: { ownerId: replacementAdmin.userId },
          });
        });
      } else {
        await prisma.projectMember.update({
          where: { id: membership.id },
          data: { role: "MEMBER" },
        });
      }
    }

    revalidatePath("/admin");
    revalidatePath("/projects");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteProject(projectId: string) {
  try {
    await checkGlobalAdmin();

    if (!projectId) {
      return { success: false, error: "Project id is required." };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return { success: false, error: "Project not found." };
    }

    await prisma.$transaction(async (tx) => {
      // Cascade delete order to respect foreign keys
      const issues = await tx.issue.findMany({
        where: { projectId },
        select: { id: true },
      });
      const issueIds = issues.map((i) => i.id);

      if (issueIds.length > 0) {
        await tx.attachment.deleteMany({
          where: { issueId: { in: issueIds } },
        });

        await tx.comment.deleteMany({
          where: { issueId: { in: issueIds } },
        });

        await tx.issue.deleteMany({
          where: { projectId },
        });
      }

      await tx.iteration.deleteMany({
        where: { projectId },
      });

      await tx.projectMember.deleteMany({
        where: { projectId },
      });

      await tx.project.delete({
        where: { id: projectId },
      });
    });

    revalidatePath("/admin");
    revalidatePath("/projects");
    revalidatePath("/");
    revalidatePath("/issues");
    revalidatePath("/iterations");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete project:", error);
    return { success: false, error: error.message || "Failed to delete project" };
  }
}

