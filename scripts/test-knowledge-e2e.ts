import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), "neo-knowledge-e2e-"));
  try {
    await (await open(path.join(root, "test.db"), "a")).close();
    const env = { ...process.env, KNOWLEDGE_E2E: "1", DATABASE_URL: `file:${root}/test.db`, KNOWLEDGE_STORAGE_ROOT: path.join(root, "private"), KNOWLEDGE_MAX_FILE_MIB: "1", NEXTAUTH_URL: "http://localhost:3117", NEXTAUTH_SECRET: "isolated-knowledge-e2e-only-secret" };
    const migration = spawnSync(path.resolve("node_modules/.bin/prisma"), ["migrate", "deploy"], { env, stdio: "inherit" });
    if (migration.status !== 0) throw new Error("Test database migration failed");
    const result = spawnSync(path.resolve("node_modules/.bin/playwright"), ["test", "--config", "playwright.knowledge.config.ts"], { env, stdio: "inherit" });
    process.exitCode = result.status ?? 1;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
