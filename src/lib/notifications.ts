import prisma from "@/lib/prisma";

type MentionNotificationParams = {
  actorId: string;
  issueId: string;
  issueKey: string;
  projectId: string;
  content: string;
  previousContent?: string | null;
};

type NotificationPayload = {
  type: string;
  message: string;
  issueId?: string;
  link?: string;
  actorId: string;
};

function stripRichText(content: string) {
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMentionPattern(name: string) {
  return new RegExp(
    `(?:^|\\s)@${escapeRegex(name)}(?=$|[\\s.,!?;:，。！；（）()\\[\\]{}])`,
    "i"
  );
}

async function resolveMentionedUserIds(content: string, projectId: string, actorId: string) {
  const normalizedContent = stripRichText(content);
  if (!normalizedContent) {
    return new Set<string>();
  }

  const projectMembers = await prisma.user.findMany({
    where: {
      projectMemberships: {
        some: {
          projectId,
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const mentionedUserIds = new Set<string>();

  for (const member of projectMembers) {
    const memberName = member.name?.trim();

    if (!memberName || member.id === actorId) {
      continue;
    }

    if (buildMentionPattern(memberName).test(normalizedContent)) {
      mentionedUserIds.add(member.id);
    }
  }

  return mentionedUserIds;
}

async function createNotifications(
  userIds: Iterable<string>,
  { type, message, issueId, actorId }: NotificationPayload
) {
  const notificationPayload = Array.from(new Set(userIds)).map((userId) => ({
    type,
    message,
    link: issueId ? `/issues/${issueId}` : null,
    userId,
    actorId,
  }));

  if (notificationPayload.length === 0) {
    return;
  }

  await prisma.notification.createMany({
    data: notificationPayload,
  });
}

async function createLinkNotifications(
  userIds: Iterable<string>,
  { type, message, link, actorId }: NotificationPayload
) {
  const notificationPayload = Array.from(new Set(userIds)).map((userId) => ({
    type,
    message,
    link: link || null,
    userId,
    actorId,
  }));

  if (notificationPayload.length === 0) {
    return;
  }

  await prisma.notification.createMany({
    data: notificationPayload,
  });
}

export async function notifyCommentMentions({
  actorId,
  issueId,
  issueKey,
  projectId,
  content,
  previousContent,
}: MentionNotificationParams) {
  const mentionedUserIds = await resolveMentionedUserIds(content, projectId, actorId);

  if (previousContent) {
    const previousMentionedUserIds = await resolveMentionedUserIds(previousContent, projectId, actorId);
    for (const userId of previousMentionedUserIds) {
      mentionedUserIds.delete(userId);
    }
  }

  await createNotifications(mentionedUserIds, {
    type: "MENTION",
    message: `mentioned you in a comment on ${issueKey}`,
    issueId,
    actorId,
  });

  return mentionedUserIds;
}

export async function notifyIssueMentions({
  actorId,
  issueId,
  issueKey,
  projectId,
  content,
  previousContent,
}: MentionNotificationParams) {
  const mentionedUserIds = await resolveMentionedUserIds(content, projectId, actorId);

  if (previousContent) {
    const previousMentionedUserIds = await resolveMentionedUserIds(previousContent, projectId, actorId);
    for (const userId of previousMentionedUserIds) {
      mentionedUserIds.delete(userId);
    }
  }

  await createNotifications(mentionedUserIds, {
    type: "MENTION",
    message: `mentioned you in ${issueKey}`,
    issueId,
    actorId,
  });

  return mentionedUserIds;
}

export async function notifyIssueWatchers({
  actorId,
  issueId,
  message,
  excludeUserIds = [],
}: {
  actorId: string;
  issueId: string;
  message: string;
  excludeUserIds?: string[];
}) {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: {
      watchers: {
        select: { id: true },
      },
    },
  });

  if (!issue) {
    return;
  }

  const excluded = new Set<string>([actorId, ...excludeUserIds]);
  const watcherIds = issue.watchers.map((watcher) => watcher.id).filter((userId) => !excluded.has(userId));

  await createNotifications(watcherIds, {
    type: "WATCHER",
    message,
    issueId,
    actorId,
  });
}

export async function notifyAssignedUser({
  actorId,
  assigneeId,
  issueId,
  issueKey,
}: {
  actorId: string;
  assigneeId: string | null | undefined;
  issueId: string;
  issueKey: string;
}) {
  if (!assigneeId || assigneeId === actorId) {
    return;
  }

  await createNotifications([assigneeId], {
    type: "ASSIGNMENT",
    message: `assigned you to ${issueKey}`,
    issueId,
    actorId,
  });
}

export async function notifyMeetingAttendees({
  actorId,
  attendeeIds,
  title,
  departmentId,
  locale = "zh",
}: {
  actorId: string;
  attendeeIds: string[];
  title: string;
  departmentId: string;
  locale?: "en" | "zh";
}) {
  const targetIds = attendeeIds.filter((userId) => userId !== actorId);
  await createLinkNotifications(targetIds, {
    type: "MEETING",
    message: locale === "zh" ? `邀请你参加会议：${title}` : `invited you to meeting: ${title}`,
    link: `/departments/${departmentId}/items?tab=schedule`,
    actorId,
  });
}
