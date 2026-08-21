import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import AdminLogsClient from "@/components/AdminLogsClient";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getCurrentLocale } from "@/lib/serverLocale";
import { getInactiveCutoff } from "@/lib/systemUsage";

export const dynamic = "force-dynamic";

const ENTITY_TYPES = ["USER", "DEPARTMENT", "PROJECT"];
const ACTION_TYPES = ["CREATE", "UPDATE", "DELETE"];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function selectedValues(value: string | string[] | undefined, allowed?: string[]) {
  const values = Array.from(new Set(
    (Array.isArray(value) ? value : [value])
      .flatMap((item) => item?.split(",") || [])
      .map((item) => item.trim())
      .filter(Boolean),
  ));
  return allowed ? values.filter((item) => allowed.includes(item)) : values;
}

function parseMetadata(value: string | null) {
  if (!value) return {} as Record<string, string>;
  try { return JSON.parse(value) as Record<string, string>; } catch { return {} as Record<string, string>; }
}

export default async function AdminLogsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const currentUser = session?.user as { role?: string } | undefined;
  if (!session || currentUser?.role !== "ADMIN") redirect("/");

  const locale = await getCurrentLocale();
  const params = await searchParams;
  const requestedRange = first(params.range);
  const range = requestedRange === "7" || requestedRange === "90" || requestedRange === "all" ? requestedRange : "30";
  const entityTypes = selectedValues(params.entityType, ENTITY_TYPES);
  const actions = selectedValues(params.action, ACTION_TYPES);
  const actorIds = selectedValues(params.actorId);
  const requestedPage = Math.max(1, Number(first(params.page)) || 1);
  const requestedPageSize = Number(first(params.pageSize));
  const pageSize = [10, 20, 50].includes(requestedPageSize) ? requestedPageSize : 20;

  const where: Prisma.AuditLogWhereInput = {
    entityType: { in: entityTypes.length > 0 ? entityTypes : ENTITY_TYPES },
    ...(actions.length > 0 ? { action: { in: actions } } : {}),
    ...(actorIds.length > 0 ? { actorId: { in: actorIds } } : {}),
    ...(range !== "all" ? { createdAt: { gte: getInactiveCutoff(Number(range)) } } : {}),
  };

  const [total, actors] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.user.findMany({
      where: { auditLogs: { some: { entityType: { in: ENTITY_TYPES } } } },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true, entityId: true, entityType: true, action: true, field: true, metadata: true, createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  const departments = await prisma.department.findMany({
    where: {
      id: {
        in: logs.filter((log) => log.entityType === "DEPARTMENT").map((log) => log.entityId),
      },
    },
    select: { id: true, name: true, key: true },
  });
  const departmentsById = new Map(departments.map((department) => [department.id, department]));

  return <AdminLogsClient
    locale={locale}
    logs={logs.map((log) => {
      const metadata = parseMetadata(log.metadata);
      const department = log.entityType === "DEPARTMENT" ? departmentsById.get(log.entityId) : undefined;
      const departmentName = metadata.name || department?.name;
      const departmentKey = metadata.key || department?.key;
      const targetName = log.entityType === "DEPARTMENT" && (departmentName || departmentKey)
        ? [departmentName, departmentKey ? `(${departmentKey})` : null].filter(Boolean).join(" ")
        : metadata.name || metadata.email || metadata.key || metadata.userId || log.entityId;
      return {
        id: log.id,
        entityType: log.entityType,
        action: log.action,
        field: log.field,
        targetName,
        actorName: log.actor?.name || log.actor?.email || "System",
        createdAt: log.createdAt.toISOString(),
      };
    })}
    actors={actors.map((actor) => ({ id: actor.id, name: actor.name || actor.email }))}
    filters={{ range, entityTypes, actions, actorIds }}
    page={page}
    pageSize={pageSize}
    totalPages={totalPages}
    total={total}
  />;
}
