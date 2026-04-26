import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import AdminUsersClient from "@/components/AdminUsersClient";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

function parsePositiveInt(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getCurrentLocale();
  const session = await getServerSession(authOptions);
  const currentUser = session?.user as { id?: string; role?: string } | undefined;

  if (!session || currentUser?.role !== "ADMIN") {
    redirect("/");
  }

  const params = await searchParams;
  const search = (Array.isArray(params.search) ? params.search[0] : params.search)?.trim() || "";
  const departmentId = (Array.isArray(params.departmentId) ? params.departmentId[0] : params.departmentId) || "";
  const pageSize = Math.min(parsePositiveInt(params.pageSize, 10), 50);
  const requestedPage = parsePositiveInt(params.page, 1);

  const where = {
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
    ...(departmentId
      ? {
          departmentMembers: {
            some: { departmentId },
          },
        }
      : {}),
  };

  const [departments, totalUsers] = await Promise.all([
    prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const users = await prisma.user.findMany({
    where,
    include: {
      departmentMembers: {
        include: {
          department: {
            select: { id: true, name: true },
          },
        },
        orderBy: { role: "asc" },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const safeUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    departments: user.departmentMembers.map((member) => ({
      id: member.department.id,
      name: member.department.name,
    })),
    headDepartmentsCount: user.departmentMembers.filter((member) => member.role === "HEAD").length,
  }));

  return (
    <div className="flex h-full flex-col">
      <AdminUsersClient
        users={safeUsers}
        departments={departments}
        totalUsers={totalUsers}
        page={page}
        pageSize={pageSize}
        search={search}
        departmentId={departmentId}
        locale={locale}
        currentUserId={currentUser?.id || ""}
      />
    </div>
  );
}
