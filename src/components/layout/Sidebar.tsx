import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getActiveProjectContextForUser } from "@/lib/activeProject";
import { SidebarClient } from "./SidebarClient";
import { Locale } from "@/lib/i18n";
import { getUserDepartmentMembership } from "@/lib/departmentAccess";

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  avatar?: string | null;
};

export async function Sidebar({ locale }: { locale: Locale }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  const userId = user?.id as string | undefined;
  const userRole = user?.role as string | undefined;
  const isAdmin = userRole === "ADMIN";

  const dbUser = userId ? await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, avatar: true }
  }) : null;

  const departmentMembership = userId && !isAdmin ? await getUserDepartmentMembership(userId) : null;

  const { activeProject } = await getActiveProjectContextForUser(userId, userRole);

  return (
    <SidebarClient
      isAdmin={isAdmin}
      activeProject={activeProject}
      user={dbUser || user}
      locale={locale}
      departmentContext={
        departmentMembership
          ? { id: departmentMembership.departmentId, name: departmentMembership.departmentName, role: departmentMembership.role }
          : null
      }
    />
  );
}
