import { defineConfig } from '@playwright/test';

// Checks the presets on the live sites, signed out: `pnpm test:live`, which builds dist/chrome-mv3 first. It needs
// the network and follows the sites' changes, so it stays out of `pnpm test:e2e`. Run it before a release, and when a
// preset shortcut stops finding its element.
export default defineConfig({
  testDir: './e2e/live',
  workers: 1,
  // A live site can be slow to answer once.
  retries: 1,
  timeout: 120_000,
  reporter: 'list',
  // A shortcut that finds nothing navigates nowhere, so waiting for its page fails soon instead of at the test timeout.
  use: { trace: 'retain-on-failure', navigationTimeout: 20_000 },
});
