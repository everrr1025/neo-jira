import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";

export type AuditEntityType = "ISSUE" | "COMMENT" | "ATTACHMENT" | "USER" | "DEPARTMENT" | "PROJECT";
export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

type AuditMetadata = Record<string, string | null | undefined>;
type AuditDbClient = PrismaClient | Prisma.TransactionClient;

export type AuditLogInput = {
  issueId?: string | null;
  projectId?: string | null;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: AuditMetadata | null;
  actorId?: string | null;
};

export type IssueAuditSnapshot = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  assigneeId: string | null;
  parentIssueId: string | null;
  planId: string | null;
  iterationId: string | null;
  dueDate: Date | null;
  description: string | null;
};

function serializeAuditMetadata(metadata?: AuditMetadata | null) {
  if (!metadata) return null;

  const filteredEntries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (filteredEntries.length === 0) return null;

  return JSON.stringify(Object.fromEntries(filteredEntries));
}

export function normalizeAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeDescriptionValue(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createAuditLogs(db: AuditDbClient, entries: AuditLogInput[]) {
  const validEntries = entries.filter((entry) => entry.entityId);
  if (validEntries.length === 0) return;

  const actorIds = Array.from(new Set(validEntries.flatMap((entry) => entry.actorId ? [entry.actorId] : [])));
  const targetUserIds = Array.from(new Set(validEntries.filter((entry) => entry.entityType === "USER").map((entry) => entry.entityId)));
  const targetDepartmentIds = Array.from(new Set(validEntries.filter((entry) => entry.entityType === "DEPARTMENT").map((entry) => entry.entityId)));
  const targetProjectIds = Array.from(new Set(validEntries.filter((entry) => entry.entityType === "PROJECT").map((entry) => entry.entityId)));
  const [actors, targetUsers, targetDepartments, targetProjects] = await Promise.all([
    actorIds.length > 0
      ? db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
      : Promise.resolve([]),
    targetUserIds.length > 0
      ? db.user.findMany({ where: { id: { in: targetUserIds } }, select: { id: true, name: true, email: true } })
      : Promise.resolve([]),
    targetDepartmentIds.length > 0
      ? db.department.findMany({ where: { id: { in: targetDepartmentIds } }, select: { id: true, name: true, key: true } })
      : Promise.resolve([]),
    targetProjectIds.length > 0
      ? db.project.findMany({ where: { id: { in: targetProjectIds } }, select: { id: true, name: true, key: true } })
      : Promise.resolve([]),
  ]);
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]));
  const targetUsersById = new Map(targetUsers.map((user) => [user.id, user]));
  const targetDepartmentsById = new Map(targetDepartments.map((department) => [department.id, department]));
  const targetProjectsById = new Map(targetProjects.map((project) => [project.id, project]));

  const records = validEntries.map((entry) => {
    const actor = entry.actorId ? actorsById.get(entry.actorId) : undefined;
    const targetUser = entry.entityType === "USER" ? targetUsersById.get(entry.entityId) : undefined;
    const targetDepartment = entry.entityType === "DEPARTMENT" ? targetDepartmentsById.get(entry.entityId) : undefined;
    const targetProject = entry.entityType === "PROJECT" ? targetProjectsById.get(entry.entityId) : undefined;
    const targetName = targetUser?.name || targetUser?.email || targetDepartment?.name || targetProject?.name
      || entry.metadata?.name || entry.metadata?.email || null;
    const targetKey = targetUser?.email || targetDepartment?.key || targetProject?.key
      || entry.metadata?.key || entry.metadata?.email || null;

    return {
      issueId: entry.issueId ?? null,
      projectId: entry.projectId ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      field: entry.field ?? null,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      metadata: serializeAuditMetadata(entry.metadata),
      actorId: entry.actorId ?? null,
      actorNameSnapshot: actor?.name || actor?.email || null,
      actorEmailSnapshot: actor?.email || null,
      targetNameSnapshot: targetName,
      targetKeySnapshot: targetKey,
    };
  });

  await db.auditLog.createMany({
    data: records,
  });
}

export function buildIssueUpdateAuditLogs({
  before,
  after,
  actorId,
}: {
  before: IssueAuditSnapshot;
  after: IssueAuditSnapshot;
  actorId?: string | null;
}) {
  const trackedFields: Array<keyof Omit<IssueAuditSnapshot, "id" | "projectId">> = [
    "title",
    "status",
    "priority",
    "type",
    "assigneeId",
    "parentIssueId",
    "planId",
    "iterationId",
    "dueDate",
    "description",
  ];

  const auditLogs: AuditLogInput[] = [];

  for (const field of trackedFields) {
    if (field === "description") {
      const previousDescription = normalizeDescriptionValue(before.description);
      const nextDescription = normalizeDescriptionValue(after.description);

      if (previousDescription !== nextDescription) {
        auditLogs.push({
          issueId: after.id,
          projectId: after.projectId,
          entityType: "ISSUE",
          entityId: after.id,
          action: "UPDATE",
          field,
          actorId,
        });
      }
      continue;
    }

    const previousValue = normalizeAuditValue(before[field]);
    const nextValue = normalizeAuditValue(after[field]);

    if (previousValue === nextValue) continue;

    auditLogs.push({
      issueId: after.id,
      projectId: after.projectId,
      entityType: "ISSUE",
      entityId: after.id,
      action: "UPDATE",
      field,
      oldValue: previousValue,
      newValue: nextValue,
      actorId,
    });
  }

  return auditLogs;
}

export function extractAuditTextPreview(value: string, maxLength = 120) {
  const plainText = value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) return null;
  if (plainText.length <= maxLength) return plainText;
  return `${plainText.slice(0, maxLength).trimEnd()}...`;
}
