"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { changeKnowledge, updateKnowledgeMetadata, setKnowledgeFavorite, knowledgeAccess, KnowledgeError, listKnowledge, saveKnowledge, type KnowledgeSaveInput } from "@/lib/knowledge";
import { cleanupKnowledgeFiles } from "@/lib/knowledgeStorage";
import { getRequestedProjectRouteContext } from "@/lib/activeProject";

async function actor() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) throw new KnowledgeError("FORBIDDEN", "请先登录");
  return id;
}
async function perform<T>(projectId: string, operation: (id: string) => Promise<T>, invalidate = false) {
  try {
    const route = await getRequestedProjectRouteContext();
    if (route && (route.projectId !== projectId || !await prisma.project.findFirst({ where: { id: projectId, departmentId: route.departmentId } }))) {
      throw new KnowledgeError("FORBIDDEN", "项目与当前路由不匹配");
    }
    const value = await operation(await actor());
    if (invalidate) revalidatePath("/knowledge", "layout");
    return { success: true as const, value };
  } catch (error) {
    if (error instanceof KnowledgeError) return { success: false as const, code: error.code, error: error.message };
    console.error("Knowledge operation failed", error);
    return { success: false as const, code: "INVALID", error: "操作失败，请检查输入或重试" };
  }
}
export async function saveKnowledgeItem(data: KnowledgeSaveInput) { return perform(data.projectId, (id) => saveKnowledge(data, id), true); }
export async function changeKnowledgeItem(data: Parameters<typeof changeKnowledge>[0]) {
  const result = await perform(data.projectId, (id) => changeKnowledge(data, id), true);
  if (result.success && data.action === "PURGE") void cleanupKnowledgeFiles().catch(console.error);
  return result;
}
export async function loadKnowledge(projectId: string, options: Parameters<typeof listKnowledge>[2]) {
  return perform(projectId, (id) => listKnowledge(projectId, id, options));
}
export async function discardKnowledgeUpload(projectId: string, assetId: string) {
  return perform(projectId, async (userId) => {
    await knowledgeAccess(prisma, projectId, userId);
    await prisma.fileAsset.updateMany({ where: { id: assetId, projectId, uploaderId: userId, storageType: "KNOWLEDGE", state: "PENDING", knowledgeItems: { none: {} }, knowledgeAttachments: { none: {} } }, data: { cleanupAfter: new Date(Date.now() + 86400_000) } });
    return {};
  });
}

export async function updateKnowledgeItemMetadata(data: Parameters<typeof updateKnowledgeMetadata>[0]) {
  return perform(data.projectId, (id) => updateKnowledgeMetadata(data, id), true);
}
export async function favoriteKnowledgeItem(projectId: string, itemId: string, favorite: boolean) {
  return perform(projectId, (id) => setKnowledgeFavorite(projectId, itemId, favorite, id), true);
}
