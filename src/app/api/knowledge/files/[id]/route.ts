import { promises as fs } from "node:fs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { KnowledgeError, readableKnowledgeAsset } from "@/lib/knowledge";
import { knowledgeStoragePath, parseKnowledgeRange } from "@/lib/knowledgeStorage";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'", "Vary": "Cookie" });
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return new Response("Unauthorized", { status: 401, headers });
    const asset = await readableKnowledgeAsset((await params).id, userId);
    if (!asset.storageKey) return new Response("Not found", { status: 404, headers });
    const handle = await fs.open(knowledgeStoragePath(asset.storageKey), "r");
    try {
      const stat = await handle.stat();
      const range = parseKnowledgeRange(request.headers.get("range"), stat.size);
      headers.set("Accept-Ranges", "bytes");
      if (!range) { headers.set("Content-Range", `bytes */${stat.size}`); return new Response(null, { status: 416, headers }); }
      const inline = new URL(request.url).searchParams.get("download") !== "1" && ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"].includes(asset.mimeType || "");
      headers.set("Content-Type", inline ? asset.mimeType! : "application/octet-stream");
      headers.set("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="download"; filename*=UTF-8''${encodeURIComponent(asset.fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`);
      const length = stat.size ? range.end - range.start + 1 : 0;
      const bytes = Buffer.alloc(length);
      let offset = 0;
      while (offset < length) {
        const result = await handle.read(bytes, offset, length - offset, range.start + offset);
        if (!result.bytesRead) throw new Error("Unexpected end of file");
        offset += result.bytesRead;
      }
      headers.set("Content-Length", String(length));
      if (range.partial) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${stat.size}`);
      return new Response(bytes, { status: range.partial ? 206 : 200, headers });
    } finally { await handle.close(); }
  } catch (error) {
    if (error instanceof KnowledgeError) return new Response(error.message, { status: error.code === "FORBIDDEN" ? 403 : 404, headers });
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response("Not found", { status: 404, headers });
    console.error("Knowledge download failed", error);
    return new Response("Download failed", { status: 500, headers });
  }
}
