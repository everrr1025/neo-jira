import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

const prisma = new PrismaClient();

function generateSecurePassword(length = 12) {
  const special = "!@#$%^&*()-_=+[]{};:,.?/|";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const pools = [upper, lower, digits, special];
  const requiredPools = [upper, lower, digits];

  let generated = requiredPools.map((pool) => pool[randomInt(pool.length)]).join("");
  const allChars = pools.join("");
  while (generated.length < Math.max(8, length)) {
    generated += allChars[randomInt(allChars.length)];
  }

  const chars = generated.split("");
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function countPasswordCategories(password: string) {
  let categories = 0;
  if (/[A-Z]/.test(password)) categories += 1;
  if (/[a-z]/.test(password)) categories += 1;
  if (/[0-9]/.test(password)) categories += 1;
  if (/[^A-Za-z0-9]/.test(password)) categories += 1;
  return categories;
}

function isValidPassword(password: string) {
  return password.length >= 8 && countPasswordCategories(password) >= 3;
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@neo-jira.local").trim().toLowerCase();
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existingAdmin) {
    if (existingAdmin.role !== "ADMIN") {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { role: "ADMIN" },
      });
      console.log(`Admin role restored for ${adminEmail}.`);
      return;
    }

    console.log(`Admin user already exists: ${adminEmail}. Seed did not change the password or delete data.`);
    return;
  }

  const password = process.env.ADMIN_PASSWORD || generateSecurePassword();
  if (!isValidPassword(password)) {
    throw new Error(
      "ADMIN_PASSWORD must be at least 8 characters and include at least 3 of: uppercase, lowercase, number, special character.",
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name: "System Admin",
      email: adminEmail,
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log(`Admin user created: ${adminEmail}`);
  console.log(`Initial admin password: ${password}`);
  console.log("Save this password. Running seed again will not reset it.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
