import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";

export type AuditEntityType = "ISSUE" | "COMMENT" | "ATTACHMENT";
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
  const records = entries
    .filter((entry) => entry.entityId)
    .map((entry) => ({
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
    }));

  if (records.length === 0) return;

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
