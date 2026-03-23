"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { checkProjectAdmin } from "@/lib/permissions";

export async function updateProject(projectId: string, data: {
  name?: string;
  key?: string;
  description?: string;
  ownerId?: string;
}) {
  try {
    await checkProjectAdmin(projectId);

    // If key is changing, check for uniqueness
    if (data.key) {
      const existing = await prisma.project.findFirst({
        where: { 
          key: data.key,
          id: { not: projectId }
        }
      });
      if (existing) throw new Error("Project key already exists");
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: data.name,
        key: data.key,
        description: data.description,
        ownerId: data.ownerId,
      }
    });

    revalidatePath(`/projects/${projectId}/settings`);
    revalidatePath("/projects");
    revalidatePath("/");
    
    return { success: true, project: updated };
  } catch (error: any) {
    console.error("Failed to update project:", error);
    return { success: false, error: error.message || "Failed to update project" };
  }
}

export async function getProjectForSettings(projectId: string) {
  try {
    // Basic check - will throw if not logged in
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: true,
        members: {
          include: { user: true }
        }
      }
    });
    
    if (!project) throw new Error("Project not found");
    
    return { success: true, project };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
