import { PrismaClient } from "@prisma/client";
import { createDefaultWorkflowForProject } from "../src/lib/workflows";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      key: true,
      workflowStatuses: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const missingWorkflowProjects = projects.filter((project) => project.workflowStatuses.length === 0);

  if (missingWorkflowProjects.length === 0) {
    console.log("No projects need workflow backfill.");
    return;
  }

  console.log(
    `Found ${missingWorkflowProjects.length} project(s) without workflow statuses: ${missingWorkflowProjects
      .map((project) => `${project.key} (${project.name})`)
      .join(", ")}`
  );

  if (dryRun) {
    console.log("Dry run only. No changes were made.");
    return;
  }

  for (const project of missingWorkflowProjects) {
    await prisma.$transaction(async (tx) => {
      const workflowStatusCount = await tx.projectWorkflowStatus.count({
        where: { projectId: project.id },
      });

      if (workflowStatusCount > 0) {
        return;
      }

      await createDefaultWorkflowForProject(tx, project.id);
    });

    console.log(`Backfilled workflow for ${project.key} (${project.name})`);
  }

  console.log("Workflow backfill completed.");
}

main()
  .catch((error) => {
    console.error("Workflow backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
