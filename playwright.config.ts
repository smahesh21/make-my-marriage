import { defineConfig } from "@playwright/test";

// Synthetic browser coverage only: no user profiles, live DB or provider keys.
// Build once before running. Do not share a running development server/build.
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  workers: 2,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3002",
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next start -p 3002 -H 127.0.0.1",
    url: "http://127.0.0.1:3002/photos",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
