import { defineConfig } from '@playwright/test';

// Makes the Chrome Web Store images in store/images: `pnpm store:images`, which builds dist/chrome-mv3 first.
export default defineConfig({
  testDir: './e2e/store',
  workers: 1,
  timeout: 120_000,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
});
