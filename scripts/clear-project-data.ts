import { PrismaClient } from "@prisma/client";

import { deleteProjectData } from "../src/lib/projectDataCleanup";

const prisma = new PrismaClient();

async function main() {
  const summary = await prisma.$transaction((tx) => deleteProjectData(tx));
  console.log("Project data cleared successfully.");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error("Failed to clear project data:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
