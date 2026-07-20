import assert from "node:assert/strict";

import { parseIssueSearchParams } from "./issueFilterUtils";

const longTextField = {
  id: "interface-status",
  type: "LONG_TEXT",
  source: "issue" as const,
};

const filterOptions = { issueFieldDefinitions: [longTextField] };

async function run() {
  const notEmptyResult = await parseIssueSearchParams(
    { "issueField_interface-status_op": "NOT_EMPTY" },
    "project-1",
    filterOptions
  );

  assert.deepEqual(notEmptyResult.where, {
    projectId: "project-1",
    AND: [
      {
        issueFieldValues: {
          some: {
            fieldDefinitionId: "interface-status",
            AND: [{ valueText: { not: null } }, { valueText: { not: "" } }],
          },
        },
      },
    ],
  });

  const emptyResult = await parseIssueSearchParams(
    { "issueField_interface-status_op": "EMPTY" },
    "project-1",
    filterOptions
  );

  assert.deepEqual(emptyResult.where, {
    projectId: "project-1",
    AND: [
      {
        OR: [
          {
            issueFieldValues: {
              none: {
                fieldDefinitionId: "interface-status",
              },
            },
          },
          {
            issueFieldValues: {
              some: {
                fieldDefinitionId: "interface-status",
                OR: [{ valueText: null }, { valueText: "" }],
              },
            },
          },
        ],
      },
    ],
  });

  const lockedIterationResult = await parseIssueSearchParams(
    {
      sprint: "iteration-2,__BACKLOG__",
      view: "backlog",
      status: "TODO,IN_PROGRESS",
      assignee: "user-1",
      plan: "plan-1",
      dueFilter: "GTE",
      dueDate: "2026-07-20",
      page: "2",
      pageSize: "20",
      sortBy: "priority",
      sortDirection: "asc",
      "issueField_interface-status_op": "NOT_EMPTY",
    },
    "project-1",
    {
      lockedIterationId: "iteration-1",
      issueFieldDefinitions: [longTextField],
    }
  );

  assert.deepEqual(lockedIterationResult.where, {
    projectId: "project-1",
    AND: [
      { status: { in: ["TODO", "IN_PROGRESS"] } },
      { planId: { in: ["plan-1"] } },
      { OR: [{ assigneeId: { in: ["user-1"] } }] },
      { dueDate: { gte: new Date(2026, 6, 20) } },
      { iterationId: "iteration-1" },
      {
        issueFieldValues: {
          some: {
            fieldDefinitionId: "interface-status",
            AND: [{ valueText: { not: null } }, { valueText: { not: "" } }],
          },
        },
      },
    ],
  });
  assert.equal(lockedIterationResult.skip, 20);
  assert.equal(lockedIterationResult.take, 20);
  assert.deepEqual(lockedIterationResult.orderBy, { priority: "asc" });

  console.log("issue filter checks passed");
}

run();
