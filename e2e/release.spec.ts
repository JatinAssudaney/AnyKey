import type { ConsoleMessage } from '@playwright/test';
import {
  expect,
  extensionWorker,
  FIXTURE_ORIGIN,
  launchExtensionContext,
  openCheatsheetText,
  pressUntil,
  scrollY,
  shownHints,
  tabIdOf,
  test,
  uiText,
  welcomePage,
} from './harness.ts';

// Checks from the Chrome Web Store's best practices (docs/launch.md), so no later change undoes them. Each test has a
// browser of its own: one with the back/forward cache on, and one heard from its start.

test('a page where AnyKey was used still goes into the back/forward cache', async ({ platform }) => {
  const context = await launchExtensionContext({ platform, backForwardCache: true });
  try {
    await (await welcomePage(context)).close();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');
    const notCached: string[] = [];
    cdp.on('Page.backForwardCacheNotUsed', ({ notRestoredExplanations }) => {
      notCached.push(...notRestoredExplanations.map(({ type, reason }) => `${type}: ${reason}`));
    });

    await page.goto(`${FIXTURE_ORIGIN}/long.html`);
    await pressUntil(page, ['j'], async () => (await scrollY(page)) > 0);
    await page.keyboard.press('?');
    await expect.poll(() => openCheatsheetText(page)).not.toBeNull();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+F');
    await expect.poll(async () => (await shownHints(page)).length).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    // Still there after going back only if the page was kept, not loaded again.
    await page.evaluate(() => {
      document.documentElement.dataset.kept = 'yes';
    });

    await page.goto(`${FIXTURE_ORIGIN}/basic.html`);
    // A page the cache gives back fires no load event, so wait only for the navigation.
    await page.goBack({ waitUntil: 'commit' });
    await expect.poll(() => page.url()).toBe(`${FIXTURE_ORIGIN}/long.html`);
    expect(notCached).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.dataset.kept)).toBe('yes');
    // AnyKey carries on in the page the cache gave back.
    const top = await scrollY(page);
    await pressUntil(page, ['j'], async () => (await scrollY(page)) > top);
  } finally {
    await context.close();
  }
});

test('nothing AnyKey runs logs an error or a warning', async ({ platform }) => {
  const context = await launchExtensionContext({ platform });
  const problems: string[] = [];
  // The context hears its pages, the content script in them, and the service worker.
  context.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error' && message.type() !== 'warning') return;
    const { url } = message.location();
    // The test server's own misses (a page's favicon) aren't AnyKey's.
    if (url.startsWith(FIXTURE_ORIGIN)) return;
    problems.push(`${message.type()}: ${message.text()} (${url})`);
  });
  context.on('weberror', (error) => problems.push(`uncaught: ${error.error().message}`));
  try {
    const extensionId = new URL((await extensionWorker(context)).url()).host;

    // The welcome page, which the install opened, with AnyKey's keys running in it.
    const welcome = await welcomePage(context);
    await welcome.bringToFront();
    await pressUntil(welcome, ['j'], async () => (await scrollY(welcome)) > 0);
    await welcome.close();

    // A web page: scrolling, the cheatsheet, link hints, and the picker started from the popup.
    const page = await context.newPage();
    await page.goto(`${FIXTURE_ORIGIN}/picker.html`);
    await pressUntil(page, ['?'], async () => (await openCheatsheetText(page)) !== null);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+F');
    await expect.poll(async () => (await shownHints(page)).length).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    const tabId = await tabIdOf(popup, page.url());
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${String(tabId)}`);
    const closed = popup.waitForEvent('close');
    await popup.getByRole('button', { name: 'Add shortcut for this site' }).click();
    await closed;
    await page.bringToFront();
    await page.locator('#like').click();
    await expect.poll(() => uiText(page, 'ak-panel')).toContain('New shortcut for 127.0.0.1');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect.poll(() => uiText(page, 'ak-banner')).toBeNull();

    // The settings: a site with a preset, and the dialog for a new shortcut.
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await options.getByRole('button', { name: 'github.com', exact: true }).click();
    await expect(options.getByRole('table', { name: 'GitHub preset shortcuts' })).toBeVisible();
    await options.getByRole('button', { name: 'Add shortcut', exact: true }).click();
    await options.keyboard.press('Escape');
    await expect(options.getByRole('dialog')).toBeHidden();

    expect(problems).toEqual([]);
  } finally {
    await context.close();
  }
});
