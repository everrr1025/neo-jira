import { expect, test } from "@playwright/test";

// Point these at a test project with a visible boolean issue extension field.
const issueListPath = process.env.E2E_ISSUE_LIST_PATH;
const fieldName = process.env.E2E_ISSUE_FIELD_NAME;

test("custom column menu is on screen, retains its summary, and supports sorting", async ({ page }) => {
  test.skip(!issueListPath || !fieldName, "Set E2E_ISSUE_LIST_PATH and E2E_ISSUE_FIELD_NAME for the test project");
  await page.goto("/login");
  await page.getByLabel("邮箱地址").fill(process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@neo-jira.local");
  await page.getByRole("textbox", { name: "密码" }).fill(process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "Admin123");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto(issueListPath!);
  const originalUrl = page.url();
  try {
    await page.getByRole("button", { name: `${fieldName}: 全部`, exact: true }).click();
    const menu = page.getByRole("dialog");
    // Visibility alone passes for the old bug: the dialog existed at y=-160.
    await expect(menu).toBeInViewport();
    await menu.getByRole("combobox", { name: fieldName, exact: true }).click();
    await page.getByRole("option", { name: "等于", exact: true }).click();
    await expect(page).toHaveURL(/issueField_.*_op=EQ/);
    await expect(menu).toBeInViewport();
    await menu.press("Escape");
    const summary = page.getByRole("button", { name: `${fieldName}: 等于 是`, exact: true });
    await expect(summary).toHaveText("等于 是");
    await expect(summary.locator("svg")).toHaveCount(0);
    await summary.click();
    await expect(menu).toBeInViewport();
    await menu.getByRole("button", { name: "清除", exact: true }).click();
    await expect(page).not.toHaveURL(/issueField_.*_op=/);
    await menu.press("Escape");
    const sortButton = page.getByRole("button", { name: fieldName, exact: true });
    await sortButton.click();
    await expect(page).toHaveURL(/sortBy=issueField%3A.*sortDirection=asc/);
    await sortButton.click();
    await expect(page).toHaveURL(/sortDirection=desc/);
  } finally {
    await page.goto(originalUrl);
  }
});
