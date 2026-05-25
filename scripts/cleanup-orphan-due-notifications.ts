import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getDueIssueId(dedupeKey: string | null) {
  if (!dedupeKey?.startsWith("issue-due:")) return null;

  const [, issueId] = dedupeKey.split(":");
  return issueId || null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const dueNotifications = await prisma.notification.findMany({
    where: {
      dedupeKey: { startsWith: "issue-due:" },
    },
    select: {
      id: true,
      dedupeKey: true,
      message: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const issueIds = Array.from(
    new Set(dueNotifications.map((notification) => getDueIssueId(notification.dedupeKey)).filter(Boolean)),
  ) as string[];

  const existingIssues = await prisma.issue.findMany({
    where: { id: { in: issueIds } },
    select: { id: true },
  });
  const existingIssueIds = new Set(existingIssues.map((issue) => issue.id));
  const orphanNotifications = dueNotifications.filter((notification) => {
    const issueId = getDueIssueId(notification.dedupeKey);
    return issueId && !existingIssueIds.has(issueId);
  });

  console.log(`Found ${dueNotifications.length} due issue notification(s).`);
  console.log(`Found ${orphanNotifications.length} orphan due issue notification(s).`);

  if (orphanNotifications.length === 0) return;

  for (const notification of orphanNotifications.slice(0, 20)) {
    console.log(`- ${notification.id} ${notification.dedupeKey} ${notification.message}`);
  }
  if (orphanNotifications.length > 20) {
    console.log(`...and ${orphanNotifications.length - 20} more.`);
  }

  if (dryRun) {
    console.log("Dry run only. No changes were made.");
    return;
  }

  const result = await prisma.notification.deleteMany({
    where: {
      id: { in: orphanNotifications.map((notification) => notification.id) },
    },
  });

  console.log(`Deleted ${result.count} orphan due issue notification(s).`);
}

main()
  .catch((error) => {
    console.error("Failed to clean orphan due issue notifications:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
