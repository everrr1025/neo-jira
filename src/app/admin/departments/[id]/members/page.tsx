import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import AdminDepartmentMembersClient from "@/components/AdminDepartmentMembersClient";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

export default async function AdminDepartmentMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getCurrentLocale();
  const session = await getServerSession(authOptions);
  const currentUser = session?.user as { role?: string } | undefined;

  if (!session || currentUser?.role !== "ADMIN") {
    redirect("/");
  }

  const { id } = await params;

  const [department, availableUsers] = await Promise.all([
    prisma.department.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: [{ isDepartmentAdmin: "desc" }, { user: { name: "asc" } }],
        },
      },
    }),
    prisma.user.findMany({
      where: {
        role: { not: "ADMIN" },
        departmentMembers: { none: {} },
      },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
  ]);

  if (!department) {
    notFound();
  }

  const safeDepartment = {
    id: department.id,
    name: department.name,
    key: department.key,
    description: department.description,
    members: department.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      isDepartmentAdmin: member.isDepartmentAdmin,
      userName: member.user.name,
      userEmail: member.user.email,
    })),
  };

  return (
    <div className="flex h-full flex-col">
      <AdminDepartmentMembersClient
        department={safeDepartment}
        availableUsers={availableUsers}
        locale={locale}
      />
    </div>
  );
}
