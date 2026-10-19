import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "knowledge.spec.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3117", trace: "retain-on-failure" },
  webServer: {
    command: "npm run start -- --port 3117",
    url: "http://localhost:3117/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
});
