import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLATFORM_ACCEPTANCE_WEB_URL?.trim();
if (!baseURL) {
  throw new Error("PLATFORM_ACCEPTANCE_WEB_URL is required for Platform browser acceptance");
}

const reportPath = path.resolve(
  process.env.PLAYWRIGHT_JSON_OUTPUT_FILE ||
    path.join(".runtime", "acceptance", "browser-results.json"),
);
const artifactDir = path.resolve(
  process.env.PLATFORM_ACCEPTANCE_BROWSER_ARTIFACT_DIR ||
    path.join(".runtime", "acceptance", "browser-artifacts"),
);
const explicitExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?.trim();
const channel =
  process.env.PLAYWRIGHT_CHROMIUM_CHANNEL?.trim() ||
  (process.platform === "win32" ? "msedge" : "chrome");
const browserUse = explicitExecutable
  ? { launchOptions: { executablePath: explicitExecutable } }
  : { channel };

export default defineConfig({
  testDir: "./web/e2e",
  testMatch: "**/*.spec.ts",
  outputDir: artifactDir,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["line"],
    ["json", { outputFile: reportPath }],
  ],
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    ...browserUse,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 960 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
});
