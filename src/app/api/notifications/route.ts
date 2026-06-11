import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { localizeSystemNotificationMessage } from "@/lib/departmentNotifications";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as SessionUser).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locale = await getCurrentLocale();
  const notifications = await prisma.notification.findMany({
    where: { userId },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(notifications.map((notification) => ({
    ...notification,
    message: localizeSystemNotificationMessage(notification.type, notification.message, locale),
  })), {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as SessionUser).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (body.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, userId, read: false },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  }

  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}
