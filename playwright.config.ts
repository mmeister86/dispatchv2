import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const systemChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 8000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
        (existsSync(systemChrome) ? systemChrome : undefined),
    },
  },
  webServer: {
    command: "VITE_DEMO_MODE=true pnpm dev --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    timeout: 15000,
  },
});
