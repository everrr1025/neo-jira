import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";

import DepartmentManageClient from "@/components/DepartmentManageClient";
import { getDepartmentWorkspaceData } from "@/lib/departmentWorkspace";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

export default async function DepartmentProjectsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: departmentId } = await params;
  const locale = await getCurrentLocale();
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const currentUser = session.user as { id: string; role?: string | null };
  const userId = currentUser.id;
  const userRole = currentUser.role;
  const isGlobalAdmin = userRole === "ADMIN";

  const department = await getDepartmentWorkspaceData(departmentId, locale);
  if (!department) redirect("/");

  const myMembership = department.members.find((member) => member.userId === userId);
  const isHead = myMembership?.role === "HEAD";
  const isAssistant = myMembership?.role === "ASSISTANT";

  if (!isGlobalAdmin && !isHead && !isAssistant) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col space-y-6">
      <DepartmentManageClient
        department={department}
        locale={locale}
        currentUserId={userId}
        isHead={isHead}
        mode="projects"
      />
    </div>
  );
}
