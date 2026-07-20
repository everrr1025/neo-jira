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

  console.log("issue filter checks passed");
}

run();
