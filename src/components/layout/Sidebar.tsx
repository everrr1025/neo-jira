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

  // Fetch full user data including avatar from DB if user is logged in
  const dbUser = userId ? await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, avatar: true }
  }) : null;

  const { activeProject } = await getActiveProjectContextForUser(userId, userRole);
  const lockProjectScopedLinks = !activeProject;

  return (
    <SidebarClient 
      isAdmin={isAdmin}
      activeProject={activeProject}
      lockProjectScopedLinks={lockProjectScopedLinks}
      user={dbUser || user}
      locale={locale}
    />
  );
}
