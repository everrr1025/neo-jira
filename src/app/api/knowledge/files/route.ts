import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { knowledgeAccess, KnowledgeError } from "@/lib/knowledge";
import { knowledgeFileUrl } from "@/lib/knowledgeContent";
import { detectKnowledgeMime, knowledgeUploadLimit, removeKnowledgeFile, writeKnowledgeFile } from "@/lib/knowledgeStorage";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let writtenKey: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    const limit = knowledgeUploadLimit();
    const requestLimit = limit + 1024 * 1024;
    if (Number(request.headers.get("content-length")) > requestLimit) return NextResponse.json({ error: "文件超出上传大小限制" }, { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "缺少文件" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > requestLimit) { await reader.cancel(); return NextResponse.json({ error: "文件超出上传大小限制" }, { status: 413 }); }
      chunks.push(chunk.value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const projectId = String(form.get("projectId") || "");
    const file = form.get("file");
    if (!(file instanceof File) || !file.name || file.name.length > 200 || file.size > limit || !file.size) return NextResponse.json({ error: "文件为空、名称过长或大小超限" }, { status: 400 });
    const access = await knowledgeAccess(prisma, projectId, userId);
    if (!access.canCreate) throw new KnowledgeError("FORBIDDEN", "没有上传权限");
    const id = randomUUID();
    const key = `projects/${projectId}/assets/${id}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = detectKnowledgeMime(bytes);
    await writeKnowledgeFile(key, bytes);
    writtenKey = key;
    await prisma.$transaction(async (tx) => {
      if (!(await knowledgeAccess(tx, projectId, userId)).canCreate) throw new KnowledgeError("FORBIDDEN", "没有上传权限");
      await tx.fileAsset.create({ data: { id, projectId, fileName: file.name, fileSize: BigInt(file.size), mimeType, uploaderId: userId, storageKey: key, storageType: "KNOWLEDGE", state: "PENDING", cleanupAfter: new Date(Date.now() + 86400_000), fileUrl: knowledgeFileUrl(id) } });
    });
    writtenKey = null;
    return NextResponse.json({ id, fileName: file.name, fileSize: file.size, mimeType, fileUrl: knowledgeFileUrl(id) }, { status: 201 });
  } catch (error) {
    if (writtenKey) await removeKnowledgeFile(writtenKey).catch(console.error);
    if (error instanceof KnowledgeError) return NextResponse.json({ error: error.message }, { status: error.code === "FORBIDDEN" ? 403 : 400 });
    console.error("Knowledge upload failed", error);
    return NextResponse.json({ error: "上传失败，请重试" }, { status: 500 });
  }
}
