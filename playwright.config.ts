import { defineConfig } from '@playwright/test';
import { FIXTURE_ORIGIN, type Platform } from './e2e/constants.ts';

// Run with `pnpm test:e2e`, which builds dist/chrome-mv3 first.
export default defineConfig<object, { platform: Platform }>({
  testDir: './e2e',
  // The live sites and the store images have configs of their own: playwright.live.config.ts and
  // playwright.store.config.ts.
  testIgnore: ['live/**', 'store/**'],
  // All tests in a worker share one Chromium profile with the extension loaded.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  // Every test runs twice: as the machine it runs on, and as Windows, where `mod` is Ctrl and keys are named in words.
  projects: [{ name: 'host' }, { name: 'windows', use: { platform: 'windows' } }],
  webServer: {
    command: 'node e2e/server.ts',
    url: `${FIXTURE_ORIGIN}/health`,
    reuseExistingServer: !process.env.CI,
  },
});
