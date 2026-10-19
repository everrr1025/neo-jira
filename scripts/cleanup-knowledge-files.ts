import prisma from "../src/lib/prisma";
import { cleanupKnowledgeFiles } from "../src/lib/knowledgeStorage";

cleanupKnowledgeFiles().then((result) => {
  console.log("Knowledge cleanup:", result);
  if (result.failed) process.exitCode = 1;
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
