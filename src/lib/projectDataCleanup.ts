import type { Prisma, PrismaClient } from "@prisma/client";

type ProjectCleanupClient = Prisma.TransactionClient | PrismaClient;

export type ProjectCleanupResult = {
  deletedProjects: number;
  deletedProjectMembers: number;
  deletedPlans: number;
  deletedIterations: number;
  deletedIssues: number;
  deletedComments: number;
  deletedAttachments: number;
  deletedAnnouncements: number;
  deletedWorkflowTransitions: number;
  deletedWorkflowStatuses: number;
  deletedAuditLogs: number;
};

export async function deleteProjectData(
  db: ProjectCleanupClient,
  projectIds?: string[]
): Promise<ProjectCleanupResult> {
  const uniqueProjectIds = projectIds ? Array.from(new Set(projectIds.filter(Boolean))) : [];
  const projectWhere = uniqueProjectIds.length > 0 ? { id: { in: uniqueProjectIds } } : undefined;

  const projects = await db.project.findMany({
    where: projectWhere,
    select: { id: true },
  });
  const resolvedProjectIds = projects.map((project) => project.id);

  if (resolvedProjectIds.length === 0) {
    return {
      deletedProjects: 0,
      deletedProjectMembers: 0,
      deletedPlans: 0,
      deletedIterations: 0,
      deletedIssues: 0,
      deletedComments: 0,
      deletedAttachments: 0,
      deletedAnnouncements: 0,
      deletedWorkflowTransitions: 0,
      deletedWorkflowStatuses: 0,
      deletedAuditLogs: 0,
    };
  }

  const issueIds = (
    await db.issue.findMany({
      where: { projectId: { in: resolvedProjectIds } },
      select: { id: true },
    })
  ).map((issue) => issue.id);

  const deletedAttachments = issueIds.length
    ? (await db.attachment.deleteMany({ where: { issueId: { in: issueIds } } })).count
    : 0;
  const deletedComments = issueIds.length
    ? (await db.comment.deleteMany({ where: { issueId: { in: issueIds } } })).count
    : 0;
  const deletedAnnouncements = (
    await db.announcement.deleteMany({
      where: { projectId: { in: resolvedProjectIds } },
    })
  ).count;
  const deletedWorkflowTransitions = (
    await db.projectWorkflowTransition.deleteMany({
      where: { projectId: { in: resolvedProjectIds } },
    })
  ).count;
  const deletedWorkflowStatuses = (
    await db.projectWorkflowStatus.deleteMany({
      where: { projectId: { in: resolvedProjectIds } },
    })
  ).count;
  const deletedAuditLogs = (
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { projectId: { in: resolvedProjectIds } },
          { entityType: "PROJECT", entityId: { in: resolvedProjectIds } },
          ...(issueIds.length > 0
            ? [
                { issueId: { in: issueIds } },
                { entityType: "ISSUE", entityId: { in: issueIds } },
              ]
            : []),
        ],
      },
    })
  ).count;
  const deletedIssues = (
    await db.issue.deleteMany({
      where: { projectId: { in: resolvedProjectIds } },
    })
  ).count;
  const deletedPlans = (
    await db.plan.deleteMany({
      where: { projectId: { in: resolvedProjectIds } },
    })
  ).count;
  const deletedIterations = (
    await db.iteration.deleteMany({
      where: { projectId: { in: resolvedProjectIds } },
    })
  ).count;
  const deletedProjectMembers = (
    await db.projectMember.deleteMany({
      where: { projectId: { in: resolvedProjectIds } },
    })
  ).count;
  const deletedProjects = (
    await db.project.deleteMany({
      where: { id: { in: resolvedProjectIds } },
    })
  ).count;

  return {
    deletedProjects,
    deletedProjectMembers,
    deletedPlans,
    deletedIterations,
    deletedIssues,
    deletedComments,
    deletedAttachments,
    deletedAnnouncements,
    deletedWorkflowTransitions,
    deletedWorkflowStatuses,
    deletedAuditLogs,
  };
}
