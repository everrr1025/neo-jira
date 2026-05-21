import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/lib/audit";
import { deleteLocalUpload } from "@/lib/uploadCleanup";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await context.params;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
      select: {
        id: true,
        issueId: true,
        fileName: true,
        fileUrl: true,
        uploaderId: true,
        issue: { select: { projectId: true } },
      },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    if (attachment.uploaderId !== userId) {
      return NextResponse.json({ error: "Only the uploaded user can delete this attachment" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await createAuditLogs(tx, [
        {
          issueId: attachment.issueId,
          projectId: attachment.issue.projectId,
          entityType: "ATTACHMENT",
          entityId: attachment.id,
          action: "DELETE",
          actorId: userId,
          metadata: { fileName: attachment.fileName },
        },
      ]);

      await tx.attachment.delete({
        where: { id },
      });
    });

    await deleteLocalUpload(attachment.fileUrl);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Failed to delete attachment" }, { status: 500 });
  }
}
