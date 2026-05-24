import { promises as fs } from "fs";
import path from "path";

import prisma from "@/lib/prisma";

const UPLOAD_PREFIX = "/uploads/";
const TASK_ATTACHMENT_MARKER_PATTERN = /<!--neo-task-attachments:([\s\S]*?)-->/g;
const NOTIFICATION_ATTACHMENT_MARKER_PATTERN = /<!--neo-notification-attachments:([\s\S]*?)-->/g;

export function extractUploadUrlsFromContent(content?: string | null) {
  const uploadUrls = new Set<string>();
  if (!content) return uploadUrls;

  const imageSrcPattern = /<img\b[^>]*\bsrc=(['"])(.*?)\1/gi;
  for (const match of content.matchAll(imageSrcPattern)) {
    const src = match[2]?.trim();
    if (src?.startsWith(UPLOAD_PREFIX)) {
      uploadUrls.add(src);
    }
  }

  const uploadHrefPattern = /<a\b[^>]*\bhref=(['"])(.*?)\1/gi;
  for (const match of content.matchAll(uploadHrefPattern)) {
    const href = match[2]?.trim();
    if (href?.startsWith(UPLOAD_PREFIX)) {
      uploadUrls.add(href);
    }
  }

  for (const match of content.matchAll(TASK_ATTACHMENT_MARKER_PATTERN)) {
    try {
      const attachments = JSON.parse(decodeURIComponent(match[1])) as Array<{ fileUrl?: unknown }>;
      if (Array.isArray(attachments)) {
        attachments.forEach((attachment) => {
          if (typeof attachment.fileUrl === "string" && attachment.fileUrl.startsWith(UPLOAD_PREFIX)) {
            uploadUrls.add(attachment.fileUrl);
          }
        });
      }
    } catch {
      // Ignore malformed markers; they should not block cleanup for valid uploads.
    }
  }

  for (const match of content.matchAll(NOTIFICATION_ATTACHMENT_MARKER_PATTERN)) {
    try {
      const attachments = JSON.parse(decodeURIComponent(match[1])) as Array<{ fileUrl?: unknown }>;
      if (Array.isArray(attachments)) {
        attachments.forEach((attachment) => {
          if (typeof attachment.fileUrl === "string" && attachment.fileUrl.startsWith(UPLOAD_PREFIX)) {
            uploadUrls.add(attachment.fileUrl);
          }
        });
      }
    } catch {
      // Ignore malformed markers; they should not block cleanup for valid uploads.
    }
  }

  return uploadUrls;
}

export function getRemovedUploadUrls(previousContent?: string | null, nextContent?: string | null) {
  const previousUrls = extractUploadUrlsFromContent(previousContent);
  const nextUrls = extractUploadUrlsFromContent(nextContent);

  for (const url of nextUrls) {
    previousUrls.delete(url);
  }

  return previousUrls;
}

async function isUploadReferenced(fileUrl: string) {
  const [issueCount, commentCount, attachmentCount, reminderCount, reminderCommentCount, announcementCount] =
    await Promise.all([
      prisma.issue.count({ where: { description: { contains: fileUrl } } }),
      prisma.comment.count({ where: { content: { contains: fileUrl } } }),
      prisma.attachment.count({ where: { fileUrl } }),
      prisma.reminder.count({ where: { content: { contains: fileUrl } } }),
      prisma.reminderComment.count({ where: { content: { contains: fileUrl } } }),
      prisma.announcement.count({ where: { content: { contains: fileUrl } } }),
    ]);

  return issueCount + commentCount + attachmentCount + reminderCount + reminderCommentCount + announcementCount > 0;
}

export async function deleteLocalUpload(fileUrl?: string | null) {
  if (!fileUrl?.startsWith(UPLOAD_PREFIX)) return;
  if (await isUploadReferenced(fileUrl)) return;

  const fileName = path.basename(fileUrl.slice(UPLOAD_PREFIX.length));
  if (!fileName) return;

  const filePath = path.join(process.cwd(), "public/uploads", fileName);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "ENOENT") {
      console.error("Failed to delete local upload:", fileUrl, error);
    }
  }
}

export async function deleteLocalUploads(fileUrls: Iterable<string | null | undefined>) {
  const uniqueFileUrls = Array.from(new Set(Array.from(fileUrls).filter(Boolean))) as string[];
  await Promise.allSettled(uniqueFileUrls.map((fileUrl) => deleteLocalUpload(fileUrl)));
}
