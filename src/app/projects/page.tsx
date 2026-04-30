import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/authOptions";
import { getUserDepartmentMembership } from "@/lib/departmentAccess";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as { id?: string; role?: string | null };
  const userId = sessionUser.id;
  const userRole = sessionUser.role ?? "USER";

  if (userRole === "ADMIN") {
    redirect("/admin/departments");
  }

  const membership = await getUserDepartmentMembership(userId);
  if (membership) {
    redirect(`/departments/${membership.departmentId}`);
  }

  redirect("/");
}
