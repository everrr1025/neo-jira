import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

import { getDefaultAvatar } from "../src/lib/avatar";

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex);
    const rawValue = trimmed.slice(separatorIndex + 1);
    if (process.env[key]) continue;

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadLocalEnv();

const prisma = new PrismaClient();

function avatarExists(avatar: string) {
  if (!avatar.startsWith("/")) return false;

  const publicPath = path.join(process.cwd(), "public", avatar);
  return fs.existsSync(publicPath);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const users = await prisma.user.findMany({
    where: {
      avatar: {
        not: null,
      },
    },
    select: {
      id: true,
      email: true,
      avatar: true,
    },
    orderBy: { email: "asc" },
  });

  const usersWithInvalidAvatars = users.filter((user) => user.avatar && !avatarExists(user.avatar));

  console.log(`Found ${users.length} user(s) with custom avatar values.`);
  console.log(`Found ${usersWithInvalidAvatars.length} invalid avatar value(s).`);

  if (usersWithInvalidAvatars.length === 0) return;

  for (const user of usersWithInvalidAvatars) {
    const nextAvatar = getDefaultAvatar(user.id);
    console.log(`${user.email}: ${user.avatar} -> ${nextAvatar}`);

    if (!dryRun) {
      await prisma.user.update({
        where: { id: user.id },
        data: { avatar: nextAvatar },
      });
    }
  }

  if (dryRun) {
    console.log("Dry run only. No changes were made.");
    return;
  }

  console.log(`Updated ${usersWithInvalidAvatars.length} user avatar value(s).`);
}

main()
  .catch((error) => {
    console.error("Failed to fix invalid user avatars:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
