"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateUserAvatar(userId: string, avatarUrl: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    });
    
    revalidatePath("/projects");
    revalidatePath("/");
    
    return { success: true };
  } catch (error) {
    console.error("Failed to update user avatar:", error);
    return { success: false, error: "Failed to update avatar" };
  }
}
