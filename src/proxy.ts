import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

import {
  ACTIVE_PROJECT_COOKIE,
  getLegacyProjectDestination,
  parseProjectPath,
  PROJECT_ROUTE_DEPARTMENT_HEADER,
  PROJECT_ROUTE_PROJECT_HEADER,
} from "@/lib/projectRoutes";

type TokenWithDepartment = {
  role?: string | null;
  departmentId?: string | null;
};

export default withAuth(
  function proxy(request) {
    const token = request.nextauth.token as TokenWithDepartment | null;
    const isGlobalAdmin = token?.role === "ADMIN";
    const hasDepartment = typeof token?.departmentId === "string" && token.departmentId.length > 0;

    if (!isGlobalAdmin && !hasDepartment) {
      return NextResponse.redirect(new URL("/login?error=no-department", request.url));
    }

    const route = parseProjectPath(request.nextUrl.pathname);
    const destination = getLegacyProjectDestination(request.nextUrl.pathname);
    if (!route || !destination) return NextResponse.next();

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(PROJECT_ROUTE_DEPARTMENT_HEADER, route.departmentId);
    requestHeaders.set(PROJECT_ROUTE_PROJECT_HEADER, route.projectId);

    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = destination;

    const response = NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    });
    response.cookies.set(ACTIVE_PROJECT_COOKIE, route.projectId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  },
);

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};

