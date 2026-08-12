export const PROJECT_ROUTE_DEPARTMENT_HEADER = "x-neo-jira-department-id";
export const PROJECT_ROUTE_PROJECT_HEADER = "x-neo-jira-project-id";
export const ACTIVE_PROJECT_COOKIE = "activeProjectId";

export type ProjectRouteSection = "" | "issues" | "iterations" | "plans" | "settings";

export function getProjectBasePath(departmentId: string, projectId: string) {
  return `/departments/${encodeURIComponent(departmentId)}/projects/${encodeURIComponent(projectId)}`;
}

export function getProjectPath(
  departmentId: string,
  projectId: string,
  section: ProjectRouteSection = "",
  entityId?: string,
) {
  const basePath = getProjectBasePath(departmentId, projectId);
  if (!section) return basePath;

  const sectionPath = `${basePath}/${section}`;
  return entityId ? `${sectionPath}/${encodeURIComponent(entityId)}` : sectionPath;
}

export function parseProjectPath(pathname: string) {
  const match = pathname.match(
    /^\/departments\/([^/]+)\/projects\/([^/]+)(?:\/(issues|iterations|plans|settings)(?:\/([^/]+))?)?\/?$/,
  );
  if (!match) return null;

  return {
    departmentId: decodeURIComponent(match[1]),
    projectId: decodeURIComponent(match[2]),
    section: (match[3] || "") as ProjectRouteSection,
    entityId: match[4] ? decodeURIComponent(match[4]) : undefined,
  };
}

export function getLegacyProjectDestination(pathname: string) {
  const route = parseProjectPath(pathname);
  if (!route) return null;

  if (!route.section) return "/";
  if (route.section === "settings") return `/projects/${encodeURIComponent(route.projectId)}/settings`;

  const base = `/${route.section}`;
  return route.entityId ? `${base}/${encodeURIComponent(route.entityId)}` : base;
}
