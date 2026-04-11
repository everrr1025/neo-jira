import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { notifyCommentMentions } from "@/lib/notifications";

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

    const userId = (session.user as any).id as string;
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const resolvedParams = await params;
    
    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        issueId: resolvedParams.id,
        authorId: userId,
      },
      include: { author: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    const issue = await prisma.issue.findUnique({
      where: { id: resolvedParams.id },
      select: { key: true, projectId: true },
    });
    if (issue) {
      await notifyCommentMentions({
        actorId: userId,
        issueId: resolvedParams.id,
        issueKey: issue.key,
        projectId: issue.projectId,
        content,
      });
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Failed to create comment:", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
