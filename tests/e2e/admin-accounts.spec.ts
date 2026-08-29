import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@neo-jira.local";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "Admin123";

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("邮箱地址").fill(email);
  await page.getByRole("textbox", { name: "密码" }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.beforeEach(async ({ page }) => {
  await signIn(page, adminEmail, adminPassword);
});

test("disables, restores, and permanently deletes a standard user", async ({ page }) => {
  const email = `lifecycle-user-${Date.now()}@neo-jira.local`;
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "用户", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "创建用户" });
  await dialog.getByLabel("姓名").fill("Lifecycle User");
  await dialog.getByLabel("邮箱").fill(email);
  await dialog.getByTitle("重新生成").click();
  await dialog.getByRole("button", { name: "创建用户", exact: true }).click();

  await page.getByPlaceholder("搜索姓名或邮箱").fill(email);
  const row = page.locator("tbody tr").filter({ hasText: email });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "停用" }).click();
  await expect(row.getByText("已停用", { exact: true }).first()).toBeVisible();
  await row.getByRole("button", { name: "恢复" }).click();
  await expect(row.getByRole("button", { name: "停用" })).toBeVisible();
  await row.getByRole("button", { name: "停用" }).click();

  await row.getByRole("button", { name: "删除" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "删除" });
  await deleteDialog.getByLabel("请输入该账号邮箱以确认永久删除").fill(email);
  await deleteDialog.getByRole("button", { name: "删除", exact: true }).click();
  await expect(row).toHaveCount(0);
});

test("creates an administrator, forces password change, and invalidates its session when disabled", async ({ page, browser }) => {
  const email = `lifecycle-admin-${Date.now()}@neo-jira.local`;
  const nextPassword = "LifecycleAdmin123!";
  await page.goto("/admin/users?accountType=admin");
  await page.getByRole("button", { name: "创建管理员", exact: true }).click();
  const createDialog = page.getByRole("dialog", { name: "创建系统管理员" });
  await createDialog.getByLabel("姓名").fill("Lifecycle Admin");
  await createDialog.getByLabel("邮箱").fill(email);
  await createDialog.getByRole("button", { name: "创建管理员", exact: true }).click();
  const temporaryPassword = (await createDialog.locator(".font-mono").textContent())?.trim() || "";
  expect(temporaryPassword.length).toBeGreaterThanOrEqual(8);
  await createDialog.getByText("取消", { exact: true }).click();

  await page.getByRole("button", { name: "退出登录" }).click();
  await signIn(page, email, temporaryPassword);
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByText("当前密码为临时密码，请先修改密码后再继续使用系统。")).toBeVisible();
  await page.getByLabel("当前密码").fill(temporaryPassword);
  await page.getByLabel("新密码", { exact: true }).fill(nextPassword);
  await page.getByLabel("确认新密码").fill(nextPassword);
  await page.getByRole("button", { name: "更新密码" }).click();
  await expect(page.getByRole("heading", { name: "系统概览", exact: true })).toBeVisible();

  const managementContext = await browser.newContext();
  const managementPage = await managementContext.newPage();
  await signIn(managementPage, adminEmail, adminPassword);
  await managementPage.goto("/admin/users?accountType=admin");
  await managementPage.getByPlaceholder("搜索姓名或邮箱").fill(email);
  const row = managementPage.locator("tbody tr").filter({ hasText: email });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "停用" }).click();
  await expect(row.getByText("已停用", { exact: true }).first()).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);

  await row.getByRole("button", { name: "删除" }).click();
  const deleteDialog = managementPage.getByRole("dialog", { name: "删除" });
  await deleteDialog.getByLabel("请输入该账号邮箱以确认永久删除").fill(email);
  await deleteDialog.getByRole("button", { name: "删除", exact: true }).click();
  await expect(row).toHaveCount(0);
  await managementContext.close();
});
