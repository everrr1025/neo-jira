import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import AdminDepartmentsView from "@/components/AdminDepartmentsView";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

export default async function AdminDepartmentsPage() {
  const locale = await getCurrentLocale();
  const session = await getServerSession(authOptions);
  const currentUser = session?.user as { role?: string } | undefined;

  if (!session || currentUser?.role !== "ADMIN") {
    redirect("/");
  }

  const departments = await prisma.department.findMany({
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, disabledAt: true } } },
        orderBy: [{ isDepartmentAdmin: "desc" }, { user: { name: "asc" } }],
      },
      _count: { select: { projects: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const safeDepartments = departments.map((department) => ({
    id: department.id,
    name: department.name,
    key: department.key,
    description: department.description,
    members: department.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      isDepartmentAdmin: member.isDepartmentAdmin,
      userEmail: member.user.email,
      userName: member.user.name,
      disabledAt: member.user.disabledAt?.toISOString() ?? null,
    })),
    projectsCount: department._count.projects,
    createdAt: department.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col">
      <AdminDepartmentsView
        departments={safeDepartments}
        locale={locale}
      />
    </div>
  );
}
