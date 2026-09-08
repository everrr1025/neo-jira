import assert from "node:assert/strict";

import { parseIssueSearchParams } from "./issueFilterUtils";
import { sortIssueCustomFieldRows } from "./issueCustomFieldSort";

const longTextField = {
  id: "interface-status",
  type: "LONG_TEXT",
  source: "issue" as const,
};

const filterOptions = { issueFieldDefinitions: [longTextField] };

async function run() {
  const customSortResult = await parseIssueSearchParams(
    { sortBy: "issueField:interface-status", sortDirection: "asc", page: "2" },
    "project-1",
    filterOptions,
  );
  assert.deepEqual(customSortResult.customSort, { ...longTextField, direction: "asc" });
  assert.equal(customSortResult.skip, 10);
  assert.equal((await parseIssueSearchParams({ sortBy: "issueField:deleted" }, "project-1", filterOptions)).customSort, undefined);
  const planField = { id: "plan-number", type: "NUMBER", source: "plan" as const };
  assert.equal((await parseIssueSearchParams({ sortBy: "planField:plan-number" }, "project-1", {
    planFieldDefinitions: [planField],
  })).customSort, undefined);
  assert.deepEqual((await parseIssueSearchParams({ sortBy: "planField:plan-number" }, "project-1", {
    lockedPlanId: "plan-1", planFieldDefinitions: [planField],
  })).customSort, { ...planField, direction: "desc" });

  for (const source of ["issue", "plan"] as const) {
    for (const [type, key, low, high] of [
      ["NUMBER", "valueNumber", 2, 10],
      ["BOOLEAN", "valueBoolean", false, true],
      ["DATE", "valueText", "2026-01-01", "2026-12-01"],
      ["TEXT", "valueText", "a", "b"],
      ["LONG_TEXT", "valueText", "aaa", "bbb"],
      ["SELECT", "valueOption", "a", "b"],
    ] as const) {
      const value = (entry: typeof low | typeof high) => ({ valueBoolean: null, valueNumber: null, valueText: null, valueOption: null, [key]: entry });
      const rows = [
        { id: "missing", issueFieldValues: [], planFieldValues: [] },
        { id: "high", issueFieldValues: source === "issue" ? [value(high)] : [], planFieldValues: source === "plan" ? [value(high)] : [] },
        { id: "low", issueFieldValues: source === "issue" ? [value(low)] : [], planFieldValues: source === "plan" ? [value(low)] : [] },
      ];
      const sort = { id: "field", type, source, direction: "asc" as const };
      assert.deepEqual(sortIssueCustomFieldRows(rows, sort).map((row) => row.id), ["low", "high", "missing"]);
      assert.deepEqual(sortIssueCustomFieldRows(rows, { ...sort, direction: "desc" }).map((row) => row.id), ["high", "low", "missing"]);
      assert.equal(sortIssueCustomFieldRows(rows, sort).slice(1, 2)[0].id, "high");
    }
  }

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
