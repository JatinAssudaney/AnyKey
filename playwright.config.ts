import { defineConfig } from '@playwright/test';
import { FIXTURE_ORIGIN } from './e2e/constants.ts';

// Run with `pnpm test:e2e`, which builds dist/chrome-mv3 first.
export default defineConfig({
  testDir: './e2e',
  // The live sites and the store images have configs of their own: playwright.live.config.ts and
  // playwright.store.config.ts.
  testIgnore: ['live/**', 'store/**'],
  // All tests in a worker share one Chromium profile with the extension loaded.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  webServer: {
    command: 'node e2e/server.ts',
    url: `${FIXTURE_ORIGIN}/health`,
    reuseExistingServer: !process.env.CI,
  },
});
