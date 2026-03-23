import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { ACTIVE_PROJECT_COOKIE } from "@/lib/activeProject";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const userId = (session.user as any).id as string;
  const userRole = (session.user as any).role as string;
  const projectId = request.nextUrl.searchParams.get("projectId");
  const from = request.nextUrl.searchParams.get("from");

  if (!projectId) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  const safeFrom = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
  let hasAccess = false;

  if (userRole === "ADMIN") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    hasAccess = !!project;
  } else {
    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { id: true },
    });
    hasAccess = !!membership;
  }

  const response = NextResponse.redirect(new URL(hasAccess ? safeFrom : "/projects", request.url));
  if (hasAccess) {
    response.cookies.set(ACTIVE_PROJECT_COOKIE, projectId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
  }

  return response;
}
