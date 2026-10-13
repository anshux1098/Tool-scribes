import { defineConfig, devices } from "@playwright/test";

/**
 * #21: this used to import `createLovableConfig` from
 * `lovable-agent-playwright-config`, a package present in neither package.json
 * nor package-lock.json. `npx playwright test --list` failed with
 * "Cannot find package ... imported from playwright.config.ts", so the e2e
 * suite could not run at all and silently did nothing in CI.
 *
 * Rewritten against @playwright/test directly, which is a devDependency.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Four smoke specs do not benefit from parallelism. Against the dev server
  // the workers contend while vite is still cold-starting and transform
  // hundreds of modules, which produced a flaky net::ERR_ABORTED on first
  // run. Sequential is both faster to first paint and deterministic.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Keep the CI job bounded. The app talks to a real Supabase project, so
  // treat anything slower as a hang rather than waiting on it.
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? (process.env.CI ? "http://localhost:4173" : "http://localhost:8080"),
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // No server to start when the caller already provides one (E2E_BASE_URL);
  // otherwise Playwright boots it itself. CI builds the bundle first and so
  // gets `vite preview` — the artefact that actually ships, which means the
  // suite exercises the tightened CSP in vercel.json. Local runs get the dev
  // server on 8080 (vite.config.ts), not the 3000 the old scaffold assumed.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "npm run build && npm run preview" : "npm run dev",
        url: process.env.CI ? "http://localhost:4173" : "http://localhost:8080",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});