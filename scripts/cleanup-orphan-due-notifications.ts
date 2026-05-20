import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getDueIssueId(dedupeKey: string | null) {
  if (!dedupeKey?.startsWith("issue-due:")) return null;

  const [, issueId] = dedupeKey.split(":");
  return issueId || null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const dueAnnouncements = await prisma.announcement.findMany({
    where: {
      level: "SYSTEM",
      dedupeKey: { startsWith: "issue-due:" },
    },
    select: {
      id: true,
      dedupeKey: true,
      title: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const issueIds = Array.from(
    new Set(dueAnnouncements.map((announcement) => getDueIssueId(announcement.dedupeKey)).filter(Boolean)),
  ) as string[];

  const existingIssues = await prisma.issue.findMany({
    where: { id: { in: issueIds } },
    select: { id: true },
  });
  const existingIssueIds = new Set(existingIssues.map((issue) => issue.id));
  const orphanAnnouncements = dueAnnouncements.filter((announcement) => {
    const issueId = getDueIssueId(announcement.dedupeKey);
    return issueId && !existingIssueIds.has(issueId);
  });

  console.log(`Found ${dueAnnouncements.length} due issue notification(s).`);
  console.log(`Found ${orphanAnnouncements.length} orphan due issue notification(s).`);

  if (orphanAnnouncements.length === 0) return;

  for (const announcement of orphanAnnouncements.slice(0, 20)) {
    console.log(`- ${announcement.id} ${announcement.dedupeKey} ${announcement.title}`);
  }
  if (orphanAnnouncements.length > 20) {
    console.log(`...and ${orphanAnnouncements.length - 20} more.`);
  }

  if (dryRun) {
    console.log("Dry run only. No changes were made.");
    return;
  }

  const result = await prisma.announcement.deleteMany({
    where: {
      id: { in: orphanAnnouncements.map((announcement) => announcement.id) },
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
