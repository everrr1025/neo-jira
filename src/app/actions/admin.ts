"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    throw new Error("Unauthorized. Admin access required.");
  }
  return session;
}

export async function createUser(data: any) {
  try {
    await checkAdmin();
    // Validate email uniqueness
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
    const session = await checkAdmin();
    const existing = await prisma.project.findUnique({ where: { key: data.key } });
    if (existing) {
      return { success: false, error: "Project Key already exists" };
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        key: data.key,
        description: data.description,
        ownerId: (session.user as any).id,
        members: {
          connect: data.memberIds ? data.memberIds.map((id: string) => ({ id })) : []
        }
      }
    });
    revalidatePath("/admin");
    return { success: true, project };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateProjectMembers(projectId: string, memberIds: string[]) {
  try {
    await checkAdmin();
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        members: {
          set: memberIds.map((id) => ({ id }))
        }
      }
    });
    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/issues");
    return { success: true, project };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
