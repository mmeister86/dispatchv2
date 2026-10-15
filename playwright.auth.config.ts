import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: "**/auth.real-browser.ts",
  use: { ...base.use, baseURL: "http://127.0.0.1:5175" },
  webServer: {
    command: "VITE_DEMO_MODE=false pnpm dev --port 5175",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
    timeout: 15000,
  },
});
