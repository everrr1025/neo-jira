// Test deployment trigger
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { promises as fs } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/lib/audit";
import { deleteLocalUpload } from "@/lib/uploadCleanup";

export async function POST(request: Request) {
  let writtenFileUrl: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionUser = session.user as { id?: string; role?: string };
    const userId = sessionUser.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const issueId = String(formData.get("issueId") || "").trim();
    const requestedDepartmentId = String(formData.get("departmentId") || "").trim();

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    let departmentId: string | null = null;
    if (issueId) {
      const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        select: { project: { select: { departmentId: true } } },
      });
      if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });
      departmentId = issue.project.departmentId;
    } else if (requestedDepartmentId) {
      const canUseDepartment = sessionUser.role === "ADMIN"
        ? Boolean(await prisma.department.findUnique({ where: { id: requestedDepartmentId }, select: { id: true } }))
        : Boolean(await prisma.departmentMember.findUnique({
            where: { departmentId_userId: { departmentId: requestedDepartmentId, userId } },
            select: { id: true },
          }));
      if (!canUseDepartment) return NextResponse.json({ error: "Invalid department" }, { status: 403 });
      departmentId = requestedDepartmentId;
    } else {
      const membership = await prisma.departmentMember.findUnique({
        where: { userId },
        select: { departmentId: true },
      });
      departmentId = membership?.departmentId ?? null;
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
    writtenFileUrl = fileUrl;

    const fileAssetData = {
      fileName: file.name,
      fileUrl,
      fileSize: BigInt(file.size),
      mimeType: file.type || null,
      uploaderId: userId,
      departmentId,
    };

    if (issueId) {
      const attachment = await prisma.$transaction(async (tx) => {
        await tx.fileAsset.create({ data: fileAssetData });
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
          fileSize: file.size,
          mimeType: file.type || null,
        },
        { status: 201 },
      );
    } else {
      await prisma.fileAsset.create({ data: fileAssetData });
      return NextResponse.json({ fileName: file.name, fileUrl, fileSize: file.size, mimeType: file.type || null }, { status: 201 });
    }
  } catch (error) {
    if (writtenFileUrl) await deleteLocalUpload(writtenFileUrl);
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

    await deleteLocalUpload(fileUrl);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
