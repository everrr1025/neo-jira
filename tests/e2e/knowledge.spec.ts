import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

test.skip(process.env.KNOWLEDGE_E2E !== "1", "Run npm run test:e2e:knowledge against an isolated database");
const password = "Knowledge-Test-2026!";
const base = "/departments/kb-dept/projects/kb-project/knowledge";
let db: PrismaClient;

test.beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes("neo-knowledge-e2e-")) throw new Error("Knowledge E2E requires its disposable database");
  db = new PrismaClient();
  const hashed = await bcrypt.hash(password, 4);
  await db.department.create({ data: { id: "kb-dept", name: "Knowledge E2E", key: "KBE" } });
  for (const id of ["kb-author", "kb-viewer", "kb-outsider"]) {
    await db.user.create({ data: { id, name: id, email: `${id}@example.test`, password: hashed, departmentMembers: { create: { departmentId: "kb-dept", projectScopeType: id === "kb-viewer" ? "ALL_PROJECTS" : "NONE" } } } });
  }
  await db.project.create({ data: { id: "kb-project", key: "KBP", name: "Knowledge test project", departmentId: "kb-dept", ownerId: "kb-author", members: { create: { userId: "kb-author", role: "ADMIN" } } } });
});
test.afterAll(async () => { await db?.$disconnect(); });

async function authenticate(request: APIRequestContext, email: string) {
  const csrf = await (await request.get("/api/auth/csrf")).json();
  await request.post("/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password, json: "true" } });
}

async function editDocument(page: Page, title: string, body: string) {
  const editor = page.locator('[contenteditable="true"]');
  await editor.fill(title);
  await editor.press("End");
  await editor.press("Enter");
  if (body) await page.keyboard.insertText(body);
}

test("documents, attachment reuse, private downloads, conflicts and trash", async ({ page, browser }) => {
  await page.goto("/login");
  await page.getByLabel("邮箱地址").fill("kb-author@example.test");
  await page.getByRole("textbox", { name: "密码" }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto(base);
  await expect(page.getByRole("heading", { name: "知识", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "新建文件夹" }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "名称", exact: true }).fill("设计资料");
  await page.getByRole("dialog").getByRole("button", { name: "确认", exact: true }).click();
  await page.locator("table").getByRole("link", { name: "设计资料", exact: true }).click();
  await expect(page).toHaveURL(/\?folder=/);
  await expect(page.getByRole("navigation", { name: "面包屑" }).getByRole("link", { name: "设计资料" })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({ name: "guide.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nknowledge test") });
  await expect(page.locator("table").getByRole("link", { name: "guide.pdf" })).toBeVisible();
  const asset = await db.fileAsset.findFirstOrThrow({ where: { fileName: "guide.pdf" } });
  const response = await page.request.get(asset.fileUrl, { headers: { Range: "bytes=0-4" } });
  expect(response.status()).toBe(206);
  expect(await response.text()).toBe("%PDF-");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");

  await page.locator("table").getByRole("link", { name: "guide.pdf", exact: true }).click();
  const pdfFrame = page.locator('iframe[title="guide.pdf"]');
  await expect(pdfFrame).toBeVisible();
  for (const height of [720, 900]) {
    await page.setViewportSize({ width: 1280, height });
    await expect.poll(async () => {
      const frameBounds = await pdfFrame.boundingBox();
      const containerBounds = await pdfFrame.locator("..").boundingBox();
      return Math.abs(frameBounds!.height - containerBounds!.height);
    }).toBeLessThan(2);
  }
  await page.getByRole("navigation", { name: "面包屑" }).getByRole("link", { name: "设计资料", exact: true }).click();
  await expect(page).toHaveURL(/\?folder=/);


  await page.getByRole("button", { name: "文档", exact: true }).click();
  await editDocument(page, "项目说明", "这是项目共享文档。");
  await page.getByRole("button", { name: "引用已有文件", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "guide.pdf", exact: true }).click();
  const imageChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Insert image", exact: true }).click();
  await (await imageChooser).setFiles({ name: "diagram.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=", "base64") });
  await expect(page.locator('[contenteditable="true"] img')).toHaveAttribute("src", /^\/api\/knowledge\/files\//);
  await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("document-only attachment") });
  await expect(page.getByRole("link", { name: "notes.txt", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "保存文档", exact: true }).click();
  await expect(page).toHaveURL(/knowledge\/[^/?]+$/);
  await page.reload();
  await expect(page.locator('[contenteditable="true"]')).toContainText("这是项目共享文档。");
  await expect(page.locator("main").last().getByRole("link", { name: "guide.pdf", exact: true })).toBeVisible();
  await expect(page.locator('[contenteditable="true"] img')).toHaveAttribute("src", /^\/api\/knowledge\/files\//);
  expect(await db.knowledgeItem.count({ where: { title: "notes.txt" } })).toBe(0);

  const secondContext = await browser.newContext({ storageState: await page.context().storageState() });
  const second = await secondContext.newPage();
  await second.goto(page.url());
  await editDocument(second, "项目说明", "第二个会话的未保存内容");
  await editDocument(page, "项目说明", "第一个会话的新版本");
  await page.getByRole("button", { name: "保存文档", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await second.getByRole("button", { name: "保存文档", exact: true }).click();
  await expect(second.getByRole("button", { name: "复制当前内容" })).toBeVisible();
  await expect(second.locator('[contenteditable="true"]')).toContainText("第二个会话的未保存内容");
  second.once("dialog", (dialog) => dialog.dismiss());
  await second.getByRole("navigation", { name: "面包屑" }).getByRole("link", { name: "设计资料", exact: true }).click();
  await expect(second.locator('[contenteditable="true"]')).toContainText("第二个会话的未保存内容");
  await secondContext.close();

  const outsider = await browser.newContext({ baseURL: "http://localhost:3117" });
  await authenticate(outsider.request, "kb-outsider@example.test");
  expect((await outsider.request.get(asset.fileUrl)).status()).toBe(403);
  await outsider.close();
  const viewer = await browser.newContext({ baseURL: "http://localhost:3117" });
  await authenticate(viewer.request, "kb-viewer@example.test");
  expect((await viewer.request.get(asset.fileUrl)).status()).toBe(200);
  expect((await viewer.request.post("/api/knowledge/files", { multipart: { projectId: "kb-project", file: { name: "denied.txt", mimeType: "text/plain", buffer: Buffer.from("denied") } } })).status()).toBe(403);
  await viewer.close();

  const large = await page.request.post("/api/knowledge/files", { multipart: { projectId: "kb-project", file: { name: "large.bin", mimeType: "application/octet-stream", buffer: Buffer.alloc(1024 * 1024 + 1) } } });
  expect([400, 413]).toContain(large.status());
  const html = await page.request.post("/api/knowledge/files", { multipart: { projectId: "kb-project", file: { name: "unsafe.html", mimeType: "text/html", buffer: Buffer.from("<script>alert(1)</script>") } } });
  const pending = await html.json();
  const download = await page.request.get(pending.fileUrl);
  expect(download.headers()["content-disposition"]).toContain("attachment");
  expect(download.headers()["content-type"]).toBe("application/octet-stream");

  await page.getByRole("navigation", { name: "面包屑" }).getByRole("link", { name: "设计资料", exact: true }).click();
  await page.locator("table").getByRole("button", { name: "操作: 项目说明", exact: true }).click();
  await page.getByRole("menuitem", { name: "移到回收站", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.locator("table").getByRole("link", { name: "项目说明" })).toHaveCount(0);
  await page.getByRole("link", { name: "回收站", exact: true }).first().click();
  await page.locator("table").getByRole("button", { name: "操作: 项目说明", exact: true }).click();
  await page.getByRole("menuitem", { name: "恢复", exact: true }).click();
  await expect(page.locator("table").getByText("项目说明", { exact: true })).toHaveCount(0);
  expect((await page.request.get(asset.fileUrl)).status()).toBe(200);
});


test("knowledge navigation, personal favorites, metadata actions and top search", async ({ page, browser }) => {
  await authenticate(page.request, "kb-author@example.test");
  await page.goto(base);
  const sidebar = page.getByRole("complementary", { name: "知识目录" });
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "确认", exact: true });
  const search = page.getByRole("textbox", { name: "搜索知识" });
  await expect(page.getByRole("heading", { name: "知识", exact: true }).locator("..").getByText("Knowledge test project", { exact: true })).toHaveCount(0);
  await sidebar.getByRole("button", { name: "新建文件夹", exact: true }).click();
  await expect(dialog.getByText("创建位置: 根目录")).toBeVisible();
  await dialog.getByRole("textbox", { name: "名称", exact: true }).fill("导航测试");
  await confirm.click();
  await sidebar.getByRole("button", { name: "操作: 导航测试", exact: true }).click();
  await page.getByRole("menuitem", { name: "新建子文件夹", exact: true }).click();
  await expect(dialog.getByText("创建位置: 导航测试")).toBeVisible();
  await dialog.getByRole("textbox", { name: "名称", exact: true }).fill("导航子目录");
  await confirm.click();
  await expect(sidebar.getByRole("link", { name: "导航子目录", exact: true })).toBeVisible();
  await sidebar.getByRole("button", { name: "收起: 导航测试", exact: true }).click();
  await expect(sidebar.getByRole("link", { name: "导航子目录", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(sidebar.getByRole("button", { name: "展开: 导航测试", exact: true })).toHaveAttribute("aria-expanded", "false");
  await sidebar.getByRole("link", { name: "导航测试", exact: true }).click();
  await expect(sidebar.getByRole("link", { name: "导航子目录", exact: true })).toBeVisible();
  await sidebar.getByRole("button", { name: "新建文件夹", exact: true }).click();
  await expect(dialog.getByText("创建位置: 根目录")).toBeVisible();
  await dialog.getByRole("textbox", { name: "名称", exact: true }).fill("导航根目录");
  await confirm.click();
  await expect(sidebar.getByRole("link", { name: "导航根目录", exact: true })).toBeVisible();
  expect((await db.knowledgeItem.findFirstOrThrow({ where: { title: "导航根目录" } })).parentId).toBeNull();
  await sidebar.getByRole("link", { name: "导航子目录", exact: true }).click();
  await page.getByRole("button", { name: "文档", exact: true }).click();
  await editDocument(page, "导航文档", "导航文档正文");
  await page.getByRole("button", { name: "保存文档", exact: true }).click();
  await expect(page).toHaveURL(/knowledge\/[^/?]+$/);
  const documentUrl = page.url();
  const savedDocument = await db.knowledgeItem.findFirstOrThrow({ where: { title: "导航文档" } });
  await expect(search).toBeVisible();
  await sidebar.getByRole("button", { name: "收藏: 导航文档", exact: true }).focus();
  await expect(sidebar.getByRole("button", { name: "收藏: 导航文档", exact: true }).locator("..")).toHaveCSS("opacity", "1");
  await sidebar.getByRole("button", { name: "收藏: 导航文档", exact: true }).click();
  await expect(sidebar.getByRole("button", { name: "取消收藏: 导航文档", exact: true })).toBeEnabled();
  expect((await db.knowledgeItem.findUniqueOrThrow({ where: { id: savedDocument.id } })).version).toBe(savedDocument.version);

  // Renaming from the sidebar must keep the editor's unsaved body and update its version.
  await editDocument(page, "导航文档", "尚未保存的导航正文");
  await sidebar.getByRole("button", { name: "操作: 导航文档", exact: true }).click();
  await page.getByRole("menuitem", { name: "重命名", exact: true }).click();
  await dialog.getByRole("textbox", { name: "名称", exact: true }).fill("导航文档已改名");
  await confirm.click();
  await expect(page.locator('[contenteditable="true"] h1')).toHaveText("导航文档已改名");
  await expect(page.locator('[contenteditable="true"]')).toContainText("尚未保存的导航正文");
  expect((await db.knowledgeItem.findUniqueOrThrow({ where: { id: savedDocument.id } })).contentHtml).toContain("导航文档正文");
  await search.fill("导航文档");
  page.once("dialog", (prompt) => prompt.dismiss());
  await search.press("Enter");
  await expect(page).toHaveURL(documentUrl);
  await expect(page.locator('[contenteditable="true"]')).toContainText("尚未保存的导航正文");
  await page.getByRole("button", { name: "保存文档", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await sidebar.getByRole("button", { name: "操作: 导航文档已改名", exact: true }).click();
  await page.getByRole("menuitem", { name: "移动", exact: true }).click();
  const root = await db.knowledgeItem.findFirstOrThrow({ where: { title: "导航根目录" } });
  await dialog.getByRole("combobox", { name: "目标文件夹" }).selectOption(root.id);
  await confirm.click();
  await expect(page.getByRole("navigation", { name: "面包屑" }).getByRole("link", { name: "导航根目录", exact: true })).toBeVisible();
  await expect(page.locator('[contenteditable="true"]')).toContainText("尚未保存的导航正文");
  await search.press("Enter");
  await expect(page).toHaveURL(/search=/);
  await expect(page.locator("table").getByRole("link", { name: "导航文档已改名", exact: true })).toBeVisible();
  await expect(page.locator("table").getByText("导航根目录", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "清除搜索", exact: true }).click();
  await expect(page).toHaveURL(base);
  await sidebar.getByRole("link", { name: /^收藏/ }).click();
  await expect(page.locator("table").getByRole("link", { name: "导航文档已改名", exact: true })).toBeVisible();

  const viewer = await browser.newContext({ baseURL: "http://localhost:3117" });
  await authenticate(viewer.request, "kb-viewer@example.test");
  const viewerPage = await viewer.newPage();
  await viewerPage.goto(`${base}?favorites=1`);
  await expect(viewerPage.locator("table").getByRole("link", { name: "导航文档已改名", exact: true })).toHaveCount(0);
  await viewerPage.goto(documentUrl);
  await expect(viewerPage.getByRole("button", { name: "操作: 导航文档已改名", exact: true })).toHaveCount(0);
  await expect(viewerPage.getByRole("button", { name: "新建文件夹", exact: true })).toHaveCount(0);
  await viewer.close();

  await sidebar.getByRole("button", { name: "收起: 导航根目录", exact: true }).click();
  await expect(sidebar.getByRole("link", { name: "导航文档已改名", exact: true })).toHaveCount(0);
  await page.goto(documentUrl);
  await expect(sidebar.getByRole("link", { name: "导航文档已改名", exact: true })).toHaveAttribute("aria-current", "page");
  const directoryBounds = await sidebar.boundingBox();
  const contentBounds = await page.locator("main").last().boundingBox();
  expect(directoryBounds).not.toBeNull();
  expect(contentBounds).not.toBeNull();
  expect(Math.abs(directoryBounds!.y - contentBounds!.y)).toBeLessThan(2);
  expect(Math.abs(directoryBounds!.height - contentBounds!.height)).toBeLessThan(2);
  expect(Math.abs(contentBounds!.y + contentBounds!.height - (page.viewportSize()!.height - 24))).toBeLessThan(2);
  await page.screenshot({ path: "/tmp/neo-knowledge-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  // The application shell has an existing manual sidebar toggle on narrow screens.
  await page.locator("aside").first().locator(":scope > button").click();
  await expect(page.getByRole("button", { name: "展开侧栏", exact: true })).toBeVisible();
  await expect(sidebar).toBeHidden();
  await expect(search).toBeVisible();
  await page.getByRole("button", { name: "新建文件夹", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("button", { name: "取消收藏: 导航文档已改名", exact: true })).toBeVisible();
  await expect.poll(() => search.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(180);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "保存文档", exact: true })).toBeInViewport();
  await page.screenshot({ path: "/tmp/neo-knowledge-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await editDocument(page, "导航文档已改名", "删除前的未保存正文");
  await sidebar.getByRole("button", { name: "操作: 导航根目录", exact: true }).click();
  await page.getByRole("menuitem", { name: "移到回收站", exact: true }).click();
  page.once("dialog", (prompt) => prompt.dismiss());
  await confirm.click();
  expect((await db.knowledgeItem.findUniqueOrThrow({ where: { id: root.id } })).deletedAt).toBeNull();
  await expect(page.locator('[contenteditable="true"]')).toContainText("删除前的未保存正文");
  page.once("dialog", (prompt) => prompt.accept());
  await confirm.click();
  await expect(page).toHaveURL(base);
  await expect(sidebar.getByRole("link", { name: "导航根目录", exact: true })).toHaveCount(0);
  await sidebar.getByRole("link", { name: /^收藏/ }).click();
  await expect(page.locator("table").getByRole("link", { name: "导航文档已改名", exact: true })).toHaveCount(0);
  await sidebar.getByRole("link", { name: "回收站", exact: true }).click();
  await page.locator("table").getByRole("button", { name: "操作: 导航根目录", exact: true }).click();
  await page.getByRole("menuitem", { name: "恢复", exact: true }).click();
  await expect(page.locator("table").getByText("导航根目录", { exact: true })).toHaveCount(0);
  await sidebar.getByRole("link", { name: /^收藏/ }).click();
  await expect(page.locator("table").getByRole("link", { name: "导航文档已改名", exact: true })).toBeVisible();

});


test("creation uses explicit directory context and protects open drafts", async ({ page }) => {
  const folder = await db.knowledgeItem.create({ data: { projectId: "kb-project", type: "FOLDER", title: "创建位置测试", creatorId: "kb-author", updaterId: "kb-author" } });
  await authenticate(page.request, "kb-author@example.test");
  await page.goto(base);
  const sidebar = page.getByRole("complementary", { name: "知识目录" });
  const editor = page.locator('[contenteditable="true"]');
  const title = editor.locator("h1");
  const dialog = page.getByRole("dialog");
  await expect(sidebar.getByRole("link", { name: "根目录", exact: true })).toBeVisible();
  const rootChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "文件", exact: true }).click();
  await (await rootChooser).setFiles({ name: "creation-root.txt", mimeType: "text/plain", buffer: Buffer.from("root file") });
  await expect(page.locator("table").getByRole("link", { name: "creation-root.txt", exact: true })).toBeVisible();
  expect((await db.knowledgeItem.findFirstOrThrow({ where: { title: "creation-root.txt" } })).parentId).toBeNull();

  await sidebar.getByRole("link", { name: folder.title, exact: true }).click();
  const nestedChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "文件", exact: true }).click();
  await (await nestedChooser).setFiles({ name: "creation-nested.txt", mimeType: "text/plain", buffer: Buffer.from("nested file") });
  await page.locator("table").getByRole("link", { name: "creation-nested.txt", exact: true }).click();
  const filePanel = page.locator("main").last();
  const downloadLink = filePanel.getByRole("link", { name: "下载", exact: true });
  await expect(downloadLink.locator("..").locator("span")).toHaveText(["kb-author", "11 B"]);
  const downloadBounds = await downloadLink.boundingBox();
  const filePanelBounds = await filePanel.boundingBox();
  expect(Math.abs(downloadBounds!.y + downloadBounds!.height - (filePanelBounds!.y + filePanelBounds!.height - 8))).toBeLessThan(2);
  await expect(page.getByRole("button", { name: "文件", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "文档", exact: true }).click();
  await editDocument(page, "上下文新建文档", "原文档已保存正文");
  await page.getByRole("button", { name: "保存文档", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const saved = await db.knowledgeItem.findFirstOrThrow({ where: { title: "上下文新建文档" } });
  expect(saved.parentId).toBe(folder.id);
  expect(saved.contentHtml).not.toContain(saved.title);
  await expect(page).toHaveURL(`${base}/${saved.id}`);
  await page.reload();
  await expect(editor.locator("h1")).toHaveText(saved.title);
  await expect(page.getByRole("textbox", { name: "文档标题", exact: true })).toHaveCount(0);
  const saveButton = page.getByRole("button", { name: "保存文档", exact: true });
  await expect(saveButton).toHaveAttribute("data-variant", "ghost");
  await expect(saveButton).toHaveText("");
  await expect(page.getByRole("button", { name: "返回", exact: true })).toHaveCount(0);
  await expect(saveButton.locator("..").getByRole("status")).toHaveText("已保存");
  const contentPanel = page.locator("main").last();
  await expect(contentPanel.getByRole("navigation", { name: "面包屑" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "面包屑" })).not.toContainText(saved.title);
  await expect(contentPanel.locator(".neo-rich-text-editor")).toHaveCSS("border-top-width", "0px");
  await expect(contentPanel.locator(".neo-rich-text-editor")).toHaveCSS("border-top-left-radius", "0px");
  await expect(page).toHaveURL(`${base}/${saved.id}`);

  await editDocument(page, "上下文新建文档", "原文档未保存正文");
  page.once("dialog", (prompt) => prompt.dismiss());
  await page.getByRole("button", { name: "文档", exact: true }).click();
  await expect(editor).toContainText("原文档未保存正文");
  page.once("dialog", (prompt) => prompt.accept());
  await page.getByRole("button", { name: "文档", exact: true }).click();
  await expect(title).toHaveText("未命名文档");
  page.once("dialog", (prompt) => prompt.accept());
  await sidebar.getByRole("link", { name: saved.title, exact: true }).click();
  await expect(title).toHaveText(saved.title);
  await expect(editor).toContainText("原文档已保存正文");

  // Uploading an independent file must leave an unsaved document intact.
  await editDocument(page, "上下文新建文档", "上传期间保留的正文");
  const editingChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "文件", exact: true }).click();
  await (await editingChooser).setFiles({ name: "creation-while-editing.txt", mimeType: "text/plain", buffer: Buffer.from("separate file") });
  await expect(page.getByRole("button", { name: "文件", exact: true })).toBeEnabled();
  await expect(editor).toContainText("上传期间保留的正文");
  expect((await db.knowledgeItem.findFirstOrThrow({ where: { title: "creation-while-editing.txt" } })).parentId).toBe(folder.id);
  await page.getByRole("button", { name: "保存文档", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();

  await sidebar.getByRole("link", { name: /^收藏/ }).click();
  await page.getByRole("button", { name: "文档", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "继续", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(title).toHaveCount(0);
  await page.getByRole("button", { name: "文档", exact: true }).click();
  await dialog.getByRole("combobox", { name: "保存位置", exact: true }).selectOption(folder.id);
  await dialog.getByRole("button", { name: "继续", exact: true }).click();
  await title.fill("收藏页指定目录文档");
  await page.getByRole("button", { name: "保存文档", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  expect((await db.knowledgeItem.findFirstOrThrow({ where: { title: "收藏页指定目录文档" } })).parentId).toBe(folder.id);

  const search = page.getByRole("textbox", { name: "搜索知识", exact: true });
  await search.fill("创建位置");
  await search.press("Enter");
  await expect(page).toHaveURL(/search=/);
  await page.getByRole("button", { name: "文件", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "继续", exact: true })).toBeDisabled();
  await dialog.getByRole("combobox", { name: "保存位置", exact: true }).selectOption("");
  const searchChooser = page.waitForEvent("filechooser");
  await dialog.getByRole("button", { name: "继续", exact: true }).click();
  await (await searchChooser).setFiles({ name: "creation-search-root.txt", mimeType: "text/plain", buffer: Buffer.from("chosen root") });
  await expect(page.getByRole("button", { name: "文件", exact: true })).toBeEnabled();
  expect((await db.knowledgeItem.findFirstOrThrow({ where: { title: "creation-search-root.txt" } })).parentId).toBeNull();
  await sidebar.getByRole("link", { name: "根目录", exact: true }).click();
  await expect(page).toHaveURL(base);
  await page.getByRole("button", { name: "文档", exact: true }).click();
  await title.fill("根目录新建文档 <&>");
  await page.getByRole("button", { name: "保存文档", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  const rootDocument = await db.knowledgeItem.findFirstOrThrow({ where: { title: "根目录新建文档 <&>" } });
  expect(rootDocument.parentId).toBeNull();
  await expect(page).toHaveURL(`${base}/${rootDocument.id}`);
  await page.reload();
  await expect(title).toHaveText("根目录新建文档 <&>");

  await sidebar.getByRole("link", { name: "回收站", exact: true }).click();
  await expect(page.getByRole("button", { name: "文件", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "文档", exact: true })).toHaveCount(0);

  const ancestors: { id: string }[] = [];
  let parentId: string | null = null;
  for (const folderTitle of ["一级目录", "二级目录", "三级目录", "四级目录"]) {
    const ancestor: { id: string } = await db.knowledgeItem.create({ data: { projectId: "kb-project", type: "FOLDER", title: folderTitle, parentId, creatorId: "kb-author", updaterId: "kb-author" } });
    ancestors.push(ancestor);
    parentId = ancestor.id;
  }
  const deepDocument = await db.knowledgeItem.create({ data: { projectId: "kb-project", type: "DOCUMENT", title: "深层文档", contentHtml: "<p>保留正文</p>", parentId, creatorId: "kb-author", updaterId: "kb-author" } });
  await page.goto(`${base}/${deepDocument.id}`);
  const breadcrumbs = page.getByRole("navigation", { name: "面包屑" });
  await expect(breadcrumbs).toHaveAttribute("title", "知识 / 一级目录 / 二级目录 / 三级目录 / 四级目录");
  await expect(breadcrumbs.getByRole("link", { name: "一级目录", exact: true })).toBeVisible();
  await expect(breadcrumbs.getByRole("link", { name: "四级目录", exact: true })).toBeVisible();
  await expect(breadcrumbs).not.toContainText(deepDocument.title);
  await editDocument(page, deepDocument.title, "深层未保存正文");
  await breadcrumbs.getByRole("button", { name: "展开中间路径", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "二级目录", exact: true })).toBeVisible();
  page.once("dialog", (prompt) => prompt.dismiss());
  await page.getByRole("menuitem", { name: "三级目录", exact: true }).click();
  await expect(page).toHaveURL(`${base}/${deepDocument.id}`);
  await expect(editor).toContainText("深层未保存正文");
  page.once("dialog", (prompt) => prompt.accept());
  await breadcrumbs.getByRole("link", { name: "四级目录", exact: true }).click();
  await expect(page).toHaveURL(`${base}?folder=${ancestors[3].id}`);
});
