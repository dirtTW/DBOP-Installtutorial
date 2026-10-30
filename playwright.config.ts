import { defineConfig } from "@playwright/test";

const port = 4321;
const baseURL = `http://localhost:${port}/DBOP-Installtutorial/`;

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
  },
  webServer: {
    command: `npm run preview -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
