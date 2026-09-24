import path from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { expect, openCheatsheetText, pageKeys, pressUntil, scrollY, stored, tabIdOf, test } from './harness.ts';

const WATCH = 'https://www.youtube.com/watch?v=abc';
const HOME = 'https://www.youtube.com/';
const FIXTURE = path.resolve(import.meta.dirname, 'fixtures/youtube.html');

/** Serves the fixture as every page of www.youtube.com, once the background has installed the presets. */
async function fakeYouTube(page: Page, extensionContext: BrowserContext, extensionId: string): Promise<void> {
  await page.route('https://www.youtube.com/**', (route) => route.fulfill({ path: FIXTURE }));
  const extensionPage = await extensionContext.newPage();
  await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect
    .poll(() => extensionPage.evaluate(async () => Object.keys(await chrome.storage.local.get('presets')).length))
    .toBe(1);
  await extensionPage.close();
}

async function likes(page: Page): Promise<number> {
  return page.evaluate(() => window.clicks?.like ?? 0);
}

test("YouTube's own keys win over AnyKey's on its video pages, and nowhere else", async ({
  page,
  extensionContext,
  extensionId,
}) => {
  await fakeYouTube(page, extensionContext, extensionId);
  await page.goto(WATCH);
  // Once AnyKey is ready, its cheatsheet lists the keys that still reach YouTube.
  await expect
    .poll(async () => {
      if ((await openCheatsheetText(page)) === null) await page.keyboard.press('?');
      return openCheatsheetText(page);
    })
    .toContain("YouTube's own keys");
  const text = (await openCheatsheetText(page)) ?? '';
  expect(text).toContain('Go back 10 seconds');
  expect(text).toContain('Like the video');
  // The site's own keys come first, and keys that do the same thing share a row.
  expect(text.indexOf("YouTube's own keys")).toBeLessThan(text.indexOf('Scrolling'));
  expect(text).toContain('k or Space Play or pause');
  await page.keyboard.press('Escape');
  await expect.poll(() => openCheatsheetText(page)).toBeNull();

  await page.evaluate(() => {
    window.pageKeys = [];
  });
  await page.keyboard.press('j');
  await page.keyboard.press('k');
  expect(await pageKeys(page)).toEqual(['keydown:j', 'keyup:j', 'keydown:k', 'keyup:k']);
  expect(await scrollY(page)).toBe(0);
  // YouTube uses d only in 360° videos, so AnyKey keeps it.
  await page.keyboard.press('d');
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
  expect(await pageKeys(page)).not.toContain('keydown:d');

  // YouTube's player keys work on video pages only, so j scrolls everywhere else.
  await page.goto(HOME);
  await pressUntil(page, ['j'], async () => (await scrollY(page)) > 0);
});

test("a preset's shortcut works on the page, and the popup lists it with the keys that go to the site", async ({
  page,
  extensionContext,
  extensionId,
}) => {
  await fakeYouTube(page, extensionContext, extensionId);
  await page.goto(WATCH);
  await pressUntil(page, ['g', 'l'], async () => (await likes(page)) > 0);

  const popup = await extensionContext.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${await tabIdOf(popup, WATCH)}`);
  const preset = popup.getByRole('region', { name: 'YouTube preset' });
  const like = preset.getByRole('listitem').filter({ has: popup.getByText('Like the video', { exact: true }) });
  await expect(like.locator('kbd')).toHaveText(['g', 'l']);
  await expect(preset).toContainText("On this page, j and k run YouTube's own shortcuts instead of AnyKey's.");
  await popup.close();
});

test('settings keep a built-in shortcut on the site, rekey a preset shortcut, and reset to the preset', async ({
  page,
  extensionContext,
  extensionId,
}) => {
  await fakeYouTube(page, extensionContext, extensionId);
  await page.goto(WATCH);
  const options = await extensionContext.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByRole('button', { name: 'www.youtube.com', exact: true }).click();
  const youtube = options.getByRole('region', { name: 'www.youtube.com', exact: true });
  await expect(youtube.getByRole('rowheader', { name: /^Like the video/ })).toContainText('Unverified');

  await youtube.getByText('Built-in shortcuts that give way to YouTube').click();
  await youtube.getByRole('switch', { name: /^Keep "Scroll down"/ }).check();
  await youtube.getByRole('button', { name: 'Edit Like the video', exact: true }).click();
  const dialog = options.getByRole('dialog', { name: 'Edit "Like the video"' });
  await dialog.getByLabel('Keys', { exact: true }).fill('g o');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => stored(options)).toMatchObject({
    'site:www.youtube.com': { globals: { 'default:scroll-down': { enabled: true } } },
    'preset:youtube': { overrides: { 'preset:youtube:like': { keys: 'g o', keyMode: 'key' } } },
  });

  await page.bringToFront();
  await pressUntil(page, ['j'], async () => (await scrollY(page)) > 0);
  await pressUntil(page, ['g', 'o'], async () => (await likes(page)) > 0);

  await options.bringToFront();
  await youtube.getByRole('button', { name: 'Reset to the YouTube preset' }).click();
  await options
    .getByRole('dialog', { name: 'Reset www.youtube.com to the YouTube preset?' })
    .getByRole('button', { name: 'Reset' })
    .click();
  await expect.poll(() => stored(options)).toEqual({});
  // The Reset button went away with the changes, so focus moves to the site's Add button.
  await expect(youtube.getByRole('button', { name: 'Add shortcut for www.youtube.com' })).toBeFocused();
  await options.close();
});
