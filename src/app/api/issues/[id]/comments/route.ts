import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { notifyCommentMentions, notifyIssueWatchers } from "@/lib/notifications";
import { createAuditLogs, extractAuditTextPreview } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const comments = await prisma.comment.findMany({
      where: { issueId: resolvedParams.id },
      include: { author: { select: { id: true, name: true, email: true, avatar: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const resolvedParams = await params;
    
    const issue = await prisma.issue.findUnique({
      where: { id: resolvedParams.id },
      select: { key: true, projectId: true },
    });

    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    const comment = await prisma.$transaction(async (tx) => {
      const createdComment = await tx.comment.create({
        data: {
          content: content.trim(),
          issueId: resolvedParams.id,
          authorId: userId,
        },
        include: { author: { select: { id: true, name: true, email: true, avatar: true } } },
      });

      await createAuditLogs(tx, [
        {
          issueId: resolvedParams.id,
          projectId: issue.projectId,
          entityType: "COMMENT",
          entityId: createdComment.id,
          action: "CREATE",
          actorId: userId,
          metadata: { preview: extractAuditTextPreview(createdComment.content) },
        },
      ]);

      return createdComment;
    });

    const mentionedUserIds = await notifyCommentMentions({
      actorId: userId,
      issueId: resolvedParams.id,
      issueKey: issue.key,
      projectId: issue.projectId,
      content,
    });

    await notifyIssueWatchers({
      actorId: userId,
      issueId: resolvedParams.id,
      message: `commented on ${issue.key}`,
      excludeUserIds: [...mentionedUserIds],
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Failed to create comment:", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const { commentId, content } = body as { commentId?: string; content?: string };

    if (!commentId) {
      return NextResponse.json({ error: "Comment id is required" }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const resolvedParams = await params;
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        issueId: true,
        authorId: true,
        content: true,
        issue: { select: { projectId: true } },
      },
    });

    if (!existingComment || existingComment.issueId !== resolvedParams.id) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (existingComment.authorId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedComment = await prisma.$transaction(async (tx) => {
      const nextComment = await tx.comment.update({
        where: { id: commentId },
        data: { content: content.trim() },
        include: { author: { select: { id: true, name: true, email: true, avatar: true } } },
      });

      if (existingComment.content.trim() !== nextComment.content.trim()) {
        await createAuditLogs(tx, [
          {
            issueId: resolvedParams.id,
            projectId: existingComment.issue.projectId,
            entityType: "COMMENT",
            entityId: nextComment.id,
            action: "UPDATE",
            actorId: userId,
            metadata: { preview: extractAuditTextPreview(nextComment.content) },
          },
        ]);
      }

      return nextComment;
    });

    const issue = await prisma.issue.findUnique({
      where: { id: resolvedParams.id },
      select: { key: true, projectId: true },
    });

    if (issue) {
      const mentionedUserIds = await notifyCommentMentions({
        actorId: userId,
        issueId: resolvedParams.id,
        issueKey: issue.key,
        projectId: issue.projectId,
        content,
        previousContent: existingComment.content,
      });

      await notifyIssueWatchers({
        actorId: userId,
        issueId: resolvedParams.id,
        message: `updated a comment on ${issue.key}`,
        excludeUserIds: [...mentionedUserIds],
      });
    }

    return NextResponse.json(updatedComment);
  } catch (error) {
    console.error("Failed to update comment:", error);
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { commentId?: string };
    const commentId = body.commentId;

    if (!commentId) {
      return NextResponse.json({ error: "Comment id is required" }, { status: 400 });
    }

    const resolvedParams = await params;
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        issueId: true,
        authorId: true,
        content: true,
        issue: { select: { projectId: true } },
      },
    });

    if (!existingComment || existingComment.issueId !== resolvedParams.id) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (existingComment.authorId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await createAuditLogs(tx, [
        {
          issueId: resolvedParams.id,
          projectId: existingComment.issue.projectId,
          entityType: "COMMENT",
          entityId: existingComment.id,
          action: "DELETE",
          actorId: userId,
          metadata: { preview: extractAuditTextPreview(existingComment.content) },
        },
      ]);

      await tx.comment.delete({
        where: { id: commentId },
      });
    });

    const issue = await prisma.issue.findUnique({
      where: { id: resolvedParams.id },
      select: { key: true },
    });

    if (issue) {
      await notifyIssueWatchers({
        actorId: userId,
        issueId: resolvedParams.id,
        message: `deleted a comment on ${issue.key}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete comment:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
