import path from 'node:path';
import { chromium, test as base, type BrowserContext, type Page, type Worker } from '@playwright/test';

export { expect } from '@playwright/test';
export { FIXTURE_ORIGIN } from './constants.ts';

const EXTENSION_PATH = path.resolve(import.meta.dirname, '../dist/chrome-mv3');

interface WorkerFixtures {
  extensionContext: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}

// Branded Chrome 137+ ignores --load-extension, so this uses Playwright's bundled Chromium.
export const test = base.extend<{ page: Page }, WorkerFixtures>({
  extensionContext: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires an object pattern here.
    async ({}, use) => {
      const context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
      });
      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],
  serviceWorker: [
    async ({ extensionContext }, use) => {
      const running = extensionContext.serviceWorkers()[0];
      await use(running ?? (await extensionContext.waitForEvent('serviceworker')));
    },
    { scope: 'worker' },
  ],
  extensionId: [
    async ({ serviceWorker }, use) => {
      await use(new URL(serviceWorker.url()).host);
    },
    { scope: 'worker' },
  ],
  page: async ({ extensionContext }, use) => {
    const page = await extensionContext.newPage();
    await use(page);
    await page.close();
  },
});
