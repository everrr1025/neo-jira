import prisma from "@/lib/prisma";

export async function parseMentionsAndNotify(content: string, issueId: string, actorId: string, issueKey: string) {
  const mentionRegex = /(?:\s|^)@([^\s]+)/g;
  let match;
  const mentionedNames = [];
  while ((match = mentionRegex.exec(content)) !== null) {
    mentionedNames.push(match[1]);
  }

  if (mentionedNames.length === 0) return;

  const users = await prisma.user.findMany();
  const mentionedUserIds = new Set<string>();
  
  for (const name of mentionedNames) {
    const user = users.find(u => u.name?.toLowerCase() === name.toLowerCase() || u.name?.toLowerCase().startsWith(name.toLowerCase()));
    if (user && user.id !== actorId) {
      mentionedUserIds.add(user.id);
    }
  }

  for (const userId of mentionedUserIds) {
    await prisma.notification.create({
      data: {
        type: "MENTION",
        message: `mentioned you in ${issueKey}`,
        link: `/issues/${issueId}`,
        userId: userId,
        actorId: actorId,
      }
    });
  }
}
