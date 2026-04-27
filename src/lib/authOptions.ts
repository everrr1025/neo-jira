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
};

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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        const sessionUser = session.user as SessionCallbackUser;
        sessionUser.role = typeof token.role === "string" ? token.role : null;
        sessionUser.id = typeof token.id === "string" ? token.id : undefined;
        const membership = await getUserDepartmentMembership(typeof token.id === "string" ? token.id : null);
        sessionUser.departmentRole = membership?.role || null;
        sessionUser.departmentId = membership?.departmentId || null;
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
