"use server";

import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/lib/authOptions";
import {
  ISSUE_LIST_PREFERENCE_VERSION,
  SHARED_PREFERENCE_CONTEXT,
  issueListLayoutSchema,
  issueListSurfaces,
  splitLayoutForStorage,
  type IssueListPreferenceScope,
} from "@/lib/issueListPreferences";
import {
  filterPayloadJson,
  sanitizeIssueListLayout,
  sanitizeIssueListFilterQuery,
  validateIssueListScope,
} from "@/lib/issueListPreferenceServer";
import { canAccessProjectData } from "@/lib/permissions";
import prisma from "@/lib/prisma";

const scopeSchema = z.object({
  projectId: z.string().min(1),
  surface: z.enum(issueListSurfaces),
  contextKey: z.string().min(1),
});

async function authorizeScope(rawScope: IssueListPreferenceScope) {
  const scope = scopeSchema.parse(rawScope);
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !(await canAccessProjectData(userId, scope.projectId)) || !(await validateIssueListScope(scope))) {
    throw new Error("Unauthorized");
  }
  return { scope, userId };
}

export async function saveIssueListLayoutPreference(input: {
  scope: IssueListPreferenceScope;
  layout: unknown;
}) {
  try {
    const { scope, userId } = await authorizeScope(input.scope);
    const layout = await sanitizeIssueListLayout(scope, issueListLayoutSchema.parse(input.layout));
    const { base, context } = splitLayoutForStorage(layout);
    const records = [
      {
        kind: "LAYOUT_BASE",
        contextKey: SHARED_PREFERENCE_CONTEXT,
        payloadJson: JSON.stringify(base),
      },
      ...(scope.surface === "PLAN"
        ? [{ kind: "LAYOUT_CONTEXT", contextKey: scope.contextKey, payloadJson: JSON.stringify(context) }]
        : []),
    ];

    await prisma.$transaction(
      records.map((record) =>
        prisma.issueListPreference.upsert({
          where: {
            userId_projectId_surface_kind_contextKey: {
              userId,
              projectId: scope.projectId,
              surface: scope.surface,
              kind: record.kind,
              contextKey: record.contextKey,
            },
          },
          create: {
            userId,
            projectId: scope.projectId,
            surface: scope.surface,
            kind: record.kind,
            contextKey: record.contextKey,
            payloadJson: record.payloadJson,
            schemaVersion: ISSUE_LIST_PREFERENCE_VERSION,
          },
          update: {
            payloadJson: record.payloadJson,
            schemaVersion: ISSUE_LIST_PREFERENCE_VERSION,
          },
        })
      )
    );
    return { success: true as const };
  } catch (error) {
    console.error("Failed to save issue list layout preference:", error);
    return { success: false as const, error: "SAVE_FAILED" as const };
  }
}

export async function resetIssueListLayoutPreference(scopeInput: IssueListPreferenceScope) {
  try {
    const { scope, userId } = await authorizeScope(scopeInput);
    await prisma.issueListPreference.deleteMany({
      where: {
        userId,
        projectId: scope.projectId,
        surface: scope.surface,
        OR: [
          { kind: "LAYOUT_BASE", contextKey: SHARED_PREFERENCE_CONTEXT },
          { kind: "LAYOUT_CONTEXT", contextKey: scope.contextKey },
        ],
      },
    });
    return { success: true as const };
  } catch (error) {
    console.error("Failed to reset issue list layout preference:", error);
    return { success: false as const, error: "SAVE_FAILED" as const };
  }
}

export async function saveIssueListFilterPreference(input: {
  scope: IssueListPreferenceScope;
  query: string;
}) {
  try {
    const { scope, userId } = await authorizeScope(input.scope);
    const query = await sanitizeIssueListFilterQuery(userId, scope, input.query);
    if (!query) {
      await prisma.issueListPreference.deleteMany({
        where: {
          userId,
          projectId: scope.projectId,
          surface: scope.surface,
          kind: "FILTERS",
          contextKey: scope.contextKey,
        },
      });
      return { success: true as const, query };
    }

    await prisma.issueListPreference.upsert({
      where: {
        userId_projectId_surface_kind_contextKey: {
          userId,
          projectId: scope.projectId,
          surface: scope.surface,
          kind: "FILTERS",
          contextKey: scope.contextKey,
        },
      },
      create: {
        userId,
        projectId: scope.projectId,
        surface: scope.surface,
        kind: "FILTERS",
        contextKey: scope.contextKey,
        payloadJson: filterPayloadJson(query),
        schemaVersion: ISSUE_LIST_PREFERENCE_VERSION,
      },
      update: {
        payloadJson: filterPayloadJson(query),
        schemaVersion: ISSUE_LIST_PREFERENCE_VERSION,
      },
    });
    return { success: true as const, query };
  } catch (error) {
    console.error("Failed to save issue list filter preference:", error);
    return { success: false as const, error: "SAVE_FAILED" as const };
  }
}
