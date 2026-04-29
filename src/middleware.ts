import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

type TokenWithDepartment = {
  role?: string | null;
  departmentId?: string | null;
};

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token as TokenWithDepartment | null;
    const isGlobalAdmin = token?.role === "ADMIN";
    const hasDepartment = typeof token?.departmentId === "string" && token.departmentId.length > 0;

    if (!isGlobalAdmin && !hasDepartment) {
      return NextResponse.redirect(new URL("/login?error=no-department", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - login (login page)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
