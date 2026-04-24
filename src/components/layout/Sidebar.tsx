import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getActiveProjectContextForUser } from "@/lib/activeProject";
import { SidebarClient } from "./SidebarClient";
import { Locale } from "@/lib/i18n";

export async function Sidebar({ locale }: { locale: Locale }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const userId = user?.id as string | undefined;
  const userRole = user?.role as string | undefined;
  const isAdmin = userRole === "ADMIN";

  const dbUser = userId ? await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, avatar: true }
  }) : null;

  // Fetch department head/assistant info for non-admin users
  let headDepartment: { id: string; name: string } | null = null;
  if (userId && !isAdmin) {
    const deptMembership = await prisma.departmentMember.findFirst({
      where: { userId, role: { in: ["HEAD", "ASSISTANT"] } },
      include: { department: { select: { id: true, name: true } } },
    });
    if (deptMembership) {
      headDepartment = deptMembership.department;
    }
  }

  const { activeProject } = await getActiveProjectContextForUser(userId, userRole);
  const lockProjectScopedLinks = !activeProject;

  return (
    <SidebarClient
      isAdmin={isAdmin}
      activeProject={activeProject}
      lockProjectScopedLinks={lockProjectScopedLinks}
      user={dbUser || user}
      locale={locale}
      headDepartment={headDepartment}
    />
  );
}
