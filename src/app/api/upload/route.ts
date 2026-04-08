// Test deployment trigger
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { promises as fs } from "fs";
import path from "path";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id as string;
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const issueId = formData.get("issueId") as string;

    if (!file || !issueId) {
      return NextResponse.json({ error: "File and issueId are required" }, { status: 400 });
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

    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.name,
        fileUrl: fileUrl,
        issueId: issueId,
        uploaderId: userId,
      },
      include: { uploader: { select: { id: true, name: true } } },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
