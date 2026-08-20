import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@neo-jira.local";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "Admin123";

test("redirects anonymous users to the login page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("登录 SYNC")).toBeVisible();
});

test("signs in with the development admin account", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("邮箱地址").fill(adminEmail);
  await page.getByRole("textbox", { name: "密码" }).fill(adminPassword);
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "系统概览", exact: true })).toBeVisible();
});
