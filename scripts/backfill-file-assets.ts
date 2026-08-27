import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex);
    if (process.env[key]) continue;
    process.env[key] = trimmed.slice(separatorIndex + 1).replace(/^["']|["']$/g, "");
  }
}

function getMimeType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  const types: Record<string, string> = {
    ".csv": "text/csv",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".webp": "image/webp",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".zip": "application/zip",
  };
  return types[extension] ?? null;
}

loadLocalEnv();

const prisma = new PrismaClient();

async function main() {
  const uploadDir = path.join(process.cwd(), "public/uploads");
  if (!fs.existsSync(uploadDir)) {
    console.log("No public/uploads directory found. Nothing to backfill.");
    return;
  }

  const [entries, attachments, existingAssets] = await Promise.all([
    fs.promises.readdir(uploadDir, { withFileTypes: true }),
    prisma.attachment.findMany({
      select: {
        fileName: true,
        fileUrl: true,
        uploaderId: true,
        createdAt: true,
        issue: { select: { project: { select: { departmentId: true } } } },
      },
    }),
    prisma.fileAsset.findMany({ select: { fileUrl: true, fileName: true, mimeType: true, departmentId: true } }),
  ]);
  const memberships = await prisma.departmentMember.findMany({ select: { userId: true, departmentId: true } });
  const attachmentByUrl = new Map(attachments.map((attachment) => [attachment.fileUrl, attachment]));
  const existingByUrl = new Map(existingAssets.map((asset) => [asset.fileUrl, asset]));
  const departmentIdByUserId = new Map(memberships.map((membership) => [membership.userId, membership.departmentId]));
  let created = 0;
  let updated = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fileUrl = `/uploads/${entry.name}`;
    const filePath = path.join(uploadDir, entry.name);
    const [stats, attachment] = await Promise.all([
      fs.promises.stat(filePath),
      Promise.resolve(attachmentByUrl.get(fileUrl)),
    ]);
    const existing = existingByUrl.get(fileUrl);
    const mimeType = existing?.mimeType ?? getMimeType(entry.name);
    const departmentId = existing?.departmentId
      ?? attachment?.issue.project.departmentId
      ?? (attachment?.uploaderId ? departmentIdByUserId.get(attachment.uploaderId) : null)
      ?? null;

    if (existing) {
      await prisma.fileAsset.update({
        where: { fileUrl },
        data: { fileSize: BigInt(stats.size), mimeType, departmentId },
      });
      updated += 1;
      continue;
    }

    await prisma.fileAsset.create({
      data: {
        fileName: attachment?.fileName ?? entry.name,
        fileUrl,
        fileSize: BigInt(stats.size),
        mimeType,
        uploaderId: attachment?.uploaderId ?? null,
        departmentId,
        createdAt: attachment?.createdAt ?? stats.birthtime,
      },
    });
    created += 1;
  }

  console.log(`File asset backfill complete. Created ${created}, updated ${updated}.`);
}

main()
  .catch((error) => {
    console.error("Failed to backfill file assets:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
