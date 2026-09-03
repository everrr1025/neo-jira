import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import AdminUsersClient from "@/components/AdminUsersClient";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getInactiveCutoff } from "@/lib/systemUsage";
import { normalizeListDateFilter, resolveListDateFilterRange } from "@/lib/listDateFilter";

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
  const accountType = (Array.isArray(params.accountType) ? params.accountType[0] : params.accountType) === "admin" ? "admin" : "user";
  const accountRole = accountType === "admin" ? "ADMIN" : "USER";
  const requestedStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = requestedStatus === "active" || requestedStatus === "disabled" ? requestedStatus : "all";
  const search = (Array.isArray(params.search) ? params.search[0] : params.search)?.trim() || "";
  const rawDepartmentIds = params.departmentIds ?? params.departmentId;
  const departmentIds = accountType === "user" ? Array.from(new Set(
    (Array.isArray(rawDepartmentIds) ? rawDepartmentIds : [rawDepartmentIds])
      .flatMap((value) => value?.split(",") || [])
      .map((value) => value.trim())
      .filter(Boolean),
  )) : [];
  const pageSize = Math.min(parsePositiveInt(params.pageSize, 10), 50);
  const requestedPage = parsePositiveInt(params.page, 1);
  const requestedSortBy = Array.isArray(params.sortBy) ? params.sortBy[0] : params.sortBy;
  const sortBy = requestedSortBy === "name" || requestedSortBy === "email" || (accountType === "user" && requestedSortBy === "department")
    || requestedSortBy === "lastActiveAt"
    ? requestedSortBy
    : "createdAt";
  const sortDirection = (Array.isArray(params.sortDirection) ? params.sortDirection[0] : params.sortDirection) === "asc"
    ? "asc"
    : "desc";

  const requestedActivityStatus = Array.isArray(params.activityStatus) ? params.activityStatus[0] : params.activityStatus;
  const activityStatus = accountType === "user" && (requestedActivityStatus === "inactive30" || requestedActivityStatus === "inactive90" || requestedActivityStatus === "unknown")
    ? requestedActivityStatus
    : "all";
  const inactiveDays = activityStatus === "inactive90" ? 90 : 30;
  const inactiveCutoff = getInactiveCutoff(inactiveDays);
  const activityDateFilter = normalizeListDateFilter(Array.isArray(params.activityDateFilter) ? params.activityDateFilter[0] : params.activityDateFilter);
  const activityDate = (Array.isArray(params.activityDate) ? params.activityDate[0] : params.activityDate) || "";
  const createdDateFilter = normalizeListDateFilter(Array.isArray(params.createdDateFilter) ? params.createdDateFilter[0] : params.createdDateFilter);
  const createdDate = (Array.isArray(params.createdDate) ? params.createdDate[0] : params.createdDate) || "";
  const activityDateRange = resolveListDateFilterRange(activityDateFilter, activityDate);
  const createdDateRange = resolveListDateFilterRange(createdDateFilter, createdDate);
  const activityDateField = accountType === "admin" ? "lastLoginAt" : "lastActiveAt";

  const activityWhere: Prisma.UserWhereInput | null = activityStatus === "inactive30" || activityStatus === "inactive90"
    ? {
        OR: [
          { lastActiveAt: { lt: inactiveCutoff } },
          { lastActiveAt: null, activityTrackingStartedAt: { lt: inactiveCutoff } },
        ],
      }
    : activityStatus === "unknown"
      ? { lastActiveAt: null, activityTrackingStartedAt: { gte: getInactiveCutoff(30) } }
      : null;

  const where: Prisma.UserWhereInput = {
    role: accountRole,
    ...(status === "active" ? { disabledAt: null } : status === "disabled" ? { disabledAt: { not: null } } : {}),
    AND: [
      ...(search ? [{ OR: [{ name: { contains: search } }, { email: { contains: search } }] }] : []),
      ...(activityWhere ? [activityWhere] : []),
      ...(activityDateRange ? [{ [activityDateField]: activityDateRange }] : []),
      ...(createdDateRange ? [{ createdAt: createdDateRange }] : []),
    ],
    ...(accountType === "user" && departmentIds.length > 0
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
          ${status === "active" ? Prisma.sql`AND u."disabledAt" IS NULL` : status === "disabled" ? Prisma.sql`AND u."disabledAt" IS NOT NULL` : Prisma.empty}
          ${search ? Prisma.sql`AND (u."name" LIKE ${searchPattern} OR u."email" LIKE ${searchPattern})` : Prisma.empty}
          ${departmentIds.length > 0
            ? Prisma.sql`AND dm."departmentId" IN (${Prisma.join(departmentIds)})`
            : Prisma.empty}
          ${activityStatus === "inactive30" || activityStatus === "inactive90"
            ? Prisma.sql`AND ((u."lastActiveAt" IS NOT NULL AND u."lastActiveAt" < ${inactiveCutoff}) OR (u."lastActiveAt" IS NULL AND u."activityTrackingStartedAt" < ${inactiveCutoff}))`
            : activityStatus === "unknown"
              ? Prisma.sql`AND u."lastActiveAt" IS NULL AND u."activityTrackingStartedAt" >= ${getInactiveCutoff(30)}`
              : Prisma.empty}
          ${activityDateRange?.gte ? Prisma.sql`AND ${Prisma.raw(`u."${activityDateField}"`)} >= ${activityDateRange.gte}` : Prisma.empty}
          ${activityDateRange?.lt ? Prisma.sql`AND ${Prisma.raw(`u."${activityDateField}"`)} < ${activityDateRange.lt}` : Prisma.empty}
          ${createdDateRange?.gte ? Prisma.sql`AND u."createdAt" >= ${createdDateRange.gte}` : Prisma.empty}
          ${createdDateRange?.lt ? Prisma.sql`AND u."createdAt" < ${createdDateRange.lt}` : Prisma.empty}
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
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    disabledAt: user.disabledAt?.toISOString() ?? null,
    departments: user.departmentMembers.map((member) => ({
      id: member.department.id,
      name: member.department.name,
    })),
    headDepartmentsCount: user.departmentMembers.filter((member) => member.isDepartmentAdmin).length,
  }));

  return (
    <div className="flex flex-col">
      <AdminUsersClient
        currentUserId={currentUser.id || ""}
        users={safeUsers}
        departments={departments}
        totalUsers={totalUsers}
        page={page}
        pageSize={pageSize}
        search={search}
        departmentIds={departmentIds}
        sortBy={sortBy}
        sortDirection={sortDirection}
        activityStatus={activityStatus}
        accountType={accountType}
        status={status}
        activityDateFilter={activityDateFilter}
        activityDate={activityDate}
        createdDateFilter={createdDateFilter}
        createdDate={createdDate}
        locale={locale}
      />
    </div>
  );
}
