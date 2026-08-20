import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getUserDepartmentMembership } from "@/lib/departmentAccess";

type SessionCallbackUser = {
  id?: string;
  role?: string | null;
  departmentRole?: string | null;
  departmentId?: string | null;
  isDepartmentAdmin?: boolean | null;
  departmentPosition?: string | null;
};

async function getAuthUserDepartmentFields(userId: string) {
  const membership = await getUserDepartmentMembership(userId);
  return {
    departmentRole: membership?.role || null,
    departmentId: membership?.departmentId || null,
    isDepartmentAdmin: membership?.isDepartmentAdmin || false,
    departmentPosition: membership?.positionName || null,
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Neo-Jira Account",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@neo-jira.local" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });
        
        if (!user || !user.password) return null;
        
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordValid) return null;

        const membershipFields = await getAuthUserDepartmentFields(user.id);
        if (user.role !== "ADMIN" && !membershipFields.departmentId) {
          throw new Error("NO_DEPARTMENT");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          ...membershipFields,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as SessionCallbackUser;
        token.role = authUser.role;
        token.id = authUser.id;
        token.departmentRole = authUser.departmentRole;
        token.departmentId = authUser.departmentId;
        token.isDepartmentAdmin = authUser.isDepartmentAdmin;
        token.departmentPosition = authUser.departmentPosition;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        const sessionUser = session.user as SessionCallbackUser;
        sessionUser.role = typeof token.role === "string" ? token.role : null;
        sessionUser.id = typeof token.id === "string" ? token.id : undefined;
        sessionUser.departmentRole = typeof token.departmentRole === "string" ? token.departmentRole : null;
        sessionUser.departmentId = typeof token.departmentId === "string" ? token.departmentId : null;
        sessionUser.isDepartmentAdmin = typeof token.isDepartmentAdmin === "boolean" ? token.isDepartmentAdmin : null;
        sessionUser.departmentPosition = typeof token.departmentPosition === "string" ? token.departmentPosition : null;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // We'll create a custom login page
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development-neo-jira",
};
