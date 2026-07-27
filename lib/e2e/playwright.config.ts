import { defineConfig } from "@playwright/test";

/**
 * Playwright config for Jazment API e2e tests.
 *
 * Tests target the API server via the workspace proxy (localhost:80/api).
 * Set E2E_BASE_URL to override, e.g. when running against a remote server.
 *
 * Prerequisites: the API Server workflow must be running before executing tests.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 1,
  workers: 1, // run serially to avoid DB contention on shared test data
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:80",
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },
});
