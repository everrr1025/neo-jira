import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { randomInt } from "crypto";

const prisma = new PrismaClient();

function countPasswordCategories(password: string) {
  let categories = 0;
  if (/[A-Z]/.test(password)) categories += 1;
  if (/[a-z]/.test(password)) categories += 1;
  if (/[0-9]/.test(password)) categories += 1;
  if (/[^A-Za-z0-9]/.test(password)) categories += 1;
  return categories;
}

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

async function main() {
  console.log("🚀 Starting system reset...");

  try {
    // 1. Clear Data
    console.log("🧹 Clearing database tables...");
    
    // Deleting in order to respect foreign key constraints
    await prisma.attachment.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.issue.deleteMany({});
    await prisma.iteration.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    
    // Clear all users except ADMIN
    await prisma.user.deleteMany({
      where: {
        role: { not: "ADMIN" }
      }
    });

    console.log("✅ Database tables cleared.");

    // 2. Ensure Admin exists and has compliant password
    console.log("👤 Ensuring system admin exists...");
    let admin = await prisma.user.findFirst({
      where: { role: "ADMIN" }
    });

    const newPassword = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (admin) {
      await prisma.user.update({
        where: { id: admin.id },
        data: {
          password: hashedPassword
        }
      });
      console.log(`✅ Admin updated: ${admin.email}`);
    } else {
      const adminEmail = process.env.ADMIN_EMAIL || "admin@neo-jira.com";
      admin = await prisma.user.create({
        data: {
          email: adminEmail,
          name: "System Admin",
          password: hashedPassword,
          role: "ADMIN"
        }
      });
      console.log(`✅ Default Admin created: ${adminEmail}`);
    }

    console.log("\x1b[33m%s\x1b[0m", `🔑 ATTENTION: Admin password has been reset to: ${newPassword}`);
    console.log("\x1b[33m%s\x1b[0m", "Please save this password immediately!");

    // 3. Clear Attachments
    console.log("📁 Clearing physical attachment files...");
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        if (file === ".gitkeep") continue;
        const filePath = path.join(uploadsDir, file);
        if (fs.lstatSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }
      console.log("✅ Uploads directory cleared.");
    } else {
      console.log("ℹ️ Uploads directory not found, skipping.");
    }

    console.log("\n✨ System reset completed successfully!");
  } catch (error) {
    console.error("❌ Error during system reset:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
