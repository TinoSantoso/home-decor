import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Phase 1 happy-path E2E coverage (plan §17).
 *
 * Single browser (Chromium) is enough for MVP — multi-browser parity
 * comes in Phase 3 when we test the mobile responsive 2D fallback path.
 *
 * `webServer` auto-launches `npm run dev` if nothing is listening on
 * port 3000. Locally `reuseExistingServer: true` avoids stomping on a
 * dev server you already have running; CI always starts a fresh one.
 */
export default defineConfig({
  testDir: './tests-e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'id-ID',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
