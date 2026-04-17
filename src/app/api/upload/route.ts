// Test deployment trigger
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { promises as fs } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const issueId = formData.get("issueId") as string;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/uploads
    const uploadDir = path.join(process.cwd(), "public/uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const filePath = path.join(uploadDir, uniqueFilename);
    const fileUrl = `/uploads/${uniqueFilename}`;

    await fs.writeFile(filePath, buffer);

    if (issueId) {
      const attachment = await prisma.$transaction(async (tx) => {
        const createdAttachment = await tx.attachment.create({
          data: {
            fileName: file.name,
            fileUrl: fileUrl,
            issueId: issueId,
            uploaderId: userId,
          },
          include: {
            uploader: { select: { id: true, name: true } },
            issue: { select: { projectId: true } },
          },
        });

        await createAuditLogs(tx, [
          {
            issueId: createdAttachment.issueId,
            projectId: createdAttachment.issue.projectId,
            entityType: "ATTACHMENT",
            entityId: createdAttachment.id,
            action: "CREATE",
            actorId: userId,
            metadata: { fileName: createdAttachment.fileName },
          },
        ]);

        return createdAttachment;
      });

      return NextResponse.json(
        {
          id: attachment.id,
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl,
          issueId: attachment.issueId,
          uploaderId: attachment.uploaderId,
          createdAt: attachment.createdAt,
          uploader: attachment.uploader,
        },
        { status: 201 },
      );
    } else {
      return NextResponse.json({ fileName: file.name, fileUrl: fileUrl }, { status: 201 });
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { fileUrl } = await request.json();
    if (!fileUrl || !fileUrl.startsWith("/uploads/")) {
      return NextResponse.json({ error: "Invalid file URL" }, { status: 400 });
    }

    const fileName = fileUrl.substring("/uploads/".length);
    const filePath = path.join(process.cwd(), "public/uploads", fileName);

    try {
      await fs.unlink(filePath);
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("Failed to delete local file:", err);
      return NextResponse.json({ error: "File not found or already deleted" }, { status: 404 });
    }
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
