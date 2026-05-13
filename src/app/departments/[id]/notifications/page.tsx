import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import DepartmentNotificationsClient from "@/components/DepartmentNotificationsClient";
import { authOptions } from "@/lib/authOptions";
import {
  getDepartmentNotificationPermission,
  getDepartmentNotificationsPage,
} from "@/lib/departmentNotifications";
import { getCurrentLocale } from "@/lib/serverLocale";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

function resolveCreatedDateFilter(createdFilter: string, createdDate: string, from: string, to: string) {
  if (createdFilter && createdFilter !== "ALL" && createdDate) {
    if (createdFilter === "EQ") {
      return { from: parseDate(createdDate), to: parseDate(createdDate, true) };
    }

    if (createdFilter === "GTE") {
      return { from: parseDate(createdDate), to: undefined };
    }

    if (createdFilter === "LTE") {
      return { from: undefined, to: parseDate(createdDate, true) };
    }
  }

  return { from: parseDate(from), to: parseDate(to, true) };
}

export default async function DepartmentNotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: departmentId } = await params;
  const locale = await getCurrentLocale();
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const currentUser = session.user as { id?: string; role?: string | null };
  const userId = currentUser.id;
  const userRole = currentUser.role;
  if (!userId) redirect("/login");

  const membership = await prisma.departmentMember.findUnique({
    where: { departmentId_userId: { departmentId, userId } },
    select: { id: true },
  });
  if (!membership && userRole !== "ADMIN") redirect("/");

  const rawParams = await searchParams;
  const filters = {
    view: getString(rawParams.view) || "received",
    category: getString(rawParams.category) || "",
    projectId: getString(rawParams.projectId) || "",
    read: getString(rawParams.read) || "",
    publishStatus: getString(rawParams.publishStatus) || "",
    search: getString(rawParams.search) || "",
    sort: getString(rawParams.sort) || "createdAt",
    direction: getString(rawParams.direction) || "desc",
    createdFilter: getString(rawParams.createdFilter) || "ALL",
    createdDate: getString(rawParams.createdDate) || "",
    from: getString(rawParams.from) || "",
    to: getString(rawParams.to) || "",
  };
  const page = parsePositiveInt(getString(rawParams.page), 1);
  const pageSize = Math.min(parsePositiveInt(getString(rawParams.pageSize), 10), 50);
  const createdDateFilter = resolveCreatedDateFilter(
    filters.createdFilter,
    filters.createdDate,
    filters.from,
    filters.to,
  );

  const [result, projectOptions] = await Promise.all([
    getDepartmentNotificationsPage({
      departmentId,
      userId,
      userRole,
      locale,
      filters: {
        view: filters.view || undefined,
        category: filters.category || undefined,
        projectId: filters.projectId || undefined,
        read: filters.read || undefined,
        publishStatus: filters.publishStatus || undefined,
        search: filters.search || undefined,
        sort: filters.sort || undefined,
        direction: filters.direction || undefined,
        from: createdDateFilter.from,
        to: createdDateFilter.to,
        page,
        pageSize,
      },
    }),
    prisma.project.findMany({
      where: { departmentId },
      select: { id: true, name: true, key: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const permission = await getDepartmentNotificationPermission(departmentId, { userId, userRole });

  return (
    <DepartmentNotificationsClient
      departmentId={departmentId}
      locale={locale}
      notifications={result.notifications}
      permission={permission}
      projectOptions={projectOptions}
      filters={filters}
      pagination={{
        page,
        pageSize,
        total: result.total,
      }}
    />
  );
}
