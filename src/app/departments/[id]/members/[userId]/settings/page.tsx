import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import DepartmentMemberSettingsClient from "@/components/DepartmentMemberSettingsClient";
import { authOptions } from "@/lib/authOptions";
import { getDepartmentWorkspaceData } from "@/lib/departmentWorkspace";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

export default async function DepartmentMemberSettingsPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const { id: departmentId, userId: targetUserId } = await params;
  const locale = await getCurrentLocale();
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const currentUser = session.user as { id: string };
  const department = await getDepartmentWorkspaceData(departmentId, locale);
  if (!department) redirect("/");

  const currentMember = department.members.find((member) => member.userId === currentUser.id);
  if (!currentMember?.isDepartmentAdmin) redirect("/");

  const targetMember = department.members.find((member) => member.userId === targetUserId);
  if (!targetMember) notFound();

  return (
    <div className="flex h-full w-full flex-col space-y-6">
      <DepartmentMemberSettingsClient
        department={department}
        member={targetMember}
        locale={locale}
      />
    </div>
  );
}
