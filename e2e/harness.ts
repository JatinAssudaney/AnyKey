import path from 'node:path';
import { chromium, test as base, type BrowserContext, type Page, type Worker } from '@playwright/test';

export { expect } from '@playwright/test';
export { FIXTURE_ORIGIN } from './constants.ts';

const EXTENSION_PATH = path.resolve(import.meta.dirname, '../dist/chrome-mv3');

/** A fresh Chromium profile with the built extension loaded. */
export async function launchExtensionContext(): Promise<BrowserContext> {
  // Branded Chrome 137+ ignores --load-extension, so this uses Playwright's bundled Chromium.
  return chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });
}

export async function extensionWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
}

interface WorkerFixtures {
  extensionContext: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}

export const test = base.extend<{ page: Page }, WorkerFixtures>({
  extensionContext: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires an object pattern here.
    async ({}, use) => {
      const context = await launchExtensionContext();
      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],
  serviceWorker: [
    async ({ extensionContext }, use) => {
      await use(await extensionWorker(extensionContext));
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

export async function scrollY(page: Page): Promise<number> {
  return page.evaluate(() => window.scrollY);
}

/** Key events the fixture page's own listeners received, as "keydown:j". */
export async function pageKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => window.pageKeys ?? []);
}

/** The fields of a DevTools protocol DOM node that the helpers below read. */
interface DomNode {
  nodeType: number;
  nodeName: string;
  nodeValue: string;
  attributes?: string[];
  children?: DomNode[];
  shadowRoots?: DomNode[];
}

/**
 * The text of AnyKey's open cheatsheet, or null when none is open. The UI lives in a closed shadow root, which page
 * scripts and Playwright locators can't enter, so this reads the DOM through the DevTools protocol.
 */
export async function openCheatsheetText(page: Page): Promise<string | null> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    const dialog = find(root, (node) => node.nodeName === 'DIALOG' && (node.attributes ?? []).includes('open'));
    return dialog === undefined ? null : textOf(dialog).replace(/\s+/g, ' ').trim();
  } finally {
    await cdp.detach();
  }
}

function find(node: DomNode, predicate: (node: DomNode) => boolean): DomNode | undefined {
  if (predicate(node)) return node;
  for (const child of [...(node.shadowRoots ?? []), ...(node.children ?? [])]) {
    const found = find(child, predicate);
    if (found !== undefined) return found;
  }
  return undefined;
}

function textOf(node: DomNode): string {
  if (node.nodeType === 3) return node.nodeValue;
  return (node.children ?? []).map(textOf).join(' ');
}
