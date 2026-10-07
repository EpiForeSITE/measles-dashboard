import { defineConfig } from "@playwright/test";

// Runs against the production build (`npm run build` first).
// PW_CHANNEL=chrome uses an installed Chrome instead of Playwright's Chromium.
export default defineConfig({
  testDir: "test/e2e",
  timeout: 120000,
  use: {
    baseURL: "http://localhost:4173",
    browserName: "chromium",
    channel: process.env.PW_CHANNEL || undefined,
  },
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
