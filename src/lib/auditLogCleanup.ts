import { Prisma, PrismaClient } from "@prisma/client";

export const AUDIT_LOG_RETENTION_DAYS = 2;
export const AUDIT_LOG_CLEANUP_BATCH_SIZE = 500;
export const AUDIT_LOG_CLEANUP_CONFIRMATION = "DELETE";
export const GOVERNANCE_AUDIT_ENTITY_TYPES = ["USER", "DEPARTMENT", "PROJECT"] as const;

export type GovernanceAuditEntityType = typeof GOVERNANCE_AUDIT_ENTITY_TYPES[number];
export type AuditLogCleanupScope =
  | { type: "expired-governance" }
  | { type: "deleted-target"; entityType: GovernanceAuditEntityType; entityId: string };

type AuditCleanupDb = Pick<PrismaClient, "auditLog" | "user" | "department" | "project">;

export function getAuditLogCleanupCutoff(
  now = new Date(),
  retentionDays = AUDIT_LOG_RETENTION_DAYS,
) {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export function parseAuditLogCleanupScope(input: unknown): AuditLogCleanupScope | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (value.type === "expired-governance") return { type: "expired-governance" };
  if (
    value.type === "deleted-target"
    && typeof value.entityType === "string"
    && GOVERNANCE_AUDIT_ENTITY_TYPES.includes(value.entityType as GovernanceAuditEntityType)
    && typeof value.entityId === "string"
    && value.entityId.trim().length > 0
    && value.entityId.length <= 200
  ) {
    return {
      type: "deleted-target",
      entityType: value.entityType as GovernanceAuditEntityType,
      entityId: value.entityId.trim(),
    };
  }
  return null;
}

export function buildAuditLogCleanupWhere(
  scope: AuditLogCleanupScope,
  cutoff: Date,
): Prisma.AuditLogWhereInput {
  return scope.type === "expired-governance"
    ? {
        entityType: { in: [...GOVERNANCE_AUDIT_ENTITY_TYPES] },
        createdAt: { lt: cutoff },
      }
    : {
        entityType: scope.entityType,
        entityId: scope.entityId,
        createdAt: { lt: cutoff },
      };
}

export async function auditLogCleanupTargetExists(
  db: AuditCleanupDb,
  scope: Extract<AuditLogCleanupScope, { type: "deleted-target" }>,
) {
  if (scope.entityType === "USER") {
    return Boolean(await db.user.findUnique({ where: { id: scope.entityId }, select: { id: true } }));
  }
  if (scope.entityType === "DEPARTMENT") {
    return Boolean(await db.department.findUnique({ where: { id: scope.entityId }, select: { id: true } }));
  }
  return Boolean(await db.project.findUnique({ where: { id: scope.entityId }, select: { id: true } }));
}

export async function getAuditLogCleanupPreview(
  db: AuditCleanupDb,
  scope: AuditLogCleanupScope,
  now = new Date(),
) {
  const cutoff = getAuditLogCleanupCutoff(now);
  const targetExists = scope.type === "deleted-target"
    ? await auditLogCleanupTargetExists(db, scope)
    : false;
  const where = buildAuditLogCleanupWhere(scope, cutoff);
  const [count, oldest, newest] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findFirst({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { createdAt: true } }),
    db.auditLog.findFirst({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { createdAt: true } }),
  ]);

  return {
    retentionDays: AUDIT_LOG_RETENTION_DAYS,
    cutoff,
    count,
    oldestLogAt: oldest?.createdAt ?? null,
    newestExpiredLogAt: newest?.createdAt ?? null,
    eligible: !targetExists,
    targetExists,
  };
}

export async function deleteExpiredAuditLogs(
  db: AuditCleanupDb,
  scope: AuditLogCleanupScope,
  now = new Date(),
  batchSize = AUDIT_LOG_CLEANUP_BATCH_SIZE,
) {
  if (scope.type === "deleted-target" && await auditLogCleanupTargetExists(db, scope)) {
    throw new Error("AUDIT_LOG_TARGET_STILL_EXISTS");
  }

  const cutoff = getAuditLogCleanupCutoff(now);
  const where = buildAuditLogCleanupWhere(scope, cutoff);
  let deletedCount = 0;

  while (true) {
    const batch = await db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: batchSize,
      select: { id: true },
    });
    if (batch.length === 0) break;

    const result = await db.auditLog.deleteMany({
      where: {
        ...where,
        id: { in: batch.map((log) => log.id) },
      },
    });
    deletedCount += result.count;
    if (result.count === 0) throw new Error("AUDIT_LOG_CLEANUP_STALLED");
  }

  return { deletedCount, cutoff };
}
