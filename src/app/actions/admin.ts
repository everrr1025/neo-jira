"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { checkGlobalAdmin } from "@/lib/permissions";

export async function createUser(data: any) {
  try {
    await checkGlobalAdmin();
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return { success: false, error: "Email is already in use" };
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
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

export async function createProject(data: any) {
  try {
    const session = await checkGlobalAdmin();
    const existing = await prisma.project.findUnique({ where: { key: data.key } });
    if (existing) {
      return { success: false, error: "Project Key already exists" };
    }

    const userId = (session.user as any).id;
    const project = await prisma.project.create({
      data: {
        name: data.name,
        key: data.key,
        description: data.description,
        ownerId: userId,
      }
    });

    // Create ProjectMember for owner as ADMIN
    await prisma.projectMember.create({
      data: { userId, projectId: project.id, role: "ADMIN" },
    });

    // Add additional members
    if (data.memberIds && data.memberIds.length > 0) {
      for (const memberId of data.memberIds) {
        if (memberId !== userId) {
          await prisma.projectMember.create({
            data: { userId: memberId, projectId: project.id, role: "MEMBER" },
          });
        }
      }
    }

    revalidatePath("/admin");
    return { success: true, project };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateProjectMembers(projectId: string, memberIds: string[]) {
  try {
    await checkGlobalAdmin();

    // Get current members
    const currentMembers = await prisma.projectMember.findMany({
      where: { projectId },
    });
    const currentMemberIds = currentMembers.map(m => m.userId);

    // Remove members not in new list
    const toRemove = currentMemberIds.filter(id => !memberIds.includes(id));
    for (const userId of toRemove) {
      await prisma.projectMember.delete({
        where: { userId_projectId: { userId, projectId } },
      });
    }

    // Add new members
    const toAdd = memberIds.filter(id => !currentMemberIds.includes(id));
    for (const userId of toAdd) {
      await prisma.projectMember.create({
        data: { userId, projectId, role: "MEMBER" },
      });
    }

    revalidatePath("/admin");
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

    await prisma.projectMember.update({
      where: { id: membership.id },
      data: { role },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
