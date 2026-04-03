import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getActiveProjectIdForUser, getVisibleProjectsForUser } from "@/lib/activeProject";
import { SidebarClient } from "./SidebarClient";

export async function Sidebar() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const userId = (user as any)?.id as string | undefined;
  const userRole = (user as any)?.role as string | undefined;
  const isAdmin = userRole === "ADMIN";

  const projects = await getVisibleProjectsForUser(userId, userRole);
  const activeProjectId = await getActiveProjectIdForUser(userId, userRole);
  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const lockProjectScopedLinks = !isAdmin && !activeProject;

  return (
    <SidebarClient 
      isAdmin={isAdmin}
      activeProject={activeProject}
      lockProjectScopedLinks={lockProjectScopedLinks}
      user={user}
    />
  );
}
