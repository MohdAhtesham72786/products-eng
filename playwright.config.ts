import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: "list",
  webServer: {
    command: "node scripts/browser-server.mjs",
    url: "http://127.0.0.1:3000/health/ready",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
