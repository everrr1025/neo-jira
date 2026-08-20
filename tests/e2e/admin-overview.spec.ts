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
  await expect(page.getByRole("group", { name: "用户", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "文件", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "空间", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "近 30 天新增", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "沉默用户", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "沉默部门", exact: true })).toBeVisible();
  const inactivityTooltip = page.getByRole("tooltip");
  await expect(async () => {
    await page.getByRole("button", { name: "沉默判定说明" }).hover();
    await expect(inactivityTooltip.getByText(/沉默用户：普通用户超过所选天数未访问系统/)).toBeVisible();
  }).toPass();
  await expect(inactivityTooltip.getByText(/沉默部门：至少有一名普通成员/)).toBeVisible();
  await expect(page.getByText("活跃用户", { exact: true })).toBeVisible();
  await expect(page.getByText("活跃部门", { exact: true })).toBeVisible();
  await expect(page.getByText("问题总数", { exact: true })).toHaveCount(0);

  const sevenDays = page.getByRole("button", { name: "近 7 天" });
  await expect(async () => {
    await sevenDays.click();
    await expect(sevenDays).toHaveAttribute("aria-pressed", "true");
  }).toPass();
  await expect(page.getByRole("heading", { name: "使用趋势" })).toBeVisible();
});

test("opens governance logs and activity-filtered users", async ({ page }) => {
  await page.getByRole("link", { name: "全部日志" }).click();
  await expect(page).toHaveURL(/\/admin\/logs/);
  await expect(page.getByRole("heading", { name: "系统日志" })).toBeVisible();

  await page.goto("/admin/users?activityStatus=unknown");
  await expect(page.getByText("最后活跃", { exact: true })).toBeVisible();
  await expect(page.getByText("暂无活动记录", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "操作", exact: true })).toHaveCSS("text-align", "left");
  const tableContainer = page.locator('[data-slot="table-container"]');
  await expect.poll(() => tableContainer.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
