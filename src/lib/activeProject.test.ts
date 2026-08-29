const assert = require("node:assert/strict");
const {
  buildActiveProjectWhere,
  canMoveIssueToIteration,
  buildProjectEntityWhere,
  buildProjectItemsWhere,
  buildVisibleProjectsWhere,
  buildProjectUsersWhere,
  canUseIterationForActiveProject,
  findProjectById,
  isProjectInActiveContext,
  resolveIssueCreateProjectId,
} = require("./activeProjectUtils.ts");

const projects = [
  { id: "project-a", name: "Alpha", key: "ALPHA", departmentId: "department-a" },
  { id: "project-b", name: "Beta", key: "BETA", departmentId: "department-a" },
];

assert.deepEqual(findProjectById(projects, "project-b"), projects[1]);
assert.equal(findProjectById(projects, null), null);
assert.equal(findProjectById(projects, "project-c"), null);

assert.deepEqual(buildActiveProjectWhere("user-1", "ADMIN", "project-a"), {
  id: "project-a",
  OR: [
    { ownerId: "user-1" },
    {
      members: {
        some: { userId: "user-1" },
      },
    },
    {
      managedByDepartmentMembers: {
        some: { userId: "user-1" },
      },
    },
    {
      department: {
        members: {
          some: {
            userId: "user-1",
            OR: [{ isDepartmentAdmin: true }, { projectScopeType: "ALL_PROJECTS" }],
          },
        },
      },
    },
  ],
});

assert.deepEqual(buildActiveProjectWhere("user-1", "USER", "project-a"), {
  id: "project-a",
  OR: [
    { ownerId: "user-1" },
    {
      members: {
        some: { userId: "user-1" },
      },
    },
    {
      managedByDepartmentMembers: {
        some: { userId: "user-1" },
      },
    },
    {
      department: {
        members: {
          some: {
            userId: "user-1",
            OR: [{ isDepartmentAdmin: true }, { projectScopeType: "ALL_PROJECTS" }],
          },
        },
      },
    },
  ],
});

assert.deepEqual(buildActiveProjectWhere("user-1", "USER", "project-a", "department-a"), {
  id: "project-a",
  departmentId: "department-a",
  OR: [
    { ownerId: "user-1" },
    { members: { some: { userId: "user-1" } } },
    { managedByDepartmentMembers: { some: { userId: "user-1" } } },
    {
      department: {
        members: {
          some: {
            userId: "user-1",
            OR: [{ isDepartmentAdmin: true }, { projectScopeType: "ALL_PROJECTS" }],
          },
        },
      },
    },
  ],
});

assert.deepEqual(buildVisibleProjectsWhere("user-1", "USER"), {
  OR: [
    { ownerId: "user-1" },
    {
      members: {
        some: { userId: "user-1" },
      },
    },
    {
      managedByDepartmentMembers: {
        some: { userId: "user-1" },
      },
    },
    {
      department: {
        members: {
          some: {
            userId: "user-1",
            OR: [{ isDepartmentAdmin: true }, { projectScopeType: "ALL_PROJECTS" }],
          },
        },
      },
    },
  ],
});

assert.deepEqual(buildVisibleProjectsWhere("user-1", "ADMIN"), {
  OR: [
    { ownerId: "user-1" },
    {
      members: {
        some: { userId: "user-1" },
      },
    },
    {
      managedByDepartmentMembers: {
        some: { userId: "user-1" },
      },
    },
    {
      department: {
        members: {
          some: {
            userId: "user-1",
            OR: [{ isDepartmentAdmin: true }, { projectScopeType: "ALL_PROJECTS" }],
          },
        },
      },
    },
  ],
});

assert.deepEqual(buildProjectItemsWhere("project-a"), {
  projectId: "project-a",
});

assert.deepEqual(buildProjectEntityWhere("issue-1", "project-a"), {
  id: "issue-1",
  projectId: "project-a",
});

assert.deepEqual(buildProjectUsersWhere("project-a"), {
  disabledAt: null,
  projectMemberships: { some: { projectId: "project-a" } },
});

assert.deepEqual(buildProjectUsersWhere("project-a", false), {
  disabledAt: null,
  projectMemberships: { some: { projectId: "project-a" } },
});

assert.equal(
  canUseIterationForActiveProject({
    activeProjectId: "project-a",
    selectedIterationProjectId: "project-a",
  }),
  true,
);

assert.equal(
  canUseIterationForActiveProject({
    activeProjectId: "project-a",
    selectedIterationProjectId: "project-b",
  }),
  false,
);

assert.equal(
  canUseIterationForActiveProject({
    activeProjectId: null,
    selectedIterationProjectId: "project-a",
  }),
  false,
);

assert.equal(
  resolveIssueCreateProjectId({
    activeProjectId: "project-a",
    selectedIterationProjectId: "project-a",
    fallbackProjectId: "project-b",
  }),
  "project-a",
);

assert.equal(
  resolveIssueCreateProjectId({
    activeProjectId: "project-a",
    selectedIterationProjectId: null,
    fallbackProjectId: "project-b",
  }),
  "project-a",
);

assert.equal(
  resolveIssueCreateProjectId({
    activeProjectId: null,
    selectedIterationProjectId: null,
    fallbackProjectId: "project-b",
  }),
  "project-b",
);

assert.equal(
  isProjectInActiveContext({
    activeProjectId: "project-a",
    projectId: "project-a",
  }),
  true,
);

assert.equal(
  isProjectInActiveContext({
    activeProjectId: "project-a",
    projectId: "project-b",
  }),
  false,
);

assert.equal(
  canMoveIssueToIteration({
    issueProjectId: "project-a",
    targetIterationProjectId: "project-a",
  }),
  true,
);

assert.equal(
  canMoveIssueToIteration({
    issueProjectId: "project-a",
    targetIterationProjectId: "project-b",
  }),
  false,
);

assert.equal(
  canMoveIssueToIteration({
    issueProjectId: "project-a",
    targetIterationProjectId: null,
  }),
  true,
);

console.log("activeProject checks passed");
