import { promises as fs } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import prisma from "./prisma";

export function knowledgeUploadLimit() {
  const value = Number(process.env.KNOWLEDGE_MAX_FILE_MIB || 50);
  if (!Number.isFinite(value) || value <= 0 || value > 1024) throw new Error("Invalid KNOWLEDGE_MAX_FILE_MIB");
  return Math.floor(value * 1024 * 1024);
}
export function knowledgeStorageRoot() {
  const configured = process.env.KNOWLEDGE_STORAGE_ROOT;
  if (!configured && process.env.NODE_ENV === "production") throw new Error("KNOWLEDGE_STORAGE_ROOT must be configured in production");
  const root = path.resolve(/* turbopackIgnore: true */ configured || path.join(process.cwd(), ".data/knowledge"));
  const appRelative = path.relative(process.cwd(), root);
  const publicRelative = path.relative(path.join(process.cwd(), "public"), root);
  const outside = (relative: string) => relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
  if (!outside(publicRelative) || (process.env.NODE_ENV === "production" && !outside(appRelative))) throw new Error("Knowledge storage must be outside the public and production release directories");
  return root;
}
export function knowledgeStoragePath(key: string) {
  if (!/^projects\/[a-zA-Z0-9_-]+\/assets\/[a-zA-Z0-9_-]+$/.test(key)) throw new Error("Invalid storage key");
  return path.join(/* turbopackIgnore: true */ knowledgeStorageRoot(), key);
}
export async function writeKnowledgeFile(key: string, bytes: Uint8Array) {
  const target = knowledgeStoragePath(key);
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await fs.writeFile(target, bytes, { flag: "wx", mode: 0o600 });
}
export async function removeKnowledgeFile(key: string) {
  try { await fs.unlink(knowledgeStoragePath(key)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}

export function detectKnowledgeMime(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes);
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString())) return "image/gif";
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return "application/octet-stream";
}

export function parseKnowledgeRange(header: string | null, size: number) {
  if (!header) return { start: 0, end: Math.max(0, size - 1), partial: false };
  const match = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] ? (match[2] ? Math.min(size - 1, Number(match[2])) : size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
  return { start, end, partial: true };
}

export async function cleanupKnowledgeFiles(db: PrismaClient = prisma, now = new Date()) {
  const candidates = await db.fileAsset.findMany({ where: { storageType: "KNOWLEDGE", OR: [{ state: { in: ["DELETE_PENDING", "DELETING"] } }, { cleanupAfter: { lte: now } }] }, select: { id: true, storageKey: true } });
  const result = { removed: 0, failed: 0 };
  for (const file of candidates) {
    // Claim under the same database lock used by save/link operations. Once
    // DELETING, no new document may claim this asset; interrupted deletes retry.
    const claimed = await db.$transaction(async (tx) => {
      const asset = await tx.fileAsset.findUnique({ where: { id: file.id } });
      if (!asset || (asset.state !== "DELETE_PENDING" && asset.state !== "DELETING" && (!asset.cleanupAfter || asset.cleanupAfter > now))) return false;
      const references = await tx.knowledgeItem.count({ where: { fileAssetId: file.id } }) + await tx.knowledgeAttachment.count({ where: { fileAssetId: file.id } });
      if (references) return false;
      await tx.fileAsset.update({ where: { id: file.id }, data: { state: "DELETING" } });
      return true;
    });
    if (!claimed || !file.storageKey) continue;
    try {
      await removeKnowledgeFile(file.storageKey);
      await db.fileAsset.delete({ where: { id: file.id } });
      result.removed++;
    } catch (error) {
      result.failed++;
      console.error("Knowledge file cleanup failed", file.id, error);
    }
  }
  return result;
}
