import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { ACTIVE_PROJECT_COOKIE } from "@/lib/activeProject";

type SessionUser = {
  id?: string;
  role?: string | null;
};

function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: path,
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return redirectTo("/login");
  }

  const sessionUser = session.user as typeof session.user & SessionUser;
  const userId = sessionUser.id;
  const userRole = sessionUser.role;
  if (!userId) {
    return redirectTo("/login");
  }
  const projectId = request.nextUrl.searchParams.get("projectId");

  if (!projectId) {
    return redirectTo("/projects");
  }

  if (projectId === "clear") {
    const response = redirectTo("/");
    response.cookies.set(ACTIVE_PROJECT_COOKIE, "", {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 0,
    });
    return response;
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

  const response = redirectTo(hasAccess ? "/" : "/projects");
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
