import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests E2E para SGI. Para correr:
 *   1. `npm run build && npm run start` en una terminal
 *   2. `npm run test:e2e` en otra
 * O configurar el webServer (comentado) si CI lo requiere.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    locale: "es-AR",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Descomentar para auto-arrancar Next.js en CI:
  // webServer: {
  //   command: "npm run start",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
