import { Prisma } from "@prisma/client";

type IssueKeyClient = Pick<Prisma.TransactionClient, "issue">;

export async function getNextIssueKey(client: IssueKeyClient, projectId: string, projectKey: string) {
  const prefix = `${projectKey}-`;
  const existingKeys = await client.issue.findMany({
    where: {
      projectId,
      key: { startsWith: prefix },
    },
    select: { key: true },
  });

  let maxNumber = 0;
  for (const { key } of existingKeys) {
    const suffix = key.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    maxNumber = Math.max(maxNumber, Number(suffix));
  }

  return `${prefix}${maxNumber + 1}`;
}

export function isIssueKeyUniqueConstraintError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;

  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes("key") : target === "key";
}
