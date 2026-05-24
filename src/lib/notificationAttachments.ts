export type NotificationAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
};

export const NOTIFICATION_ATTACHMENT_MARKER_PATTERN = /<!--neo-notification-attachments:([\s\S]*?)-->/g;

export function parseNotificationAttachmentsFromContent(content?: string | null): NotificationAttachment[] {
  if (!content) return [];

  const attachments: NotificationAttachment[] = [];
  for (const match of content.matchAll(NOTIFICATION_ATTACHMENT_MARKER_PATTERN)) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1])) as NotificationAttachment[];
      if (Array.isArray(parsed)) {
        attachments.push(
          ...parsed.filter(
            (attachment) =>
              attachment &&
              typeof attachment.id === "string" &&
              typeof attachment.fileName === "string" &&
              typeof attachment.fileUrl === "string" &&
              (attachment.fileSize === undefined || typeof attachment.fileSize === "number")
          )
        );
      }
    } catch {
      // Ignore malformed notification attachment markers.
    }
  }

  return attachments;
}

export function stripNotificationAttachmentsFromContent(content?: string | null) {
  return (content || "").replace(NOTIFICATION_ATTACHMENT_MARKER_PATTERN, "").trim();
}

export function appendNotificationAttachmentsToContent(content: string, attachments: NotificationAttachment[]) {
  if (attachments.length === 0) return content;
  return `${content || ""}<!--neo-notification-attachments:${encodeURIComponent(JSON.stringify(attachments))}-->`;
}

export function formatNotificationAttachmentSize(fileSize?: number) {
  if (!Number.isFinite(fileSize) || !fileSize || fileSize <= 0) return "";
  if (fileSize < 1024) return `${fileSize} B`;
  if (fileSize < 1024 * 1024) return `${(fileSize / 1024).toFixed(1)} KB`;
  return `${(fileSize / 1024 / 1024).toFixed(1)} MB`;
}
