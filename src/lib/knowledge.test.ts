import assert from "node:assert/strict";
import { mkdtemp, open, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { changeKnowledge, getProjectKnowledgeSummary, knowledgeAccess, listKnowledge, readableKnowledgeAsset, saveKnowledge, updateKnowledgeMetadata, setKnowledgeFavorite } from "./knowledge";
import { cleanKnowledgeContent, knowledgeFileUrl } from "./knowledgeContent";
import { cleanupKnowledgeFiles, detectKnowledgeMime, knowledgeStoragePath, knowledgeStorageRoot, parseKnowledgeRange, writeKnowledgeFile } from "./knowledgeStorage";
import { knowledgeFolderNameError } from "./knowledgeFolderName";
import { knowledgeReturnTarget } from "./knowledgeNavigation";
import { deleteProjectData } from "./projectDataCleanup";

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), "neo-knowledge-test-"));
  const url = `file:${root}/test.db`;
  await (await open(path.join(root, "test.db"), "a")).close();
  process.env.KNOWLEDGE_STORAGE_ROOT = path.join(root, "private");
  execFileSync(path.resolve("node_modules/.bin/prisma"), ["migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  const db = new PrismaClient({ datasources: { db: { url } } });
  assert.deepEqual(knowledgeReturnTarget("/knowledge?search=hello&favorites=1&from=other", "/knowledge"), { href: "/knowledge?search=hello&favorites=1", kind: "search" });
  assert.deepEqual(knowledgeReturnTarget("/knowledge?folder=abc", "/knowledge"), { href: "/knowledge?folder=abc", kind: "list" });
  assert.equal(knowledgeReturnTarget("https://evil.test/knowledge", "/knowledge"), null);
  assert.equal(knowledgeReturnTarget("//evil.test/knowledge", "/knowledge"), null);
  assert.equal(knowledgeReturnTarget("/other-project/knowledge", "/knowledge"), null);
  assert.equal(knowledgeReturnTarget(null, "/knowledge"), null);
  const overview = "/departments/dept/projects/project";
  assert.deepEqual(knowledgeReturnTarget(overview, `${overview}/knowledge`), { href: overview, kind: "overview" });
  assert.deepEqual(knowledgeReturnTarget(`${overview}?knowledge=favorites`, `${overview}/knowledge`), { href: `${overview}?knowledge=favorites`, kind: "overview" });
  assert.equal(knowledgeReturnTarget("/departments/dept/projects/other", `${overview}/knowledge`), null);
  let checks = 0;
  const check = (label: string) => { checks++; console.log(`✓ ${label}`); };
  const denied = (fn: () => Promise<unknown>, code = "FORBIDDEN") => assert.rejects(fn, (e: unknown) => (e as { code: string }).code === code);
  try {
    for (const id of ["owner", "author", "member", "manager", "dept-admin", "viewer", "outsider", "global"]) {
      await db.user.create({ data: { id, email: `${id}@knowledge.test`, name: id, role: id === "global" ? "ADMIN" : "USER" } });
    }
    await db.department.create({ data: { id: "dept", name: "Knowledge test", key: "KT" } });
    await db.fileAsset.create({ data: { id: "legacy-file", fileName: "legacy.txt", fileUrl: "/uploads/legacy.txt", fileSize: BigInt(3), departmentId: "dept" } });
    for (const userId of ["dept-admin", "viewer"]) await db.departmentMember.create({ data: { departmentId: "dept", userId, isDepartmentAdmin: userId === "dept-admin", projectScopeType: "ALL_PROJECTS" } });
    for (const id of ["project", "other"]) await db.project.create({ data: { id, name: id, key: id, departmentId: "dept", ownerId: "owner" } });
    for (const userId of ["author", "member", "manager"]) await db.projectMember.create({ data: { projectId: "project", userId, role: userId === "manager" ? "ADMIN" : "MEMBER" } });
    for (const userId of ["owner", "manager", "dept-admin"]) assert.equal((await knowledgeAccess(db, "project", userId)).canManage, true);
    assert.equal((await knowledgeAccess(db, "project", "author")).canCreate, true);
    assert.equal((await knowledgeAccess(db, "project", "viewer")).canCreate, false);
    await denied(() => knowledgeAccess(db, "project", "global"));
    await denied(() => knowledgeAccess(db, "project", "outsider"));
    check("project permissions do not grant global admin implicit read access");

    const create = (type: "FOLDER" | "DOCUMENT", title: string, parentId: string | null = null, user = "author") => saveKnowledge({ projectId: "project", type, title, parentId }, user, db);
    const invalidFolderNames = ["产品/设计", "产品\\设计", ".", " .. ", "资料\n归档", "资料\t归档", "\n资料", "资料\t", `资料${String.fromCharCode(0)}`, `资料${String.fromCharCode(127)}`, `资料${String.fromCharCode(159)}`];
    for (const name of invalidFolderNames) {
      assert.ok(knowledgeFolderNameError(name));
      await denied(() => create("FOLDER", name), "INVALID");
    }
    for (const name of ["中文 Design 2026", "v1.0", ".notes", "资料：Q&A (设计) 🙂"]) assert.equal(knowledgeFolderNameError(name), null);
    const folder = await create("FOLDER", "Folder");
    for (const name of invalidFolderNames) {
      await denied(() => updateKnowledgeMetadata({ projectId: "project", id: folder.id, version: 1, action: "RENAME", title: name }, "author", db), "INVALID");
      await denied(() => saveKnowledge({ projectId: "project", id: folder.id, version: 1, type: "FOLDER", title: name, parentId: null }, "author", db), "INVALID");
    }
    assert.equal((await db.knowledgeItem.findUniqueOrThrow({ where: { id: folder.id } })).version, 1);
    const unrestrictedDoc = await create("DOCUMENT", "API / v1");
    await updateKnowledgeMetadata({ projectId: "project", id: unrestrictedDoc.id, version: 1, action: "RENAME", title: "API / v2" }, "author", db);
    check("folder names reject separators, control characters and dot-only names on create and rename without restricting document titles");
    const doc = await create("DOCUMENT", "Document", folder.id);
    await denied(() => create("DOCUMENT", "Forbidden", null, "viewer"));
    await denied(() => saveKnowledge({ projectId: "project", id: doc.id, version: 1, type: "DOCUMENT", title: "No", parentId: folder.id }, "member", db));
    const update = { projectId: "project", id: doc.id, version: 1, type: "DOCUMENT" as const, title: "Updated", parentId: folder.id, contentHtml: '<p onclick="evil()">Hello<script>alert(1)</script><img src="https://evil.test/a"><a href="javascript:evil()">bad</a></p>' };
    await saveKnowledge(update, "author", db);
    await denied(() => saveKnowledge(update, "author", db), "CONFLICT");
    const persisted = await db.knowledgeItem.findUniqueOrThrow({ where: { id: doc.id } });
    assert.equal(persisted.version, 2);
    assert.ok(!/script|onclick|evil\.test/.test(persisted.contentHtml));
    check("author edit, HTML sanitization and stale-version rejection");

    const nested = await create("FOLDER", "Nested", folder.id);
    await denied(() => saveKnowledge({ projectId: "project", id: folder.id, version: 1, type: "FOLDER", title: "Folder", parentId: nested.id }, "owner", db), "INVALID");
    await denied(() => changeKnowledge({ projectId: "project", id: folder.id, version: 1, action: "DELETE" }, "author", db));
    const foreign = await saveKnowledge({ projectId: "other", type: "FOLDER", title: "Foreign", parentId: null }, "owner", db);
    await denied(() => create("DOCUMENT", "Cross project", foreign.id), "INVALID");
    check("nonempty folder protection, cycles and cross-project moves");

    const asset = async (id: string, projectId = "project", uploaderId = "author") => {
      const storageKey = `projects/${projectId}/assets/${id}`;
      await writeKnowledgeFile(storageKey, Buffer.from("%PDF-test"));
      return db.fileAsset.create({ data: { id, projectId, uploaderId, storageKey, storageType: "KNOWLEDGE", state: "PENDING", cleanupAfter: new Date(Date.now() + 86400_000), fileName: `${id}.pdf`, fileUrl: knowledgeFileUrl(id), fileSize: BigInt(9), mimeType: "application/pdf" } });
    };
    await asset("shared");
    await readableKnowledgeAsset("shared", "author", db);
    await denied(() => readableKnowledgeAsset("shared", "member", db));
    const file = await saveKnowledge({ projectId: "project", type: "FILE", title: "Shared PDF", parentId: folder.id, fileAssetId: "shared" }, "author", db);
    await readableKnowledgeAsset("shared", "viewer", db);
    await denied(() => readableKnowledgeAsset("shared", "outsider", db));
    const referenced = await saveKnowledge({ projectId: "project", type: "DOCUMENT", title: "References", parentId: null, contentHtml: '<p><a href="/api/knowledge/files/shared">PDF</a></p>', attachments: [{ fileAssetId: "shared", displayName: "PDF" }] }, "member", db);
    assert.equal(await db.knowledgeAttachment.count({ where: { documentId: referenced.id } }), 2);
    const detail = await listKnowledge("project", "viewer", { itemId: referenced.id }, db);
    assert.equal(detail.current?.attachments.length, 2);
    assert.ok(detail.current?.contentHtml);
    await asset("foreign", "other", "owner");
    await denied(() => saveKnowledge({ projectId: "project", type: "DOCUMENT", title: "Invalid ref", parentId: null, contentHtml: '<img src="/api/knowledge/files/foreign">' }, "author", db), "INVALID");
    check("pending-file privacy, shared resource references and cross-project rejection");

    const picker = await listKnowledge("project", "member", { filesOnly: true }, db);
    assert.equal(picker.rows[0].id, file.id);
    const results = await listKnowledge("project", "viewer", { search: "Updated" }, db);
    assert.equal(results.rows[0].parentId, folder.id);
    check("project-wide search and file picker include nested files");

    const metadataDoc = await saveKnowledge({ projectId: "project", type: "DOCUMENT", title: "Metadata test", parentId: null, contentHtml: "<p>Keep this body</p>", attachments: [{ fileAssetId: "shared", displayName: "Keep attachment" }] }, "member", db);
    const metadataInput = { projectId: "project", id: metadataDoc.id, version: 1, action: "RENAME" as const, title: "Renamed metadata" };
    await denied(() => updateKnowledgeMetadata(metadataInput, "author", db));
    await updateKnowledgeMetadata(metadataInput, "member", db);
    await denied(() => updateKnowledgeMetadata(metadataInput, "member", db), "CONFLICT");
    await denied(() => updateKnowledgeMetadata({ ...metadataInput, version: 2, action: "MOVE", parentId: foreign.id }, "member", db), "INVALID");
    await updateKnowledgeMetadata({ ...metadataInput, version: 2, action: "MOVE", parentId: folder.id }, "member", db);
    const metadataItem = await db.knowledgeItem.findUniqueOrThrow({ where: { id: metadataDoc.id }, include: { attachments: true } });
    assert.equal(metadataItem.title, "Renamed metadata");
    assert.equal(metadataItem.parentId, folder.id);
    assert.equal(metadataItem.contentHtml, "<p>Keep this body</p>");
    assert.equal(metadataItem.attachments[0].displayName, "Keep attachment");
    await denied(() => updateKnowledgeMetadata({ projectId: "project", id: folder.id, version: 1, action: "MOVE", parentId: nested.id }, "owner", db), "INVALID");
    check("metadata edits preserve body and attachments, enforce ownership, versions and directory constraints");

    await setKnowledgeFavorite("project", metadataDoc.id, true, "viewer", db);
    await setKnowledgeFavorite("project", metadataDoc.id, true, "viewer", db);
    await setKnowledgeFavorite("project", folder.id, true, "viewer", db);
    await setKnowledgeFavorite("project", file.id, true, "viewer", db);
    await setKnowledgeFavorite("project", metadataDoc.id, true, "member", db);
    assert.equal((await listKnowledge("project", "viewer", { favorites: true }, db)).total, 3);
    assert.equal((await listKnowledge("project", "author", { favorites: true }, db)).total, 0);
    assert.equal((await listKnowledge("project", "viewer", { favorites: true, search: "Renamed" }, db)).rows[0].id, metadataDoc.id);
    const favoriteTree = (await listKnowledge("project", "viewer", {}, db)).tree;
    assert.equal(favoriteTree.find((item) => item.id === metadataDoc.id)?.isFavorite, true);
    assert.equal(favoriteTree.find((item) => item.id === metadataDoc.id)?.canEdit, false);
    await setKnowledgeFavorite("project", metadataDoc.id, false, "member", db);
    assert.equal((await listKnowledge("project", "viewer", { favorites: true }, db)).total, 3);
    await denied(() => setKnowledgeFavorite("project", metadataDoc.id, true, "outsider", db));
    await denied(() => setKnowledgeFavorite("other", metadataDoc.id, true, "owner", db), "NOT_FOUND");
    const afterFavorite = await db.knowledgeItem.findUniqueOrThrow({ where: { id: metadataDoc.id } });
    assert.equal(afterFavorite.version, metadataItem.version);
    assert.equal(afterFavorite.updatedAt.getTime(), metadataItem.updatedAt.getTime());
    await changeKnowledge({ projectId: "project", id: metadataDoc.id, version: 3, action: "DELETE" }, "member", db);
    assert.equal((await listKnowledge("project", "viewer", { favorites: true }, db)).total, 2);
    await denied(() => setKnowledgeFavorite("project", metadataDoc.id, true, "viewer", db), "NOT_FOUND");
    await changeKnowledge({ projectId: "project", id: metadataDoc.id, version: 4, action: "RESTORE" }, "member", db);
    assert.equal((await listKnowledge("project", "viewer", { favorites: true }, db)).total, 3);
    await changeKnowledge({ projectId: "project", id: metadataDoc.id, version: 5, action: "DELETE" }, "member", db);
    await changeKnowledge({ projectId: "project", id: metadataDoc.id, version: 6, action: "PURGE" }, "owner", db);
    assert.equal(await db.knowledgeFavorite.count({ where: { itemId: metadataDoc.id } }), 0);
    await setKnowledgeFavorite("project", file.id, false, "viewer", db);
    check("personal favorites are isolated, idempotent, preserve shared metadata, hide trash and cascade on purge");


    await changeKnowledge({ projectId: "project", id: doc.id, version: 2, action: "DELETE" }, "author", db);
    await changeKnowledge({ projectId: "project", id: folder.id, version: 1, action: "DELETE" }, "owner", db);
    await changeKnowledge({ projectId: "project", id: folder.id, version: 2, action: "RESTORE" }, "owner", db);
    assert.ok((await db.knowledgeItem.findUniqueOrThrow({ where: { id: doc.id } })).deletedAt);
    assert.equal((await db.knowledgeItem.findUniqueOrThrow({ where: { id: nested.id } })).deletedAt, null);
    await changeKnowledge({ projectId: "project", id: folder.id, version: 3, action: "DELETE" }, "owner", db);
    await changeKnowledge({ projectId: "project", id: doc.id, version: 3, action: "RESTORE" }, "author", db);
    assert.equal((await db.knowledgeItem.findUniqueOrThrow({ where: { id: doc.id } })).parentId, null);
    await denied(() => changeKnowledge({ projectId: "project", id: folder.id, version: 4, action: "PURGE" }, "author", db));
    await changeKnowledge({ projectId: "project", id: folder.id, version: 4, action: "PURGE" }, "owner", db);
    await cleanupKnowledgeFiles(db, new Date(Date.now() + 2 * 86400_000));
    await readableKnowledgeAsset("shared", "viewer", db);
    check("delete batches restore only their members, missing parents restore to root, live references survive purge");

    await changeKnowledge({ projectId: "project", id: referenced.id, version: 1, action: "DELETE" }, "member", db);
    await denied(() => readableKnowledgeAsset("shared", "viewer", db));
    await readableKnowledgeAsset("shared", "member", db);
    await cleanupKnowledgeFiles(db, new Date(Date.now() + 3 * 86400_000));
    assert.ok(await db.fileAsset.findUnique({ where: { id: "shared" } }));
    await changeKnowledge({ projectId: "project", id: referenced.id, version: 2, action: "PURGE" }, "owner", db);
    assert.ok((await db.fileAsset.findUniqueOrThrow({ where: { id: "shared" } })).cleanupAfter);
    await cleanupKnowledgeFiles(db, new Date(Date.now() + 3 * 86400_000));
    assert.equal(await db.fileAsset.findUnique({ where: { id: "shared" } }), null);
    check("trash permissions and reference-aware physical cleanup");

    await asset("retry");
    await db.fileAsset.update({ where: { id: "retry" }, data: { state: "DELETE_PENDING" } });
    const configuredRoot = process.env.KNOWLEDGE_STORAGE_ROOT;
    process.env.KNOWLEDGE_STORAGE_ROOT = "/dev/null";
    const failed = await cleanupKnowledgeFiles(db);
    assert.equal(failed.failed, 1);
    process.env.KNOWLEDGE_STORAGE_ROOT = configuredRoot;
    assert.equal((await cleanupKnowledgeFiles(db)).removed, 1);
    check("physical delete failure remains retryable");

    await db.project.create({ data: { id: "summary-project", name: "Summary", key: "SUM", departmentId: "dept", ownerId: "owner", members: { create: { userId: "author" } } } });
    for (let index = 0; index < 7; index++) {
      await db.knowledgeItem.create({ data: { id: `summary-${index}`, projectId: "summary-project", title: `Summary ${index}`, type: index % 2 ? "DOCUMENT" : "FILE", updatedAt: new Date(Date.UTC(2020, 0, 1, 0, index)) } });
    }
    await db.knowledgeItem.create({ data: { id: "summary-folder", projectId: "summary-project", title: "Excluded folder", type: "FOLDER" } });
    await db.knowledgeItem.create({ data: { id: "summary-trash", projectId: "summary-project", title: "Excluded trash", type: "DOCUMENT", deletedAt: new Date() } });
    await db.knowledgeFavorite.createMany({ data: [0, 1, 2, 3, 4, 5].map((index) => ({ itemId: `summary-${index}`, userId: "author" })).concat([{ itemId: "summary-folder", userId: "author" }, { itemId: "summary-trash", userId: "author" }, { itemId: "summary-6", userId: "viewer" }]) });
    const summary = await getProjectKnowledgeSummary("summary-project", "author", db);
    assert.deepEqual(summary.recent.map((item) => item.id), [6, 5, 4, 3, 2].map((index) => `summary-${index}`));
    assert.deepEqual(summary.favorites.map((item) => item.id), [5, 4, 3, 2, 1].map((index) => `summary-${index}`));
    assert.deepEqual(Object.keys(summary.recent[0]).sort(), ["id", "title", "type", "updatedAt"]);
    assert.deepEqual((await getProjectKnowledgeSummary("summary-project", "viewer", db)).favorites.map((item) => item.id), ["summary-6"]);
    assert.equal((await getProjectKnowledgeSummary("summary-project", "owner", db)).favorites.length, 0);
    await denied(() => getProjectKnowledgeSummary("summary-project", "outsider", db));
    await db.project.create({ data: { id: "summary-empty", name: "Empty", key: "EMPTY", departmentId: "dept", ownerId: "owner" } });
    assert.deepEqual(await getProjectKnowledgeSummary("summary-empty", "owner", db), { recent: [], favorites: [] });
    check("project knowledge summaries return five lightweight recent and personal favorite materials, excluding folders, trash and unauthorized projects");

    await db.projectMember.delete({ where: { userId_projectId: { userId: "author", projectId: "project" } } });
    await denied(() => saveKnowledge({ ...update, version: 4 }, "author", db));
    await db.projectMember.delete({ where: { userId_projectId: { userId: "author", projectId: "summary-project" } } });
    await db.user.delete({ where: { id: "author" } });
    assert.equal((await db.knowledgeItem.findUniqueOrThrow({ where: { id: doc.id } })).creatorId, null);
    check("former authors lose access; deleting users preserves documents");

    for (let index = 0; index < 52; index++) await create("DOCUMENT", `Page ${index}`, null, "owner");
    assert.equal((await listKnowledge("project", "viewer", { search: "Page", page: 2 }, db)).rows.length, 2);
    const pageFolder = await create("FOLDER", "Page folder", null, "owner");
    await db.knowledgeItem.update({ where: { id: pageFolder.id }, data: { updatedAt: new Date(0) } });
    const firstPage = await listKnowledge("project", "viewer", { search: "Page" }, db);
    const secondPage = await listKnowledge("project", "viewer", { search: "Page", page: 2 }, db);
    assert.equal(firstPage.rows[0].id, pageFolder.id);
    assert.equal(firstPage.pageSize, 50);
    assert.ok(firstPage.rows.every((item) => !("contentHtml" in item) && !("attachments" in item)));
    assert.equal((await listKnowledge("project", "viewer", { search: "Page", pageSize: 20 }, db)).rows.length, 20);
    assert.equal(firstPage.rows.length, 50);
    assert.equal(secondPage.rows.length, 3);
    const window = await listKnowledge("project", "viewer", { search: "Page", page: 2, fromStart: true }, db);
    assert.equal(window.page, 2);
    assert.equal(window.rows.length, 53);
    assert.deepEqual(window.rows.map((item) => item.id), [...firstPage.rows, ...secondPage.rows].map((item) => item.id));
    assert.equal(new Set([...firstPage.rows, ...secondPage.rows].map((item) => item.id)).size, 53);
    const rootTree = firstPage.tree.filter((item) => item.parentId === null);
    const firstNonFolder = rootTree.findIndex((item) => item.type !== "FOLDER");
    assert.ok(rootTree.slice(firstNonFolder).every((item) => item.type !== "FOLDER"));
    check("folders precede files and documents across pages and in the directory tree");
    await asset("project-delete", "project", "owner");
    await db.$transaction((tx) => deleteProjectData(tx, ["project"]));
    assert.equal(await db.knowledgeItem.count({ where: { projectId: "project" } }), 0);
    assert.equal((await db.fileAsset.findUniqueOrThrow({ where: { id: "project-delete" } })).state, "DELETE_PENDING");
    await cleanupKnowledgeFiles(db);
    await assert.rejects(() => stat(knowledgeStoragePath("projects/project/assets/project-delete")));
    assert.ok(await db.project.findUnique({ where: { id: "other" } }));
    assert.equal((await db.fileAsset.findUniqueOrThrow({ where: { id: "legacy-file" } })).storageType, "PUBLIC");
    assert.ok(await db.auditLog.count({ where: { entityType: "KNOWLEDGE", actorNameSnapshot: "owner", targetNameSnapshot: { not: null } } }));
    check("pagination and project deletion isolate other projects and clean private files");

    assert.deepEqual(cleanKnowledgeContent('<img src="/api/knowledge/files/a" onerror="alert(1)"><svg onload="evil()"></svg>').references, ["a"]);
    assert.equal(detectKnowledgeMime(Buffer.from("<svg></svg>")), "application/octet-stream");
    assert.equal(detectKnowledgeMime(Buffer.from("%PDF-1.7")), "application/pdf");
    assert.deepEqual(parseKnowledgeRange("bytes=2-5", 10), { start: 2, end: 5, partial: true });
    assert.deepEqual(parseKnowledgeRange("bytes=-3", 10), { start: 7, end: 9, partial: true });
    assert.equal(parseKnowledgeRange("bytes=99-", 10), null);
    assert.equal(parseKnowledgeRange("bytes=-0", 10), null);
    assert.throws(() => knowledgeStoragePath("../../public/exploit"));
    process.env.KNOWLEDGE_STORAGE_ROOT = path.resolve("public/..hidden");
    assert.throws(() => knowledgeStorageRoot());
    process.env.KNOWLEDGE_STORAGE_ROOT = configuredRoot;
    check("safe MIME detection, bounded byte ranges and storage path validation");
    console.log(`Knowledge integration checks passed: ${checks}`);
  } finally {
    await db.$disconnect();
    // Only the unique directory created by this test is removed.
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
