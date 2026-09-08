import type { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { sortIssueCustomFieldRows, type IssueCustomSort } from "./issueCustomFieldSort";

export async function prepareIssueListPage(
  where: Prisma.IssueWhereInput,
  skip: number,
  take: number,
  customSort?: IssueCustomSort,
) {
  if (!customSort) return { where, skip, take, ids: undefined };

  // Prisma cannot order a parent by a selected to-many field value. Fetch only
  // IDs and that field, sort before pagination, then load full rows for one page.
  const fieldSelection = {
    where: { fieldDefinitionId: customSort.id },
    select: { valueBoolean: true, valueNumber: true, valueText: true, valueOption: true },
  };
  const rows = await prisma.issue.findMany({
    where,
    select: {
      id: true,
      issueFieldValues: customSort.source === "issue" ? fieldSelection : { where: { id: { in: [] } }, select: fieldSelection.select },
      planFieldValues: customSort.source === "plan" ? fieldSelection : { where: { id: { in: [] } }, select: fieldSelection.select },
    },
  });
  const ids = sortIssueCustomFieldRows(rows, customSort).slice(skip, skip + take).map((row) => row.id);
  return { where: { AND: [where, { id: { in: ids } }] }, skip: 0, take, ids };
}

export function orderIssueListPage<T extends { id: string }>(rows: T[], ids?: string[]) {
  if (!ids) return rows;
  const positions = new Map(ids.map((id, index) => [id, index]));
  return [...rows].sort((a, b) => positions.get(a.id)! - positions.get(b.id)!);
}
