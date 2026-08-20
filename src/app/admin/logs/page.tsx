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
  const requestedEntity = first(params.entityType);
  const entityType = requestedEntity && ENTITY_TYPES.includes(requestedEntity) ? requestedEntity : "all";
  const requestedAction = first(params.action);
  const action = requestedAction && ACTION_TYPES.includes(requestedAction) ? requestedAction : "all";
  const actorId = first(params.actorId) || "all";
  const page = Math.max(1, Number(first(params.page)) || 1);
  const pageSize = 20;

  const where = {
    entityType: entityType === "all" ? { in: ENTITY_TYPES } : entityType,
    ...(action !== "all" ? { action } : {}),
    ...(actorId !== "all" ? { actorId } : {}),
    ...(range !== "all" ? { createdAt: { gte: getInactiveCutoff(Number(range)) } } : {}),
  };

  const [total, logs, actors] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, entityId: true, entityType: true, action: true, field: true, metadata: true, createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { auditLogs: { some: { entityType: { in: ENTITY_TYPES } } } },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <AdminLogsClient
    locale={locale}
    logs={logs.map((log) => {
      const metadata = parseMetadata(log.metadata);
      return {
        id: log.id,
        entityType: log.entityType,
        action: log.action,
        field: log.field,
        targetName: metadata.name || metadata.email || metadata.key || metadata.userId || log.entityId,
        actorName: log.actor?.name || log.actor?.email || "System",
        createdAt: log.createdAt.toISOString(),
      };
    })}
    actors={actors.map((actor) => ({ id: actor.id, name: actor.name || actor.email }))}
    filters={{ range, entityType, action, actorId }}
    page={Math.min(page, totalPages)}
    totalPages={totalPages}
    total={total}
  />;
}
