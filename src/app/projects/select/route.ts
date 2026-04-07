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

  if (!projectId) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

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

  const response = NextResponse.redirect(new URL(hasAccess ? "/" : "/projects", request.url));
  if (hasAccess) {
    response.cookies.set(ACTIVE_PROJECT_COOKIE, projectId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}
