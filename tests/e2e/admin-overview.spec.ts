import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@neo-jira.local";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "Admin123";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("邮箱地址").fill(adminEmail);
  await page.getByRole("textbox", { name: "密码" }).fill(adminPassword);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL(/\/$/);
});

test("shows system adoption without issue delivery metrics", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "系统概览", exact: true })).toBeVisible();
  await expect(page.getByText("用户总数", { exact: true })).toBeVisible();
  await expect(page.getByText("活跃用户", { exact: true })).toBeVisible();
  await expect(page.getByText("活跃部门", { exact: true })).toBeVisible();
  await expect(page.getByText("问题总数", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "近 7 天" }).click();
  await expect(page.getByRole("heading", { name: "系统使用趋势" })).toBeVisible();
});

test("opens governance logs and activity-filtered users", async ({ page }) => {
  await page.getByRole("link", { name: "全部日志" }).click();
  await expect(page).toHaveURL(/\/admin\/logs/);
  await expect(page.getByRole("heading", { name: "系统日志" })).toBeVisible();

  await page.goto("/admin/users?activityStatus=unknown");
  await expect(page.getByText("最后活跃", { exact: true })).toBeVisible();
  await expect(page.getByText("暂无活动记录", { exact: true })).toBeVisible();
});
