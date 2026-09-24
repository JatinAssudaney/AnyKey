import path from 'node:path';
import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type BrowserContextOptions,
  type CDPSession,
  type Page,
  type Worker,
} from '@playwright/test';

export { expect } from '@playwright/test';
export { FIXTURE_ORIGIN } from './constants.ts';

const EXTENSION_PATH = path.resolve(import.meta.dirname, '../dist/chrome-mv3');

/** A fresh Chromium profile with the built extension loaded. The options size its pages (the store images). */
export async function launchExtensionContext(
  options: Pick<BrowserContextOptions, 'viewport' | 'deviceScaleFactor'> = {},
): Promise<BrowserContext> {
  // Branded Chrome 137+ ignores --load-extension, so this uses Playwright's bundled Chromium.
  return chromium.launchPersistentContext('', {
    ...options,
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });
}

/**
 * A fresh Chromium profile with no extension yet, so pages can be open before `loadExtension` installs AnyKey, as
 * they are in a browser people already use. Loading it again updates it.
 */
export async function launchContextWithoutExtension(): Promise<BrowserContext> {
  return chromium.launchPersistentContext('', {
    channel: 'chromium',
    // Playwright turns extensions off unless it loads them itself; this one loads through the DevTools protocol.
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging'],
  });
}

/** Installs the built extension into a running browser, or updates it: as the browser does from the Web Store. */
export async function loadExtension(context: BrowserContext): Promise<void> {
  const browser = context.browser();
  if (browser === null) throw new Error('No browser to load the extension into');
  const cdp = await browser.newBrowserCDPSession();
  await cdp.send('Extensions.loadUnpacked', { path: EXTENSION_PATH });
  await cdp.detach();
}

export async function extensionWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
}

/** The welcome page, which AnyKey opens when it is installed: in every profile `launchExtensionContext` makes. */
export async function welcomePage(context: BrowserContext): Promise<Page> {
  const find = (): Page | undefined => context.pages().find((page) => page.url().endsWith('/welcome.html'));
  await expect.poll(() => find() !== undefined, { message: 'Installing AnyKey opens its welcome page' }).toBe(true);
  const page = find();
  if (page === undefined) throw new Error('The welcome page closed');
  return page;
}

interface WorkerFixtures {
  extensionContext: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}

interface TestFixtures {
  page: Page;
  /** Runs before every test: clears the user's data from AnyKey's storage, so no test sees another's settings. */
  freshStorage: undefined;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  extensionContext: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires an object pattern here.
    async ({}, use) => {
      const context = await launchExtensionContext();
      // Tests start without the page that installing AnyKey opens, so none finds a tab it didn't open.
      await (await welcomePage(context)).close();
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
  freshStorage: [
    async ({ extensionContext, extensionId }, use) => {
      // An extension page rather than the service worker, which Chrome may have stopped for being idle.
      const page = await extensionContext.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await page.evaluate(async () => {
        // Sync storage counts every clear against its write quota, so clear only when there is something to clear.
        if (Object.keys(await chrome.storage.sync.get(null)).length > 0) await chrome.storage.sync.clear();
        // The presets stay: the background installs them only when the extension starts.
        await chrome.storage.local.remove('backup');
      });
      await page.close();
      await use(undefined);
    },
    { auto: true },
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

/** Waits until the background has installed the bundled presets, which it does as AnyKey starts. */
export async function waitForPresets(context: BrowserContext, extensionId: string): Promise<void> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect
    .poll(() => page.evaluate(async () => Object.keys(await chrome.storage.local.get('presets')).length))
    .toBe(1);
  await page.close();
}

/** Everything in sync storage, read from an extension page. */
export function stored(extensionPage: Page): Promise<Record<string, unknown>> {
  return extensionPage.evaluate(() => chrome.storage.sync.get(null));
}

/** Presses keys until the check passes: a tab picks up a settings change a moment after it is saved. */
export async function pressUntil(page: Page, keys: readonly string[], check: () => Promise<boolean>): Promise<void> {
  await expect
    .poll(async () => {
      for (const key of keys) await page.keyboard.press(key);
      return check();
    })
    .toBe(true);
}

/**
 * The id of the tab showing `url`. Without the `tabs` permission AnyKey can't read tab URLs, so this asks the
 * content script in each tab, as the popup does.
 */
export async function tabIdOf(extensionPage: Page, url: string): Promise<number> {
  const id = await extensionPage.evaluate(async (wanted) => {
    for (const tab of await chrome.tabs.query({})) {
      if (tab.id === undefined) continue;
      try {
        const info: unknown = await chrome.tabs.sendMessage(tab.id, { type: 'pageInfo' }, { frameId: 0 });
        if (typeof info === 'object' && info !== null && 'url' in info && info.url === wanted) return tab.id;
      } catch {
        // No AnyKey in this tab.
      }
    }
    return null;
  }, url);
  if (id === null) throw new Error(`No tab with AnyKey shows ${url}`);
  return id;
}

/** The fields of a DevTools protocol DOM node that the helpers below read. */
interface DomNode {
  nodeId: number;
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
  const dialog = find(await pierceDocument(page), (node) => node.nodeName === 'DIALOG' && (node.attributes ?? []).includes('open'));
  return dialog === undefined ? null : textOf(dialog).replace(/\s+/g, ' ').trim();
}

/**
 * The text of the first element in AnyKey's UI with the class, such as "ak-toast", or null when there is none. Read
 * through the DevTools protocol, as `openCheatsheetText` is.
 */
export async function uiText(page: Page, className: string): Promise<string | null> {
  const node = find(await pierceDocument(page), (node) => classesOf(node).includes(className));
  return node === undefined ? null : textOf(node).replace(/\s+/g, ' ').trim();
}

/** A link hint showing on the page: its whole label, and where its top left corner shows in the viewport. */
export interface ShownHint {
  label: string;
  x: number;
  y: number;
}

/** Where an element shows in the viewport: its border box. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where the first element in AnyKey's UI with the class shows, or null when there is none. */
export async function uiBox(page: Page, className: string): Promise<Box | null> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    const node = find(root, (node) => classesOf(node).includes(className));
    return node === undefined ? null : await borderBox(cdp, node.nodeId);
  } finally {
    await cdp.detach();
  }
}

/**
 * The link hints showing, in the order they were made: the ones that go on with what was typed, and whose elements
 * are in view. Read through the DevTools protocol, as `uiText` is, with where each hint is drawn.
 */
export async function shownHints(page: Page): Promise<ShownHint[]> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const hints: DomNode[] = [];
    const visit = (node: DomNode): void => {
      const hidden = attribute(node, 'hidden') !== null || (attribute(node, 'style') ?? '').includes('hidden');
      if (classesOf(node).includes('ak-link-hint') && !hidden) hints.push(node);
      for (const child of [...(node.shadowRoots ?? []), ...(node.children ?? [])]) visit(child);
    };
    visit((await cdp.send('DOM.getDocument', { depth: -1, pierce: true })).root);
    return await Promise.all(
      hints.map(async (node) => {
        const { x, y } = await borderBox(cdp, node.nodeId);
        return { label: textOf(node).replace(/\s+/g, ''), x, y };
      }),
    );
  } finally {
    await cdp.detach();
  }
}

async function borderBox(cdp: CDPSession, nodeId: number): Promise<Box> {
  const { model } = await cdp.send('DOM.getBoxModel', { nodeId });
  // Four corners, x and y each, clockwise from the top left.
  const [x = Number.NaN, y = Number.NaN, right = Number.NaN, , , bottom = Number.NaN] = model.border;
  return { x, y, width: right - x, height: bottom - y };
}

/** The whole document, shadow roots included, as the DevTools protocol sees it. */
async function pierceDocument(page: Page): Promise<DomNode> {
  const cdp = await page.context().newCDPSession(page);
  try {
    return (await cdp.send('DOM.getDocument', { depth: -1, pierce: true })).root;
  } finally {
    await cdp.detach();
  }
}

function attribute(node: DomNode, name: string): string | null {
  const attributes = node.attributes ?? [];
  // Attributes come as a flat list of names and values.
  for (let i = 0; i < attributes.length; i += 2) {
    if (attributes[i] === name) return attributes[i + 1] ?? '';
  }
  return null;
}

function classesOf(node: DomNode): string[] {
  return (attribute(node, 'class') ?? '').split(/\s+/);
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
