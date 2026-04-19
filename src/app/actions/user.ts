"use server";

import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/authOptions";
import { isValidPassword } from "@/lib/validation";

type ChangePasswordError =
  | "UNAUTHORIZED"
  | "PASSWORD_NOT_SET"
  | "INVALID_CURRENT_PASSWORD"
  | "PASSWORD_POLICY_FAILED"
  | "PASSWORD_SAME_AS_CURRENT";

export async function updateUserAvatar(userId: string, avatarUrl: string) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    if (!sessionUserId || sessionUserId !== userId) {
      return { success: false, error: "UNAUTHORIZED" as const };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    });

    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Failed to update user avatar:", error);
    return { success: false, error: "Failed to update avatar" };
  }
}

export async function changeUserPassword(currentPassword: string, newPassword: string) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return { success: false, error: "UNAUTHORIZED" as ChangePasswordError };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user?.password) {
      return { success: false, error: "PASSWORD_NOT_SET" as ChangePasswordError };
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return { success: false, error: "INVALID_CURRENT_PASSWORD" as ChangePasswordError };
    }

    if (currentPassword === newPassword) {
      return { success: false, error: "PASSWORD_SAME_AS_CURRENT" as ChangePasswordError };
    }

    if (!isValidPassword(newPassword)) {
      return { success: false, error: "PASSWORD_POLICY_FAILED" as ChangePasswordError };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to change password:", error);
    return { success: false, error: "UNAUTHORIZED" as ChangePasswordError };
  }
}
