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
type TargetType = "USER" | "DEPARTMENT" | "PROJECT";

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

async function resolveTarget(type: TargetType, id: string) {
  if (type === "USER") {
    const user = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
    if (user) return { type, id, name: user.name || user.email, key: user.email };
  }
  if (type === "DEPARTMENT") {
    const department = await prisma.department.findUnique({ where: { id }, select: { name: true, key: true } });
    if (department) return { type, id, name: department.name, key: department.key };
  }
  if (type === "PROJECT") {
    const project = await prisma.project.findUnique({ where: { id }, select: { name: true, key: true } });
    if (project) return { type, id, name: project.name, key: project.key };
  }

  const latestLog = await prisma.auditLog.findFirst({
    where: { entityType: type, entityId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { targetNameSnapshot: true, targetKeySnapshot: true, metadata: true },
  });
  const metadata = parseMetadata(latestLog?.metadata || null);
  return {
    type,
    id,
    name: latestLog?.targetNameSnapshot || metadata.name || metadata.email || metadata.key || id,
    key: latestLog?.targetKeySnapshot || metadata.key || metadata.email || null,
  };
}

export default async function AdminLogsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const currentUser = session?.user as { id?: string; role?: string } | undefined;
  if (!session || currentUser?.role !== "ADMIN" || !currentUser.id) redirect("/");

  const locale = await getCurrentLocale();
  const params = await searchParams;
  const requestedRange = first(params.range);
  const range = requestedRange === "7" || requestedRange === "30" || requestedRange === "90" ? requestedRange : "all";
  const entityTypes = selectedValues(params.entityType, ENTITY_TYPES);
  const actions = selectedValues(params.action, ACTION_TYPES);
  const actorIds = selectedValues(params.actorId);
  const requestedTargetType = first(params.targetType);
  const targetType = ENTITY_TYPES.includes(requestedTargetType || "") ? requestedTargetType as TargetType : null;
  const targetId = targetType ? (first(params.targetId) || "").trim() : "";
  const hasTargetFilter = Boolean(targetType && targetId);
  const requestedPage = Math.max(1, Number(first(params.page)) || 1);
  const requestedPageSize = Number(first(params.pageSize));
  const pageSize = [10, 20, 50].includes(requestedPageSize) ? requestedPageSize : 20;

  const where: Prisma.AuditLogWhereInput = {
    ...(hasTargetFilter
      ? { entityType: targetType!, entityId: targetId }
      : { entityType: { in: entityTypes.length > 0 ? entityTypes : ENTITY_TYPES } }),
    ...(actions.length > 0 ? { action: { in: actions } } : {}),
    ...(actorIds.length > 0 ? { actorId: { in: actorIds } } : {}),
    ...(range !== "all" ? { createdAt: { gte: getInactiveCutoff(Number(range)) } } : {}),
  };

  const [total, actors, target] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.user.findMany({
      where: { auditLogs: { some: { entityType: { in: ENTITY_TYPES } } } },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
    hasTargetFilter ? resolveTarget(targetType!, targetId) : Promise.resolve(null),
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
      actorNameSnapshot: true, actorEmailSnapshot: true, targetNameSnapshot: true, targetKeySnapshot: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  return <AdminLogsClient
    currentUserId={currentUser.id}
    locale={locale}
    logs={logs.map((log) => {
      const metadata = parseMetadata(log.metadata);
      const targetName = log.targetNameSnapshot || metadata.name || metadata.email || metadata.key || log.entityId;
      return {
        id: log.id,
        entityId: log.entityId,
        entityType: log.entityType,
        action: log.action,
        field: log.field,
        targetName,
        targetKey: log.targetKeySnapshot || metadata.email || metadata.key || null,
        actorName: log.actor?.name || log.actor?.email || log.actorNameSnapshot || log.actorEmailSnapshot || "System",
        createdAt: log.createdAt.toISOString(),
      };
    })}
    actors={actors.map((actor) => ({ id: actor.id, name: actor.name || actor.email }))}
    filters={{ range, entityTypes, actions, actorIds, target }}
    page={page}
    pageSize={pageSize}
    totalPages={totalPages}
    total={total}
  />;
}
