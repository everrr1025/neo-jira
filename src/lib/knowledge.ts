import { randomUUID } from "node:crypto";
import type { KnowledgeItem, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import prisma from "./prisma";
import { buildVisibleDepartmentProjectsWhere } from "./departmentPermissions";
import { cleanKnowledgeContent } from "./knowledgeContent";

type DB = Prisma.TransactionClient;
export class KnowledgeError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INVALID", message: string) { super(message); }
}
export type KnowledgeAccess = { userId: string; canCreate: boolean; canManage: boolean };
export async function knowledgeAccess(db: DB, projectId: string, userId: string): Promise<KnowledgeAccess> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { disabledAt: true } });
  const project = await db.project.findFirst({
    where: { id: projectId, ...buildVisibleDepartmentProjectsWhere(userId) },
    select: { ownerId: true, members: { where: { userId }, select: { role: true } }, department: { select: { members: { where: { userId }, select: { isDepartmentAdmin: true } } } } },
  });
  if (!user || user.disabledAt || !project) throw new KnowledgeError("FORBIDDEN", "没有此项目的访问权限");
  const canManage = project.ownerId === userId || project.members.some((m) => m.role === "ADMIN") || !!project.department?.members.some((m) => m.isDepartmentAdmin);
  return { userId, canManage, canCreate: canManage || project.members.length > 0 };
}

export function canEditKnowledge(item: Pick<KnowledgeItem, "creatorId">, access: KnowledgeAccess) {
  return access.canManage || item.creatorId === access.userId;
}
async function assertEdit(db: DB, item: KnowledgeItem, access: KnowledgeAccess) {
  if (!canEditKnowledge(item, access)) throw new KnowledgeError("FORBIDDEN", "仅作者或管理员可修改");
  if (item.type === "FOLDER" && !access.canManage && await db.knowledgeItem.count({ where: { parentId: item.id } })) {
    throw new KnowledgeError("FORBIDDEN", "非空文件夹仅管理员可管理");
  }
}

const title = z.string().trim().min(1).max(200);
export const knowledgeSaveSchema = z.object({
  projectId: z.string().min(1), id: z.string().optional(), version: z.number().int().positive().optional(),
  parentId: z.string().nullable(), type: z.enum(["FOLDER", "DOCUMENT", "FILE"]), title,
  contentHtml: z.string().max(2_000_000).default(""), fileAssetId: z.string().nullable().optional(),
  attachments: z.array(z.object({ fileAssetId: z.string(), displayName: title })).max(100).default([]),
});
export type KnowledgeSaveInput = z.input<typeof knowledgeSaveSchema>;

async function validParent(db: DB, projectId: string, parentId: string | null, itemId?: string) {
  let cursor = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === itemId || seen.has(cursor)) throw new KnowledgeError("INVALID", "不能将文件夹移动到自身或子目录");
    seen.add(cursor);
    const parent = await db.knowledgeItem.findFirst({ where: { id: cursor, projectId, type: "FOLDER", deletedAt: null } });
    if (!parent) throw new KnowledgeError("INVALID", "目标文件夹不存在或不属于此项目");
    cursor = parent.parentId;
  }
}

async function audit(db: DB, projectId: string, id: string, action: string, userId: string, title: string) {
  const actor = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  await db.auditLog.create({ data: {
    projectId, entityType: "KNOWLEDGE", entityId: id, action, actorId: userId,
    metadata: JSON.stringify({ title }), targetNameSnapshot: title,
    actorNameSnapshot: actor?.name || actor?.email, actorEmailSnapshot: actor?.email,
  } });
}

export async function markKnowledgeOrphans(db: DB, projectId?: string) {
  await db.fileAsset.updateMany({
    where: { storageType: "KNOWLEDGE", ...(projectId ? { projectId } : {}), state: "READY", cleanupAfter: null, knowledgeItems: { none: {} }, knowledgeAttachments: { none: {} } },
    data: { cleanupAfter: new Date(Date.now() + 86400_000) },
  });
}

async function attachableAssets(db: DB, ids: string[], projectId: string, userId: string) {
  const assets = await db.fileAsset.findMany({ where: { id: { in: [...new Set(ids)] }, projectId, storageType: "KNOWLEDGE", OR: [
    { state: "PENDING", uploaderId: userId, cleanupAfter: { gt: new Date() } },
    { state: "READY", OR: [{ knowledgeItems: { some: { deletedAt: null } } }, { knowledgeAttachments: { some: { document: { deletedAt: null } } } }] },
  ] } });
  if (assets.length !== new Set(ids).size) throw new KnowledgeError("INVALID", "附件已失效、不可引用或不属于此项目");
  return assets;
}

export async function saveKnowledge(input: KnowledgeSaveInput, userId: string, db: PrismaClient = prisma) {
  const data = knowledgeSaveSchema.parse(input);
  return db.$transaction(async (tx) => {
    const access = await knowledgeAccess(tx, data.projectId, userId);
    let existing: KnowledgeItem | null = null;
    if (data.id) {
      existing = await tx.knowledgeItem.findFirst({ where: { id: data.id, projectId: data.projectId, deletedAt: null } });
      if (!existing) throw new KnowledgeError("NOT_FOUND", "内容不存在");
      await assertEdit(tx, existing, access);
      if (existing.type !== data.type) throw new KnowledgeError("INVALID", "不能修改条目类型");
      if (data.version !== existing.version) throw new KnowledgeError("CONFLICT", "内容已被其他人修改，请复制当前内容后重新加载");
    } else if (!access.canCreate) throw new KnowledgeError("FORBIDDEN", "没有新建权限");
    await validParent(tx, data.projectId, data.parentId, data.id);
    const { content, references } = data.type === "DOCUMENT" ? cleanKnowledgeContent(data.contentHtml) : { content: "", references: [] as string[] };
    const attachments = data.type === "DOCUMENT" ? data.attachments : [];
    const fileAssetId = data.type === "FILE" ? (existing?.fileAssetId || data.fileAssetId) : null;
    if (data.type === "FILE" && !fileAssetId) throw new KnowledgeError("INVALID", "请先上传文件");
    const ids = [...references, ...attachments.map((a) => a.fileAssetId), ...(fileAssetId ? [fileAssetId] : [])];
    const assets = await attachableAssets(tx, ids, data.projectId, userId);
    const values = { title: data.title, parentId: data.parentId, contentHtml: content, fileAssetId, updaterId: userId };
    const id = existing?.id || randomUUID();
    if (existing) {
      const result = await tx.knowledgeItem.updateMany({ where: { id, version: data.version, deletedAt: null }, data: { ...values, version: { increment: 1 } } });
      if (!result.count) throw new KnowledgeError("CONFLICT", "内容已更新，请重新加载");
      await tx.knowledgeAttachment.deleteMany({ where: { documentId: id } });
    } else {
      await tx.knowledgeItem.create({ data: { id, projectId: data.projectId, type: data.type, creatorId: userId, ...values } });
    }
    const relations = new Map<string, { fileAssetId: string; usage: string; displayName: string }>();
    for (const assetId of references) relations.set(`INLINE:${assetId}`, { fileAssetId: assetId, usage: "INLINE", displayName: assets.find((a) => a.id === assetId)!.fileName });
    for (const attachment of attachments) relations.set(`ATTACHMENT:${attachment.fileAssetId}`, { ...attachment, usage: "ATTACHMENT" });
    for (const [position, relation] of [...relations.values()].entries()) {
      await tx.knowledgeAttachment.create({ data: { documentId: id, position, ...relation } });
    }
    await tx.fileAsset.updateMany({ where: { id: { in: ids } }, data: { state: "READY", cleanupAfter: null } });
    await markKnowledgeOrphans(tx, data.projectId);
    await audit(tx, data.projectId, id, existing ? existing.parentId !== data.parentId ? "MOVE" : "UPDATE" : "CREATE", userId, data.title);
    return { id, version: (existing?.version || 0) + 1, contentHtml: content };
  });
}

const metadataSchema = z.object({
  projectId: z.string().min(1), id: z.string().min(1), version: z.number().int().positive(),
  action: z.enum(["RENAME", "MOVE"]), title: title.optional(), parentId: z.string().nullable().optional(),
});
export async function updateKnowledgeMetadata(input: z.input<typeof metadataSchema>, userId: string, db: PrismaClient = prisma) {
  const data = metadataSchema.parse(input);
  return db.$transaction(async (tx) => {
    const access = await knowledgeAccess(tx, data.projectId, userId);
    const item = await tx.knowledgeItem.findFirst({ where: { id: data.id, projectId: data.projectId, deletedAt: null } });
    if (!item) throw new KnowledgeError("NOT_FOUND", "内容不存在");
    await assertEdit(tx, item, access);
    if ((data.action === "RENAME" && !data.title) || (data.action === "MOVE" && data.parentId === undefined)) throw new KnowledgeError("INVALID", "请提供名称或目标目录");
    if (data.action === "MOVE") await validParent(tx, data.projectId, data.parentId!, item.id);
    const result = await tx.knowledgeItem.updateMany({
      where: { id: item.id, version: data.version, deletedAt: null },
      data: { ...(data.action === "RENAME" ? { title: data.title } : { parentId: data.parentId }), version: { increment: 1 }, updaterId: userId },
    });
    if (!result.count) throw new KnowledgeError("CONFLICT", "内容已更新，请刷新列表");
    await audit(tx, data.projectId, item.id, data.action === "MOVE" ? "MOVE" : "UPDATE", userId, data.title || item.title);
    return { version: data.version + 1 };
  });
}

export async function setKnowledgeFavorite(projectId: string, itemId: string, favorite: boolean, userId: string, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    await knowledgeAccess(tx, projectId, userId);
    const item = await tx.knowledgeItem.findFirst({ where: { id: itemId, projectId, deletedAt: null }, select: { id: true } });
    if (!item) throw new KnowledgeError("NOT_FOUND", "内容不存在");
    if (favorite) await tx.knowledgeFavorite.upsert({ where: { userId_itemId: { userId, itemId } }, create: { userId, itemId }, update: {} });
    else await tx.knowledgeFavorite.deleteMany({ where: { userId, itemId } });
    return { itemId, favorite };
  });
}

export const knowledgeChangeSchema = z.object({ projectId: z.string(), id: z.string(), version: z.number().int().positive(), action: z.enum(["DELETE", "RESTORE", "PURGE"]), confirmTitle: z.string().optional() });
export async function changeKnowledge(input: z.infer<typeof knowledgeChangeSchema>, userId: string, db: PrismaClient = prisma) {
  const data = knowledgeChangeSchema.parse(input);
  return db.$transaction(async (tx) => {
    const access = await knowledgeAccess(tx, data.projectId, userId);
    const item = await tx.knowledgeItem.findFirst({ where: { id: data.id, projectId: data.projectId } });
    if (!item) throw new KnowledgeError("NOT_FOUND", "内容不存在");
    await assertEdit(tx, item, access);
    if (item.version !== data.version) throw new KnowledgeError("CONFLICT", "内容已更新，请刷新列表");
    if ((data.action === "DELETE") === !!item.deletedAt) throw new KnowledgeError("INVALID", "内容状态已变化，请刷新");
    const all = await tx.knowledgeItem.findMany({ where: { projectId: data.projectId } });
    const ids = new Set([item.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const child of all) if (child.parentId && ids.has(child.parentId) && !ids.has(child.id)) { ids.add(child.id); changed = true; }
    }
    if (data.action === "DELETE") {
      await tx.knowledgeItem.updateMany({ where: { id: { in: [...ids] }, deletedAt: null }, data: { deletedAt: new Date(), deleteBatchId: randomUUID(), version: { increment: 1 }, updaterId: userId } });
    } else if (data.action === "RESTORE") {
      const restoreIds = all.filter((row) => ids.has(row.id) && row.deleteBatchId === item.deleteBatchId).map((row) => row.id);
      const parent = all.find((row) => row.id === item.parentId);
      await tx.knowledgeItem.updateMany({ where: { id: { in: restoreIds } }, data: { deletedAt: null, deleteBatchId: null, version: { increment: 1 }, updaterId: userId } });
      if (!parent || parent.deletedAt) await tx.knowledgeItem.update({ where: { id: item.id }, data: { parentId: null } });
    } else {
      if (!access.canManage || data.confirmTitle !== item.title) throw new KnowledgeError("FORBIDDEN", "永久删除需要管理员输入名称确认");
      if (all.some((row) => ids.has(row.id) && !row.deletedAt)) throw new KnowledgeError("INVALID", "目录仍有有效内容");
      await tx.knowledgeItem.deleteMany({ where: { id: { in: [...ids] } } });
      await markKnowledgeOrphans(tx, data.projectId);
    }
    await audit(tx, data.projectId, item.id, data.action, userId, item.title);
    return { id: item.id };
  });
}

export async function readableKnowledgeAsset(id: string, userId: string, db: DB = prisma) {
  const asset = await db.fileAsset.findFirst({ where: { id, storageType: "KNOWLEDGE", state: { in: ["PENDING", "READY"] } }, include: { knowledgeItems: true, knowledgeAttachments: { include: { document: true } } } });
  if (!asset?.projectId) throw new KnowledgeError("NOT_FOUND", "文件不存在");
  const access = await knowledgeAccess(db, asset.projectId, userId);
  const refs = [...asset.knowledgeItems, ...asset.knowledgeAttachments.map((a) => a.document)];
  const allowed = asset.state === "PENDING"
    ? asset.uploaderId === userId && !!asset.cleanupAfter && asset.cleanupAfter > new Date()
    : refs.some((item) => !item.deletedAt || canEditKnowledge(item, access));
  if (!allowed) throw new KnowledgeError("FORBIDDEN", "无权访问此文件");
  return asset;
}

export async function listKnowledge(projectId: string, userId: string, options: { folderId?: string | null; itemId?: string; search?: string; trash?: boolean; page?: number; filesOnly?: boolean; favorites?: boolean } = {}, db: PrismaClient = prisma) {
  const access = await knowledgeAccess(db, projectId, userId);
  const trash = !!options.trash;
  const search = (options.search || "").trim().slice(0, 200);
  const tree = await db.knowledgeItem.findMany({ where: { projectId, deletedAt: null }, select: { id: true, parentId: true, title: true, type: true, version: true, creatorId: true, _count: { select: { children: true } }, favorites: { where: { userId }, select: { userId: true } } }, orderBy: [{ position: "asc" }, { title: "asc" }] });
  const where: Prisma.KnowledgeItemWhereInput = { projectId, deletedAt: trash ? { not: null } : null,
    ...(options.filesOnly ? { type: "FILE" } : {}),
    ...(options.favorites && !trash ? { favorites: { some: { userId } } } : {}),
    ...(trash && !access.canManage ? { creatorId: userId } : {}),
    ...(search ? { OR: [{ title: { contains: search } }, { fileAsset: { fileName: { contains: search } } }] } : !trash && !options.filesOnly && !options.favorites ? { parentId: options.folderId || null } : {}),
  };
  if (options.folderId && !trash) await validParent(db, projectId, options.folderId);
  const total = await db.knowledgeItem.count({ where });
  const page = Math.max(1, Math.min(Math.ceil(total / 20) || 1, Math.floor(options.page || 1)));
  const include = { favorites: { where: { userId }, select: { userId: true } }, creator: { select: { name: true } }, updater: { select: { name: true } }, fileAsset: true, attachments: { include: { fileAsset: true }, orderBy: { position: "asc" as const } }, _count: { select: { children: true } } };
  const rows = await db.knowledgeItem.findMany({ where, include, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * 20, take: 20 });
  const current = options.itemId ? await db.knowledgeItem.findFirst({ where: { id: options.itemId, projectId, deletedAt: null }, include }) : null;
  if (options.itemId && !current) throw new KnowledgeError("NOT_FOUND", "内容不存在");
  const serialAsset = (asset: NonNullable<typeof current>["fileAsset"]) => asset ? { id: asset.id, fileName: asset.fileName, fileSize: Number(asset.fileSize), mimeType: asset.mimeType, fileUrl: asset.fileUrl } : null;
  const serialItem = (item: (typeof rows)[number]) => ({
    id: item.id, parentId: item.parentId, type: item.type, title: item.title, contentHtml: item.contentHtml, version: item.version,
    creatorId: item.creatorId, creatorName: item.creator?.name || "—", updaterName: item.updater?.name || "—", updatedAt: item.updatedAt.toISOString(), deletedAt: item.deletedAt?.toISOString() || null,
    isFavorite: item.favorites.length > 0,
    canEdit: canEditKnowledge(item, access) && (item.type !== "FOLDER" || access.canManage || item._count.children === 0),
    asset: serialAsset(item.fileAsset), attachments: item.attachments.map((a) => ({ fileAssetId: a.fileAssetId, displayName: a.displayName, usage: a.usage, asset: serialAsset(a.fileAsset)! })),
  });
  return { access, tree: tree.map(({ favorites, _count, creatorId, ...item }) => ({ ...item, isFavorite: favorites.length > 0, canEdit: canEditKnowledge({ creatorId }, access) && (item.type !== "FOLDER" || access.canManage || _count.children === 0) })), rows: rows.map(serialItem), current: current ? serialItem(current) : null, page, total };
}
export type KnowledgePageData = Awaited<ReturnType<typeof listKnowledge>>;
