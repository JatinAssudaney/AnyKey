import type { BrowserContext, Page } from '@playwright/test';
import { expect, FIXTURE_ORIGIN, pageKeys, pressUntil, stored, tabIdOf, test, uiText } from './harness.ts';

const PICKER = `${FIXTURE_ORIGIN}/picker.html`;

/** AnyKey's popup for the tab showing `page`, opened as a page of its own. */
async function openPopup(page: Page, context: BrowserContext, extensionId: string): Promise<Page> {
  const helper = await context.newPage();
  await helper.goto(`chrome-extension://${extensionId}/popup.html`);
  const tabId = await tabIdOf(helper, page.url());
  await helper.close();
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  return popup;
}

/** Starts the picker the way people do: "Add shortcut for this site" in the popup, which then closes. */
async function startPicker(page: Page, context: BrowserContext, extensionId: string): Promise<void> {
  const popup = await openPopup(page, context, extensionId);
  const closed = popup.waitForEvent('close');
  await popup.getByRole('button', { name: 'Add shortcut for this site' }).click();
  await closed;
  await page.bringToFront();
  await expect.poll(() => uiText(page, 'ak-banner')).toContain('Pick an element for a shortcut.');
}

function clicks(page: Page): Promise<{ like: number; play: number } | undefined> {
  return page.evaluate(() => window.clicks);
}

/** An extension page, for reading storage. */
async function extensionPage(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  return page;
}

test('a picked button becomes a shortcut that clicks it, across route changes', async ({
  page,
  extensionContext,
  extensionId,
}) => {
  await page.goto(PICKER);
  await startPicker(page, extensionContext, extensionId);

  await page.locator('#like').hover();
  await expect.poll(() => uiText(page, 'ak-highlight-label')).toBe('Button "Like"');
  await page.locator('#like').click();
  // The picker keeps the click from the page.
  expect(await clicks(page)).toEqual({ like: 0, play: 0 });
  await expect.poll(() => uiText(page, 'ak-panel')).toContain('New shortcut for 127.0.0.1');
  await page.keyboard.type('g l');
  await page.keyboard.press('Enter');
  await expect.poll(() => uiText(page, 'ak-toast')).toBe('Saved "Click Like". Press g then l to use it.');

  const storage = await extensionPage(extensionContext, extensionId);
  expect(await stored(storage)).toMatchObject({
    'site:127.0.0.1': {
      v: 1,
      shortcuts: [
        {
          keys: 'g l',
          keyMode: 'key',
          label: 'Click Like',
          action: { type: 'click', target: { selector: '[data-testid="like-button"]', text: 'Like', tag: 'button' } },
          scope: { type: 'site', match: '*://127.0.0.1/*' },
          source: 'user',
          enabled: true,
        },
      ],
    },
  });

  await pressUntil(page, ['g', 'l'], async () => (await clicks(page))?.like === 1);

  // A single-page app moves to another address: the shortcut covers every page of the site.
  await page.locator('#route').click();
  await expect(page).toHaveURL(`${FIXTURE_ORIGIN}/app/settings`);
  await page.keyboard.press('g');
  await page.keyboard.press('l');
  await expect.poll(async () => (await clicks(page))?.like).toBe(2);

  // Narrowed to the first page, it stops at the new address and works again on the way back.
  await storage.evaluate(async () => {
    const { 'site:127.0.0.1': doc } = await chrome.storage.sync.get('site:127.0.0.1');
    const site = doc as { shortcuts: { scope: unknown }[] };
    for (const shortcut of site.shortcuts) shortcut.scope = { type: 'site', match: '*://127.0.0.1/picker.html' };
    await chrome.storage.sync.set({ 'site:127.0.0.1': site });
  });
  await pressUntil(page, ['g', 'l'], async () => (await pageKeys(page)).includes('keydown:l'));
  expect((await clicks(page))?.like).toBe(2);
  await page.goBack();
  await expect(page).toHaveURL(PICKER);
  await page.keyboard.press('g');
  await page.keyboard.press('l');
  await expect.poll(async () => (await clicks(page))?.like).toBe(3);

  // The page drops the button: a toast says so.
  await page.evaluate(() => document.getElementById('like')?.remove());
  await page.keyboard.press('g');
  await page.keyboard.press('l');
  await expect.poll(() => uiText(page, 'ak-toast')).toBe(`Couldn't find the element for "Click Like" on this page.`);
  await storage.close();
});

test('Esc closes the picker, and the page gets its clicks back', async ({ page, extensionContext, extensionId }) => {
  await page.goto(PICKER);
  const storage = await extensionPage(extensionContext, extensionId);
  const tabId = await tabIdOf(storage, PICKER);
  const session = async (): Promise<unknown> => (await storage.evaluate(() => chrome.storage.session.get(null)))[`picker:${tabId}`];

  await startPicker(page, extensionContext, extensionId);
  expect(await session()).toMatchObject({ host: '127.0.0.1' });
  await page.keyboard.press('Escape');
  await expect.poll(() => uiText(page, 'ak-banner')).toBeNull();
  await expect.poll(session).toBeUndefined();
  await page.locator('#like').click();
  expect(await clicks(page)).toEqual({ like: 1, play: 0 });

  // Esc in the panel ends the picker too, without saving.
  await startPicker(page, extensionContext, extensionId);
  await page.locator('#like').click();
  await expect.poll(() => uiText(page, 'ak-panel')).toContain('New shortcut for 127.0.0.1');
  await page.keyboard.type('g l');
  await page.keyboard.press('Escape');
  await expect.poll(() => uiText(page, 'ak-panel')).toBeNull();
  await expect.poll(session).toBeUndefined();
  await page.locator('#like').click();
  expect(await clicks(page)).toEqual({ like: 2, play: 0 });
  expect(await stored(storage)).toEqual({});
  await storage.close();
});

test('a picked text field becomes a shortcut that focuses it', async ({ page, extensionContext, extensionId }) => {
  await page.goto(PICKER);
  await startPicker(page, extensionContext, extensionId);

  await page.locator('#search').hover();
  await expect.poll(() => uiText(page, 'ak-highlight-label')).toBe('Text field "Search the docs"');
  await page.keyboard.press('Enter');
  await expect.poll(() => uiText(page, 'ak-panel')).toContain('Focus it, to type in it');
  await page.keyboard.type('s');
  await page.keyboard.press('Enter');
  await expect.poll(() => uiText(page, 'ak-toast')).toBe('Saved "Focus Search the docs". Press s to use it.');

  await pressUntil(page, ['s'], () => page.evaluate(() => document.activeElement?.id === 'search'));
  // Once the field has focus, s is typed into it.
  await page.keyboard.type('sort');
  await expect(page.locator('#search')).toHaveValue('sort');
});

test('Tab and Enter pick a link, and the shortcut follows it', async ({ page, extensionContext, extensionId }) => {
  await page.goto(PICKER);
  await startPicker(page, extensionContext, extensionId);

  await page.keyboard.press('Tab');
  await expect.poll(() => uiText(page, 'ak-banner-status')).toBe('Button "Like"');
  await page.keyboard.press('Tab');
  await expect.poll(() => uiText(page, 'ak-banner-status')).toBe('Link "Docs"');
  await page.keyboard.press('Enter');
  await expect.poll(() => uiText(page, 'ak-panel')).toContain('Open the link in a new tab');
  await page.keyboard.type('g d');
  await page.keyboard.press('Enter');
  await expect.poll(() => uiText(page, 'ak-toast')).toBe('Saved "Click Docs". Press g then d to use it.');

  await pressUntil(page, ['g', 'd'], () => Promise.resolve(page.url() === `${FIXTURE_ORIGIN}/basic.html`));
});

test('the picker reaches into closed shadow roots', async ({ page, extensionContext, extensionId }) => {
  await page.goto(PICKER);
  await startPicker(page, extensionContext, extensionId);

  // Playwright can't see inside the closed root, but the player's box is its button's.
  await page.locator('video-player').click();
  await expect.poll(() => uiText(page, 'ak-panel')).toContain('Button "Play"');
  await page.keyboard.type('g p');
  await page.keyboard.press('Enter');
  await expect.poll(() => uiText(page, 'ak-toast')).toBe('Saved "Click Play". Press g then p to use it.');
  expect(await clicks(page)).toEqual({ like: 0, play: 0 });

  const storage = await extensionPage(extensionContext, extensionId);
  expect(await stored(storage)).toMatchObject({
    'site:127.0.0.1': {
      shortcuts: [{ action: { type: 'click', target: { selector: 'video-player >>> button.play', text: 'Play' } } }],
    },
  });
  await storage.close();
  await pressUntil(page, ['g', 'p'], async () => (await clicks(page))?.play === 1);
});
