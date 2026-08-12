import {
  buildDepartmentProjectAccessWhere,
  buildVisibleDepartmentProjectsWhere,
} from "@/lib/departmentPermissions";

export type BasicProject = {
  id: string;
  name: string;
  key: string;
  departmentId: string;
};

export { buildDepartmentProjectAccessWhere };

export function findProjectById(
  projects: BasicProject[],
  projectId?: string | null,
): BasicProject | null {
  if (!projectId) return null;
  return projects.find((project) => project.id === projectId) || null;
}

export function buildActiveProjectWhere(
  userId: string,
  userRole: string | undefined,
  projectId: string,
  departmentId?: string | null,
) {
  return {
    id: projectId,
    ...(departmentId ? { departmentId } : {}),
    ...buildVisibleDepartmentProjectsWhere(userId),
  };
}

export function buildProjectItemsWhere(projectId: string) {
  return { projectId };
}

export function buildVisibleProjectsWhere(userId: string, userRole: string | undefined) {
  return buildVisibleDepartmentProjectsWhere(userId);
}

export function buildProjectEntityWhere(entityId: string, projectId: string) {
  return {
    id: entityId,
    projectId,
  };
}

export function buildProjectUsersWhere(projectId: string, includeGlobalAdmins = true) {
  if (includeGlobalAdmins) {
    return {
      projectMemberships: { some: { projectId } },
    };
  }

  return {
    projectMemberships: { some: { projectId } },
  };
}

export function canUseIterationForActiveProject(params: {
  activeProjectId?: string | null;
  selectedIterationProjectId?: string | null;
}) {
  const { activeProjectId, selectedIterationProjectId } = params;

  if (!selectedIterationProjectId) return true;
  if (!activeProjectId) return false;

  return selectedIterationProjectId === activeProjectId;
}

export function resolveIssueCreateProjectId(params: {
  activeProjectId?: string | null;
  selectedIterationProjectId?: string | null;
  fallbackProjectId?: string | null;
}) {
  const { activeProjectId, selectedIterationProjectId, fallbackProjectId } = params;
  return selectedIterationProjectId || activeProjectId || fallbackProjectId || null;
}

export function isProjectInActiveContext(params: {
  activeProjectId?: string | null;
  projectId?: string | null;
}) {
  const { activeProjectId, projectId } = params;

  if (!activeProjectId || !projectId) return false;
  return activeProjectId === projectId;
}

export function canMoveIssueToIteration(params: {
  issueProjectId: string;
  targetIterationProjectId?: string | null;
}) {
  const { issueProjectId, targetIterationProjectId } = params;

  if (!targetIterationProjectId) return true;
  return issueProjectId === targetIterationProjectId;
}
