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
  await expect(async () => {
    await page.getByRole("link", { name: "全部日志" }).click();
    await expect(page).toHaveURL(/\/admin\/logs/);
  }).toPass();
  await expect(page.getByRole("heading", { name: "系统日志" })).toBeVisible();
  await expect(page.getByText("用户、部门、项目及权限等系统治理操作", { exact: true })).toHaveCount(0);
  const timeHeader = page.getByRole("columnheader").filter({ hasText: "时间" });
  const rangeFilter = timeHeader.getByRole("button", { name: "时间范围: 近 30 天" });
  await expect(timeHeader.getByText("近 30 天", { exact: true })).toBeVisible();
  await expect(rangeFilter).toBeVisible();
  const sevenDayRange = page.getByRole("menuitemradio", { name: "近 7 天" });
  await expect(async () => {
    await rangeFilter.click();
    await expect(sevenDayRange).toBeVisible();
  }).toPass();
  await sevenDayRange.click();
  await expect(page).toHaveURL(/range=7/);
  await expect(timeHeader.getByText("近 7 天", { exact: true })).toBeVisible();
  await expect(page.getByText("时间：近 7 天", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "取消筛选：时间" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("range")).toBe("all");
  await expect(page.getByText("全部日志", { exact: true })).toHaveCount(0);
  await expect(page.getByText("时间：全部", { exact: true })).toHaveCount(0);
  const actionHeader = page.getByRole("columnheader").filter({ hasText: "操作类型" });
  await actionHeader.getByRole("button", { name: "操作类型: 全部" }).click();
  await page.getByRole("menuitemcheckbox", { name: "创建", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("action")).toBe("CREATE");
  const updateAction = page.getByRole("menuitemcheckbox", { name: "更新", exact: true });
  if (!(await updateAction.isVisible())) {
    await actionHeader.getByRole("button", { name: /操作类型:/ }).click();
  }
  await updateAction.click();
  await expect.poll(() => new URL(page.url()).searchParams.get("action")).toBe("CREATE,UPDATE");
  await page.keyboard.press("Escape");
  await expect(actionHeader.getByText("2", { exact: true })).toBeVisible();
  await expect(page.getByText("操作类型：创建、更新", { exact: true })).toBeVisible();
  await expect(page.getByText(/显示 \d+ 到 \d+ 共 \d+ 条记录/)).toBeVisible();
  await expect(page.locator("span").filter({ hasText: /^每页$/ })).toBeVisible();
  await page.locator("#log-page-size").click();
  await page.getByRole("button", { name: "10", exact: true }).click();
  await expect(page).toHaveURL(/pageSize=10/);

  await page.goto("/admin/logs?range=all&actorId=missing-user");
  await expect(page.getByText("操作者：未知操作者", { exact: true })).toBeVisible();
  await expect(page.getByText("操作者：全部", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "取消筛选：操作者" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("actorId")).toBeNull();
  await expect(page.getByText("操作者：未知操作者", { exact: true })).toHaveCount(0);

  await page.goto("/admin/users?activityStatus=unknown");
  await expect(page.getByText("活跃状态：暂无活动记录", { exact: true })).toBeVisible();
  await expect(page.getByText("最后活跃", { exact: true })).toBeVisible();
  const lastActiveHeader = page.getByRole("columnheader").filter({ hasText: "最后活跃" });
  const activityFilter = lastActiveHeader.getByRole("button", { name: "活跃状态: 暂无活动记录" });
  await expect(lastActiveHeader.getByText("无记录", { exact: true })).toBeVisible();
  await expect(activityFilter).toBeVisible();
  await activityFilter.click();
  await page.getByRole("menuitemradio", { name: "超过 30 天未活跃" }).click();
  await expect(page).toHaveURL(/activityStatus=inactive30/);
  await expect(page.getByText("活跃状态：超过 30 天未活跃", { exact: true })).toBeVisible();
  await expect(lastActiveHeader.getByText("30 天+", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "操作", exact: true })).toHaveCSS("text-align", "left");
  const tableContainer = page.locator('[data-slot="table-container"]');
  await expect.poll(() => tableContainer.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

  await page.goto("/admin/users?search=missing-user-filter&departmentIds=missing-department");
  await expect(page.getByText("搜索：missing-user-filter", { exact: true })).toBeVisible();
  await expect(page.getByText("部门：未知部门", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "取消筛选：搜索" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBeNull();
  await page.getByRole("button", { name: "取消筛选：部门" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("departmentIds")).toBeNull();
});
