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
  await expect(dialog.getByText("/", { exact: true })).toBeVisible();
  const folderName = dialog.getByRole("textbox", { name: "名称", exact: true });
  for (const invalid of ["产品/设计", "产品\\设计", ".", ".."]) {
    await folderName.fill(invalid);
    await expect(folderName).toHaveValue(invalid);
    await expect(folderName).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(confirm).toBeDisabled();
  }
  await dialog.getByRole("textbox", { name: "名称", exact: true }).fill("导航测试");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(confirm).toBeEnabled();
  await expect(dialog.getByText("/ 导航测试", { exact: true })).toBeVisible();
  await confirm.click();
  await sidebar.getByRole("button", { name: "操作: 导航测试", exact: true }).click();
  await page.getByRole("menuitem", { name: "重命名", exact: true }).click();
  await folderName.fill("导航/测试");
  await expect(folderName).toHaveValue("导航/测试");
  await expect(dialog.getByRole("alert")).toContainText("文件夹名称不能包含");
  await expect(confirm).toBeDisabled();
  await folderName.fill("导航测试");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await confirm.click();
  await sidebar.getByRole("button", { name: "操作: 导航测试", exact: true }).click();
  await page.getByRole("menuitem", { name: "新建子文件夹", exact: true }).click();
  await expect(dialog.getByText("/ 导航测试", { exact: true })).toBeVisible();
  await dialog.getByRole("textbox", { name: "名称", exact: true }).fill("导航子目录");
  await expect(dialog.getByText("/ 导航测试 / 导航子目录", { exact: true })).toBeVisible();
  await dialog.getByRole("textbox", { name: "名称", exact: true }).fill("");
  await expect(dialog.getByText("/ 导航测试", { exact: true })).toBeVisible();
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
  await expect(dialog.getByText("/", { exact: true })).toBeVisible();
  await dialog.getByRole("textbox", { name: "名称", exact: true }).fill("导航根目录");
  await confirm.click();
  await expect(sidebar.getByRole("link", { name: "导航根目录", exact: true })).toBeVisible();
  expect((await db.knowledgeItem.findFirstOrThrow({ where: { title: "导航根目录" } })).parentId).toBeNull();
  await sidebar.getByRole("link", { name: "导航子目录", exact: true }).click();
  await expect(sidebar.getByRole("link", { name: "导航子目录", exact: true })).toHaveAttribute("aria-current", "page");
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
  await dialog.getByRole("combobox", { name: "目标文件夹" }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  const destinations = await page.getByRole("option").allTextContents();
  expect(destinations[0]).toBe("/");
  expect(destinations.indexOf("/导航测试")).toBeGreaterThanOrEqual(0);
  expect(destinations.indexOf("/导航测试/导航子目录")).toBe(destinations.indexOf("/导航测试") + 1);
  await page.getByRole("option", { name: "/", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "目标文件夹" })).toHaveText("/");
  await dialog.getByRole("combobox", { name: "目标文件夹" }).click();
  await page.getByRole("option", { name: `/${root.title}`, exact: true }).click();
  await confirm.click();
  await expect(page.getByRole("navigation", { name: "面包屑" }).getByRole("link", { name: "导航根目录", exact: true })).toBeVisible();
  await expect(page.locator('[contenteditable="true"]')).toContainText("尚未保存的导航正文");
  await search.press("Enter");
  await expect(page).toHaveURL(/search=/);
  await expect(page.locator("table").getByRole("link", { name: "导航文档已改名", exact: true })).toBeVisible();
  await expect(page.locator("table").getByText("/ 导航根目录", { exact: true })).toBeVisible();
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
  await expect(page.locator("table").getByText("/ 导航根目录", { exact: true })).toHaveCount(0);
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


test("knowledge list loads more on scroll with a fixed header and edge scrollbar", async ({ page }) => {
  const folder = await db.knowledgeItem.create({ data: { projectId: "kb-project", type: "FOLDER", title: "Scroll test", creatorId: "kb-author", updaterId: "kb-author" } });
  await db.knowledgeItem.createMany({ data: Array.from({ length: 55 }, (_, index) => ({
    projectId: "kb-project", parentId: folder.id, type: "DOCUMENT", title: `Scroll item ${index}`,
    creatorId: "kb-author", updaterId: "kb-author", contentHtml: "<p>Details only</p>",
  })) });
  await authenticate(page.request, "kb-author@example.test");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${base}?folder=${folder.id}`);
  const table = page.locator("main table");
  await expect(table.locator("tbody tr")).toHaveCount(50);
  await expect(page.getByRole("button", { name: "下一页", exact: true })).toHaveCount(0);
  const headerTop = (await table.locator("thead").boundingBox())!.y;
  const scroll = table.locator("..");
  const mainBounds = (await scroll.locator("..").boundingBox())!;
  const scrollBounds = (await scroll.boundingBox())!;
  expect(Math.abs(mainBounds.x + mainBounds.width - scrollBounds.x - scrollBounds.width)).toBeLessThan(1);
  await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(table.locator("tbody tr")).toHaveCount(55);
  expect(Math.abs((await table.locator("thead").boundingBox())!.y - headerTop)).toBeLessThan(1);
  await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(table.locator("thead")).toContainText("共 55 项");
  await expect(scroll.getByRole("status")).toBeEmpty();
  await page.getByRole("navigation", { name: "面包屑" }).getByRole("link", { name: "根目录", exact: true }).click();
  await expect(table.getByRole("link", { name: "Scroll item 0", exact: true })).toHaveCount(0);
  await expect(table.getByRole("link", { name: "Scroll test", exact: true })).toBeVisible();
});

test("sidebar drag moves files and folders, rejects cycles and preserves document drafts", async ({ page, browser }) => {
  const create = (type: string, title: string, parentId: string | null = null) => db.knowledgeItem.create({ data: {
    projectId: "kb-project", type, title, parentId, creatorId: "kb-author", updaterId: "kb-author",
    contentHtml: type === "DOCUMENT" ? "<p>Original body</p>" : "",
  } });
  const source = await create("FOLDER", "Drag source");
  const child = await create("FOLDER", "Drag child", source.id);
  const target = await create("FOLDER", "Drag target");
  const doc = await create("DOCUMENT", "Drag draft");
  const file = await create("FILE", "Drag file.txt");
  await authenticate(page.request, "kb-author@example.test");
  await page.goto(base);
  const nav = page.getByRole("complementary", { name: "知识目录" });
  const expanded = await nav.locator('button[aria-expanded="true"]').evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")!).filter((label) => !label.includes("Drag")));
  for (const label of expanded) {
    const toggle = nav.getByRole("button", { name: label, exact: true });
    if (await toggle.count()) await toggle.click();
  }
  const row = (title: string) => nav.getByRole("link", { name: title, exact: true }).locator("..");
  const root = nav.getByRole("link", { name: "根目录", exact: true }).locator("..");
  const panel = nav.locator("..");
  await panel.evaluate((element) => {
    const initial = element.getBoundingClientRect();
    element.setAttribute("data-max-layout-shift", "0");
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      const shift = Math.max(Number(element.getAttribute("data-max-layout-shift")), Math.abs(rect.y - initial.y), Math.abs(rect.height - initial.height));
      element.setAttribute("data-max-layout-shift", String(shift));
    });
    observer.observe(element);
  });
  await row("Drag file.txt").dragTo(row("Drag target"));
  await expect.poll(async () => (await db.knowledgeItem.findUniqueOrThrow({ where: { id: file.id } })).parentId).toBe(target.id);
  await expect(row("Drag target").getByRole("button", { name: "收起: Drag target" })).toBeVisible();
  await expect(row("Drag file.txt")).toHaveAttribute("draggable", "true");
  expect(Number(await panel.getAttribute("data-max-layout-shift"))).toBeLessThan(1);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect.poll(async () => (await db.knowledgeItem.findUniqueOrThrow({ where: { id: file.id } })).parentId).toBeNull();
  await expect(row("Drag file.txt")).toHaveAttribute("draggable", "true");
  await row("Drag file.txt").dragTo(row("Drag target"));
  await expect.poll(async () => (await db.knowledgeItem.findUniqueOrThrow({ where: { id: file.id } })).parentId).toBe(target.id);
  await expect(row("Drag file.txt")).toHaveAttribute("draggable", "true");
  await row("Drag file.txt").dragTo(root);
  await expect.poll(async () => (await db.knowledgeItem.findUniqueOrThrow({ where: { id: file.id } })).parentId).toBeNull();
  await expect.poll(async () => (await row("Drag file.txt").getAttribute("draggable"))).toBe("true");
  const fileVersion = (await db.knowledgeItem.findUniqueOrThrow({ where: { id: file.id } })).version;
  await row("Drag file.txt").dragTo(root);
  expect((await db.knowledgeItem.findUniqueOrThrow({ where: { id: file.id } })).version).toBe(fileVersion);
  await row("Drag source").dragTo(row("Drag target"));
  await expect.poll(async () => (await db.knowledgeItem.findUniqueOrThrow({ where: { id: source.id } })).parentId).toBe(target.id);
  await expect(row("Drag child")).toBeVisible();
  await expect(row("Drag target")).toHaveAttribute("draggable", "true");
  await row("Drag target").dragTo(row("Drag child"));
  expect((await db.knowledgeItem.findUniqueOrThrow({ where: { id: target.id } })).parentId).toBeNull();
  expect((await db.knowledgeItem.findUniqueOrThrow({ where: { id: child.id } })).parentId).toBe(source.id);
  await nav.getByRole("link", { name: "Drag draft", exact: true }).click();
  await editDocument(page, "Drag draft", "Unsaved drag body");
  await row("Drag draft").dragTo(row("Drag target"));
  await expect.poll(async () => (await db.knowledgeItem.findUniqueOrThrow({ where: { id: doc.id } })).parentId).toBe(target.id);
  await expect(page.locator('[contenteditable="true"]')).toContainText("Unsaved drag body");
  await expect(page.getByRole("status").filter({ hasText: "未保存" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存文档", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "保存文档", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "已保存" })).toBeVisible();
  await page.reload();
  await expect(page.locator('[contenteditable="true"]')).toContainText("Unsaved drag body");
  await expect(page.getByRole("navigation", { name: "面包屑" })).toContainText("Drag target");
  const context = await browser.newContext();
  await authenticate(context.request, "kb-viewer@example.test");
  const viewer = await context.newPage();
  await viewer.goto(base);
  await expect(viewer.getByRole("complementary", { name: "知识目录" }).getByRole("link", { name: "Drag draft", exact: true }).locator("..")).toHaveAttribute("draggable", "false");
  await context.close();
});


test("list operations and returning from documents preserve loaded rows, filters and scroll", async ({ page }) => {
  const folder = await db.knowledgeItem.create({ data: { projectId: "kb-project", type: "FOLDER", title: "Keep browsing", creatorId: "kb-author", updaterId: "kb-author" } });
  const destination = await db.knowledgeItem.create({ data: { projectId: "kb-project", type: "FOLDER", title: "Keep destination", creatorId: "kb-author", updaterId: "kb-author" } });
  await db.knowledgeItem.createMany({ data: Array.from({ length: 110 }, (_, index) => ({ projectId: "kb-project", parentId: folder.id, type: "DOCUMENT", title: `Keep item ${index}`, contentHtml: "<p>Keep browsing body</p>", creatorId: "kb-author", updaterId: "kb-author" })) });
  await authenticate(page.request, "kb-author@example.test");
  await page.goto(`${base}?folder=${folder.id}`);
  const table = page.locator("main table");
  const scroll = table.locator("..");
  await expect(table.locator("tbody tr")).toHaveCount(50);
  await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(table.locator("tbody tr")).toHaveCount(100);
  await scroll.evaluate((element) => { element.scrollTop = 1800; });
  const selected = table.locator("tbody tr").nth(40);
  const title = await selected.getByRole("link").innerText();
  await selected.scrollIntoViewIfNeeded();
  const top = await scroll.evaluate((element) => element.scrollTop);
  await selected.getByRole("button", { name: `收藏: ${title}`, exact: true }).click();
  await expect(table.getByRole("button", { name: `取消收藏: ${title}`, exact: true })).toBeEnabled();
  await expect(table.locator("tbody tr")).toHaveCount(100);
  expect(Math.abs(await scroll.evaluate((element) => element.scrollTop) - top)).toBeLessThan(2);
  await selected.getByRole("button", { name: `操作: ${title}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "重命名", exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "名称", exact: true }).fill(`${title} renamed`);
  await page.getByRole("dialog").getByRole("button", { name: "确认", exact: true }).click();
  await expect(table.getByRole("link", { name: `${title} renamed`, exact: true })).toHaveCount(1);
  await expect(table.getByRole("button", { name: `操作: ${title} renamed`, exact: true })).toBeEnabled();
  await expect(table.locator("tbody tr")).toHaveCount(100);
  expect(Math.abs(await scroll.evaluate((element) => element.scrollTop) - top)).toBeLessThan(2);
  const openLink = table.locator("tbody tr").nth(40).getByRole("link");
  const openTitle = await openLink.innerText();
  await openLink.click();
  await expect(page.locator('[contenteditable="true"]')).toContainText("Keep browsing body");
  const returnLink = page.getByRole("link", { name: "返回列表", exact: true });
  await expect(returnLink).toHaveAttribute("href", `${base}?folder=${folder.id}`);
  const documentUrl = page.url();
  await editDocument(page, openTitle, "Unsaved return body");
  page.once("dialog", (prompt) => prompt.dismiss());
  await returnLink.click();
  await expect(page).toHaveURL(documentUrl);
  await expect(page.locator('[contenteditable="true"]')).toContainText("Unsaved return body");
  page.once("dialog", (prompt) => prompt.accept());
  await returnLink.click();
  await expect(table.locator("tbody tr")).toHaveCount(100);
  await expect.poll(async () => Math.abs(await scroll.evaluate((element) => element.scrollTop) - top)).toBeLessThan(2);
  const moving = table.locator("tbody tr").nth(40);
  const movingTitle = await moving.getByRole("link").innerText();
  await moving.getByRole("button", { name: `操作: ${movingTitle}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "移动", exact: true }).click();
  await page.getByRole("combobox", { name: "目标文件夹" }).click();
  await page.getByRole("option", { name: `/${destination.title}`, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确认", exact: true }).click();
  await expect(table.getByRole("link", { name: movingTitle, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(table.getByRole("link", { name: movingTitle, exact: true })).toHaveCount(1);
  await expect(table.locator("tbody tr")).toHaveCount(100);
  expect(Math.abs(await scroll.evaluate((element) => element.scrollTop) - top)).toBeLessThan(2);
  await page.getByRole("textbox", { name: "搜索知识" }).fill("Keep item");
  await page.getByRole("textbox", { name: "搜索知识" }).press("Enter");
  await expect(page).toHaveURL(/search=Keep/);
  await expect(table.locator("tbody tr")).toHaveCount(50);
  await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(table.locator("tbody tr")).toHaveCount(100);
  await scroll.evaluate((element) => { element.scrollTop = 1800; });
  const searchLink = table.locator("tbody tr").nth(40).getByRole("link");
  await searchLink.scrollIntoViewIfNeeded();
  const searchTop = await scroll.evaluate((element) => element.scrollTop);
  await searchLink.click();
  await expect(page.locator('[contenteditable="true"]')).toContainText("Keep browsing body");
  await expect(page.getByRole("link", { name: "返回搜索结果", exact: true })).toHaveAttribute("href", `${base}?search=Keep+item`);
  await page.getByRole("link", { name: "返回搜索结果", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "搜索知识" })).toHaveValue("Keep item");
  await expect(table.locator("tbody tr")).toHaveCount(100);
  await expect.poll(async () => Math.abs(await scroll.evaluate((element) => element.scrollTop) - searchTop)).toBeLessThan(2);
});

test("image preview opens a zoomable viewer and original file", async ({ page }) => {
  await authenticate(page.request, "kb-author@example.test");
  await page.goto(base);
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 1600;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#456789"; context.fillRect(0, 0, 400, 1600);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator('input[type="file"]').first().setInputFiles({ name: "preview-long.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await page.locator("table").getByRole("link", { name: "preview-long.png", exact: true }).click();
  await page.getByRole("button", { name: "放大查看图片", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const image = dialog.getByRole("img", { name: "preview-long.png", exact: true });
  await expect(image).toBeVisible();
  await expect.poll(async () => (await image.boundingBox())!.height).toBeLessThan(1600);
  const fitHeight = (await image.boundingBox())!.height;
  await dialog.getByRole("button", { name: "放大", exact: true }).click();
  await expect.poll(async () => (await image.boundingBox())!.height).toBeGreaterThan(fitHeight);
  await dialog.getByRole("button", { name: "100%", exact: true }).click();
  await expect.poll(async () => (await image.boundingBox())!.height).toBe(1600);
  await expect(dialog.getByRole("link", { name: "查看原图" })).toHaveAttribute("target", "_blank");
  await expect(dialog.getByRole("link", { name: "查看原图" })).toHaveAttribute("href", /\/api\/knowledge\/files\//);
  await dialog.getByRole("button", { name: "适应窗口", exact: true }).click();
  await expect.poll(async () => {
    const imageBounds = (await image.boundingBox())!;
    const viewportBounds = (await dialog.getByLabel("图片预览", { exact: true }).boundingBox())!;
    return imageBounds.height - viewportBounds.height;
  }).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "/tmp/knowledge-image-viewer.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});


test("return link follows favorites and is absent for direct or invalid sources", async ({ page }) => {
  const document = await db.knowledgeItem.create({ data: { projectId: "kb-project", type: "DOCUMENT", title: "Return favorites", contentHtml: "<p>Favorite body</p>", creatorId: "kb-author", updaterId: "kb-author" } });
  await db.knowledgeFavorite.create({ data: { userId: "kb-author", itemId: document.id } });
  await authenticate(page.request, "kb-author@example.test");
  await page.goto(`${base}?favorites=1`);
  await page.locator("table").getByRole("link", { name: "Return favorites", exact: true }).click();
  await expect(page.getByRole("link", { name: "返回收藏", exact: true })).toHaveAttribute("href", `${base}?favorites=1`);
  await page.getByRole("link", { name: "返回收藏", exact: true }).click();
  await expect(page).toHaveURL(`${base}?favorites=1`);
  await expect(page.locator("table").getByRole("link", { name: "Return favorites", exact: true })).toBeVisible();
  await page.goto(`${base}/${document.id}`);
  await expect(page.getByRole("link", { name: /^返回(列表|收藏|搜索结果)$/ })).toHaveCount(0);
  await page.goto(`${base}/${document.id}?from=${encodeURIComponent("https://example.com/knowledge")}`);
  await expect(page.getByRole("link", { name: /^返回(列表|收藏|搜索结果)$/ })).toHaveCount(0);
  await expect(page.locator('[contenteditable="true"]')).toContainText("Favorite body");
});


test("trash permanently deletes after confirmation without typing a name", async ({ page }) => {
  const folder = await db.knowledgeItem.create({ data: { projectId: "kb-project", type: "FOLDER", title: "Purge confirmation folder", creatorId: "kb-author", updaterId: "kb-author", deletedAt: new Date() } });
  const child = await db.knowledgeItem.create({ data: { projectId: "kb-project", type: "DOCUMENT", title: "Purge confirmation child", parentId: folder.id, creatorId: "kb-author", updaterId: "kb-author", deletedAt: new Date() } });
  await authenticate(page.request, "kb-author@example.test");
  await page.goto(`${base}?trash=1`);
  const open = async () => {
    await page.locator("table").getByRole("button", { name: "操作: Purge confirmation folder", exact: true }).click();
    await page.getByRole("menuitem", { name: "永久删除", exact: true }).click();
  };
  await open();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await expect(dialog).toContainText("Purge confirmation folder");
  await expect(dialog).toContainText("无法恢复");
  await expect(dialog.getByRole("button", { name: "确认", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  expect(await db.knowledgeItem.count({ where: { id: { in: [folder.id, child.id] } } })).toBe(2);
  await open();
  await dialog.getByRole("button", { name: "确认", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => db.knowledgeItem.count({ where: { id: { in: [folder.id, child.id] } } })).toBe(0);
});


test("directory navigation keeps the latest collapse state instead of old list snapshots", async ({ page }) => {
  const create = (title: string, parentId: string | null = null) => db.knowledgeItem.create({ data: { projectId: "kb-project", type: "FOLDER", title, parentId, creatorId: "kb-author", updaterId: "kb-author" } });
  const a = await create("Expand A");
  const aChild = await create("Expand A child", a.id);
  const b = await create("Expand B");
  await create("Expand B child", b.id);
  await authenticate(page.request, "kb-author@example.test");
  await page.goto(base);
  const nav = page.getByRole("complementary", { name: "知识目录" });
  await nav.getByRole("link", { name: "Expand A", exact: true }).click();
  await expect(page).toHaveURL(`${base}?folder=${a.id}`);
  await expect(nav.getByRole("link", { name: "Expand B child", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate((folderId) => Object.keys(sessionStorage).some((key) => key.startsWith("knowledge-browse:") && key.includes(folderId)), a.id)).toBe(true);
  await page.evaluate((folderId) => {
    const key = Object.keys(sessionStorage).find((key) => key.startsWith("knowledge-browse:") && key.includes(folderId))!;
    const snapshot = JSON.parse(sessionStorage.getItem(key)!);
    sessionStorage.setItem(key, JSON.stringify({ ...snapshot, collapsed: {} }));
  }, a.id);
  await nav.getByRole("link", { name: "根目录", exact: true }).click();
  await nav.getByRole("button", { name: "收起: Expand B", exact: true }).click();
  await expect(nav.getByRole("link", { name: "Expand B child", exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem("knowledge-folders:kb-author:kb-project") || "{}")[id], b.id)).toBe(true);
  await nav.getByRole("link", { name: "Expand A", exact: true }).click();
  await expect(page).toHaveURL(`${base}?folder=${a.id}`);
  await expect(nav.getByRole("button", { name: "展开: Expand B", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(nav.getByRole("link", { name: "Expand B child", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Expand A child", exact: true })).toBeVisible();
  await nav.getByRole("button", { name: "收起: Expand A", exact: true }).click();
  await nav.getByRole("link", { name: "根目录", exact: true }).click();
  await expect(nav.getByRole("button", { name: "展开: Expand A", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(nav.getByRole("button", { name: "展开: Expand B", exact: true })).toHaveAttribute("aria-expanded", "false");
  await page.goto(`${base}?folder=${aChild.id}`);
  await expect(nav.getByRole("button", { name: "收起: Expand A", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("button", { name: "收起: Expand A child", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("button", { name: "展开: Expand B", exact: true })).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(nav.getByRole("button", { name: "展开: Expand B", exact: true })).toHaveAttribute("aria-expanded", "false");
});
