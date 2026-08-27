import assert from "node:assert/strict";

import {
  buildAuditLogCleanupWhere,
  deleteExpiredAuditLogs,
  getAuditLogCleanupCutoff,
  parseAuditLogCleanupScope,
} from "./auditLogCleanup";

const now = new Date("2026-08-27T12:00:00.000Z");
const cutoff = getAuditLogCleanupCutoff(now);
assert.equal(cutoff.toISOString(), "2026-08-25T12:00:00.000Z");

assert.deepEqual(parseAuditLogCleanupScope({ type: "expired-governance" }), { type: "expired-governance" });
assert.deepEqual(
  parseAuditLogCleanupScope({ type: "deleted-target", entityType: "DEPARTMENT", entityId: " department-1 " }),
  { type: "deleted-target", entityType: "DEPARTMENT", entityId: "department-1" },
);
assert.equal(parseAuditLogCleanupScope({ type: "deleted-target", entityType: "ISSUE", entityId: "issue-1" }), null);
assert.equal(parseAuditLogCleanupScope({ type: "deleted-target", entityType: "USER", entityId: "" }), null);

assert.deepEqual(buildAuditLogCleanupWhere({ type: "expired-governance" }, cutoff), {
  entityType: { in: ["USER", "DEPARTMENT", "PROJECT"] },
  createdAt: { lt: cutoff },
});
assert.deepEqual(buildAuditLogCleanupWhere({
  type: "deleted-target",
  entityType: "DEPARTMENT",
  entityId: "department-1",
}, cutoff), {
  entityType: "DEPARTMENT",
  entityId: "department-1",
  createdAt: { lt: cutoff },
});

type FakeLog = { id: string; entityType: string; entityId: string; createdAt: Date };

function matchesWhere(log: FakeLog, where: Record<string, unknown>) {
  const entityType = where.entityType as string | { in: string[] } | undefined;
  const createdAt = where.createdAt as { lt: Date } | undefined;
  const id = where.id as { in: string[] } | undefined;
  if (typeof entityType === "string" && log.entityType !== entityType) return false;
  if (entityType && typeof entityType === "object" && !entityType.in.includes(log.entityType)) return false;
  if (typeof where.entityId === "string" && log.entityId !== where.entityId) return false;
  if (createdAt && !(log.createdAt < createdAt.lt)) return false;
  if (id && !id.in.includes(log.id)) return false;
  return true;
}

async function runCleanupChecks() {
  const logs: FakeLog[] = [
    { id: "old-user", entityType: "USER", entityId: "deleted-user", createdAt: new Date("2024-01-01T00:00:00.000Z") },
    { id: "old-department", entityType: "DEPARTMENT", entityId: "deleted-department", createdAt: new Date("2024-02-01T00:00:00.000Z") },
    { id: "old-issue", entityType: "ISSUE", entityId: "issue-1", createdAt: new Date("2024-01-01T00:00:00.000Z") },
    { id: "old-system", entityType: "SYSTEM", entityId: "AUDIT_LOG_RETENTION", createdAt: new Date("2024-01-01T00:00:00.000Z") },
    { id: "recent-project", entityType: "PROJECT", entityId: "project-1", createdAt: new Date("2026-08-26T00:00:00.000Z") },
  ];
  const db = {
    auditLog: {
      findMany: async ({ where, take }: { where: Record<string, unknown>; take: number }) => logs
        .filter((log) => matchesWhere(log, where))
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .slice(0, take)
        .map((log) => ({ id: log.id })),
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const ids = logs.filter((log) => matchesWhere(log, where)).map((log) => log.id);
        for (let index = logs.length - 1; index >= 0; index -= 1) {
          if (ids.includes(logs[index].id)) logs.splice(index, 1);
        }
        return { count: ids.length };
      },
    },
    user: { findUnique: async () => null },
    department: { findUnique: async () => null },
    project: { findUnique: async () => null },
  };

  const result = await deleteExpiredAuditLogs(db as never, { type: "expired-governance" }, now, 1);
  assert.equal(result.deletedCount, 2);
  assert.deepEqual(logs.map((log) => log.id).sort(), ["old-issue", "old-system", "recent-project"]);

  const existingTargetDb = {
    ...db,
    user: { findUnique: async () => ({ id: "active-user" }) },
  };
  await assert.rejects(
    deleteExpiredAuditLogs(existingTargetDb as never, {
      type: "deleted-target",
      entityType: "USER",
      entityId: "active-user",
    }, now),
    /AUDIT_LOG_TARGET_STILL_EXISTS/,
  );

  console.log("audit log cleanup checks passed");
}

runCleanupChecks().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
