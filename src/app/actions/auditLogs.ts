"use server";

import { revalidatePath } from "next/cache";

import {
  AUDIT_LOG_CLEANUP_CONFIRMATION,
  deleteExpiredAuditLogs,
  getAuditLogCleanupPreview,
  parseAuditLogCleanupScope,
} from "@/lib/auditLogCleanup";
import { createAuditLogs } from "@/lib/audit";
import { checkGlobalAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";

function getSessionUserId(session: unknown) {
  return (session as { user?: { id?: string } }).user?.id;
}

function serializePreview(preview: Awaited<ReturnType<typeof getAuditLogCleanupPreview>>) {
  return {
    ...preview,
    cutoff: preview.cutoff.toISOString(),
    oldestLogAt: preview.oldestLogAt?.toISOString() ?? null,
    newestExpiredLogAt: preview.newestExpiredLogAt?.toISOString() ?? null,
  };
}

export async function previewAuditLogCleanup(input: { scope?: unknown }) {
  try {
    await checkGlobalAdmin();
    const scope = parseAuditLogCleanupScope(input?.scope);
    if (!scope) return { success: false as const, error: "AUDIT_LOG_INVALID_SCOPE" };

    const preview = await getAuditLogCleanupPreview(prisma, scope);
    return { success: true as const, preview: serializePreview(preview) };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "AUDIT_LOG_PREVIEW_FAILED",
    };
  }
}

export async function cleanupAuditLogs(input: { scope?: unknown; confirmation?: unknown }) {
  try {
    const session = await checkGlobalAdmin();
    const actorId = getSessionUserId(session);
    const scope = parseAuditLogCleanupScope(input?.scope);
    if (!scope) return { success: false as const, error: "AUDIT_LOG_INVALID_SCOPE" };
    if (input?.confirmation !== AUDIT_LOG_CLEANUP_CONFIRMATION) {
      return { success: false as const, error: "AUDIT_LOG_CONFIRMATION_MISMATCH" };
    }

    const preview = await getAuditLogCleanupPreview(prisma, scope);
    if (!preview.eligible) {
      return { success: false as const, error: "AUDIT_LOG_TARGET_STILL_EXISTS" };
    }
    if (preview.count === 0) {
      return {
        success: true as const,
        deletedCount: 0,
        cutoff: preview.cutoff.toISOString(),
      };
    }

    const result = await deleteExpiredAuditLogs(prisma, scope);
    await createAuditLogs(prisma, [{
      entityType: "SYSTEM",
      entityId: "AUDIT_LOG_RETENTION",
      action: "DELETE",
      field: scope.type,
      metadata: {
        deletedCount: String(result.deletedCount),
        cutoff: result.cutoff.toISOString(),
        targetType: scope.type === "deleted-target" ? scope.entityType : null,
        targetId: scope.type === "deleted-target" ? scope.entityId : null,
      },
      actorId,
    }]);

    revalidatePath("/");
    revalidatePath("/admin/logs");
    return {
      success: true as const,
      deletedCount: result.deletedCount,
      cutoff: result.cutoff.toISOString(),
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "AUDIT_LOG_CLEANUP_FAILED",
    };
  }
}
