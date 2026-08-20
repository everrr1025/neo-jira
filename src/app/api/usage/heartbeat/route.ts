import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getShanghaiDateKey } from "@/lib/systemUsage";

export async function POST() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;

  if (!sessionUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (sessionUser.role !== "USER") {
    return NextResponse.json({ recorded: false });
  }

  const now = new Date();
  const activityDate = getShanghaiDateKey(now);
  const membership = await prisma.departmentMember.findFirst({
    where: { userId: sessionUser.id },
    select: { departmentId: true },
  });

  await prisma.$transaction([
    prisma.userDailyActivity.upsert({
      where: {
        userId_activityDate: {
          userId: sessionUser.id,
          activityDate,
        },
      },
      update: { lastSeenAt: now },
      create: {
        userId: sessionUser.id,
        activityDate,
        departmentIdSnapshot: membership?.departmentId ?? null,
        firstSeenAt: now,
        lastSeenAt: now,
      },
    }),
    prisma.user.update({
      where: { id: sessionUser.id },
      data: { lastActiveAt: now },
    }),
  ]);

  return NextResponse.json({ recorded: true, activityDate });
}
