import { Prisma } from "@prisma/client";
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
  const rawDepartmentIds = params.departmentIds ?? params.departmentId;
  const departmentIds = Array.from(new Set(
    (Array.isArray(rawDepartmentIds) ? rawDepartmentIds : [rawDepartmentIds])
      .flatMap((value) => value?.split(",") || [])
      .map((value) => value.trim())
      .filter(Boolean),
  ));
  const pageSize = Math.min(parsePositiveInt(params.pageSize, 10), 50);
  const requestedPage = parsePositiveInt(params.page, 1);
  const requestedSortBy = Array.isArray(params.sortBy) ? params.sortBy[0] : params.sortBy;
  const sortBy = requestedSortBy === "name" || requestedSortBy === "email" || requestedSortBy === "department"
    ? requestedSortBy
    : "createdAt";
  const sortDirection = (Array.isArray(params.sortDirection) ? params.sortDirection[0] : params.sortDirection) === "asc"
    ? "asc"
    : "desc";

  const where = {
    role: "USER",
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
    ...(departmentIds.length > 0
      ? {
          departmentMembers: {
            some: { departmentId: { in: departmentIds } },
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

  const userInclude = {
    departmentMembers: {
      include: {
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { isDepartmentAdmin: "desc" as const },
    },
  };

  const users = sortBy === "department"
    ? await (async () => {
        const searchPattern = `%${search}%`;
        const orderedUsers = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT u."id"
          FROM "User" AS u
          LEFT JOIN "DepartmentMember" AS dm ON dm."userId" = u."id"
          LEFT JOIN "Department" AS d ON d."id" = dm."departmentId"
          WHERE u."role" = 'USER'
          ${search ? Prisma.sql`AND (u."name" LIKE ${searchPattern} OR u."email" LIKE ${searchPattern})` : Prisma.empty}
          ${departmentIds.length > 0
            ? Prisma.sql`AND dm."departmentId" IN (${Prisma.join(departmentIds)})`
            : Prisma.empty}
          GROUP BY u."id"
          ORDER BY
            CASE WHEN MIN(d."name") IS NULL THEN 1 ELSE 0 END ASC,
            MIN(d."name") ${Prisma.raw(sortDirection === "asc" ? "ASC" : "DESC")},
            u."id" ASC
          LIMIT ${pageSize}
          OFFSET ${(page - 1) * pageSize}
        `);
        const orderedIds = orderedUsers.map((user) => user.id);
        const selectedUsers = await prisma.user.findMany({
          where: { id: { in: orderedIds } },
          include: userInclude,
        });
        const usersById = new Map(selectedUsers.map((user) => [user.id, user]));
        return orderedIds.flatMap((id) => {
          const user = usersById.get(id);
          return user ? [user] : [];
        });
      })()
    : await prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: [{ [sortBy]: sortDirection }, { id: "asc" }],
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
    headDepartmentsCount: user.departmentMembers.filter((member) => member.isDepartmentAdmin).length,
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
        departmentIds={departmentIds}
        sortBy={sortBy}
        sortDirection={sortDirection}
        locale={locale}
      />
    </div>
  );
}
