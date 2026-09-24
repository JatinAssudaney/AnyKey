import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type BrowserContext, type Page } from '@playwright/test';
import {
  expect,
  extensionWorker,
  launchExtensionContext,
  openCheatsheetText,
  shownHints,
  tabIdOf,
  uiBox,
  uiText,
  welcomePage,
} from '../harness.ts';

// Makes the Chrome Web Store images in store/images: `pnpm store:images`, which builds dist/chrome-mv3 first. The
// screenshots show the real extension on store/demo.html, a made-up recipe site served as pantry.example, and on
// AnyKey's own pages. Run it again whenever the UI they show changes.

const STORE = path.resolve(import.meta.dirname, '../../store');
const DEMO = 'https://pantry.example/recipes/lemon-garlic-spaghetti';
const ICON = path.resolve(import.meta.dirname, '../../src/assets/icon.svg');

function out(name: string): string {
  return path.join(STORE, 'images', name);
}

test.describe.configure({ mode: 'serial' });

test('screenshots', async () => {
  // 1024 by 640 at 1.25 device pixels each: the store's 1280 by 800, with the UI a little larger than life, so it
  // reads in the store's gallery.
  const context = await launchExtensionContext({ viewport: { width: 1024, height: 640 }, deviceScaleFactor: 1.25 });
  try {
    await (await welcomePage(context)).close();
    const extensionId = new URL((await extensionWorker(context)).url()).host;
    await context.route('https://pantry.example/**', (route) => route.fulfill({ path: path.join(STORE, 'demo.html') }));
    const page = await context.newPage();
    await page.goto(DEMO);
    await expect
      .poll(async () => {
        if ((await openCheatsheetText(page)) === null) await page.keyboard.press('?');
        return openCheatsheetText(page);
      })
      .not.toBeNull();
    await page.keyboard.press('Escape');
    await expect.poll(() => openCheatsheetText(page)).toBeNull();
    const plainPage = await page.screenshot();

    // Giving the Save recipe button a key, with the popup's "Add shortcut for this site".
    await openPopup(page, context, extensionId, async (popup) => {
      const closed = popup.waitForEvent('close');
      await popup.getByRole('button', { name: 'Add shortcut for this site' }).click();
      await closed;
    });
    await page.bringToFront();
    const save = page.getByRole('button', { name: 'Save recipe' });
    await save.hover();
    await save.click();
    await expect.poll(() => uiText(page, 'ak-panel')).toContain('New shortcut for pantry.example');
    await page.keyboard.press('g');
    await page.keyboard.press('s');
    await expect.poll(() => uiText(page, 'ak-panel')).toContain('g then s');
    await page.screenshot({ path: out('screenshot-2-picker.png') });
    await page.keyboard.press('Enter');
    await expect.poll(() => uiText(page, 'ak-banner-status')).toContain('Saved');
    await page.keyboard.press('Escape');
    // The toast that confirms the new shortcut hides after a few seconds, when it no longer has a box.
    await expect.poll(() => uiBox(page, 'ak-toast').catch(() => null), { timeout: 10_000 }).toBeNull();

    await page.keyboard.press('Shift+F');
    await expect.poll(async () => (await shownHints(page)).length).toBeGreaterThan(10);
    await page.screenshot({ path: out('screenshot-1-hints.png') });
    await page.keyboard.press('Escape');

    await page.keyboard.press('?');
    await expect.poll(() => openCheatsheetText(page)).toContain('Click Save recipe');
    await page.screenshot({ path: out('screenshot-4-cheatsheet.png') });
    await page.keyboard.press('Escape');

    // The popup, where the browser shows it: below the toolbar, at the right.
    let popupShot: Buffer = Buffer.alloc(0);
    await openPopup(page, context, extensionId, async (popup) => {
      await expect(popup.getByRole('heading', { name: 'Shortcuts for this site' })).toBeVisible();
      await expect(popup.getByText('Click Save recipe')).toBeVisible();
      popupShot = await popup.locator('main').screenshot();
    });
    const stage = await context.newPage();
    await stage.setContent(
      `<body style="margin:0">` +
        `<img src="data:image/png;base64,${plainPage.toString('base64')}" style="display:block;width:1024px" alt="">` +
        `<img src="data:image/png;base64,${popupShot.toString('base64')}" style="position:absolute;top:8px;right:16px;` +
        `width:320px;border:1px solid #d6d3d1;border-radius:8px;box-shadow:0 12px 32px rgb(0 0 0 / 0.25)" alt="">` +
        `</body>`,
    );
    await stage.screenshot({ path: out('screenshot-3-popup.png') });
    await stage.close();

    // The settings for a site with a preset: its shortcuts, which can be changed or switched off one by one.
    const options = await context.newPage();
    // The site's arrow turns as it opens: without the animation, the screenshot never catches it halfway.
    await options.emulateMedia({ reducedMotion: 'reduce' });
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await options.getByRole('button', { name: 'github.com', exact: true }).click();
    const site = options.getByRole('region', { name: 'github.com', exact: true });
    await expect(site.getByRole('table', { name: 'GitHub preset shortcuts' })).toBeVisible();
    await options.getByRole('heading', { name: 'Sites', exact: true }).evaluate((heading) => {
      window.scrollBy(0, heading.getBoundingClientRect().top - 24);
    });
    await options.screenshot({ path: out('screenshot-5-presets.png') });
  } finally {
    await context.close();
  }
});

test('store icon and promo tiles', async ({ page }) => {
  // The toolbar icon's artwork, 120 of its 128 pixels wide, drawn 96 wide in the middle: the store wants 16 clear
  // pixels on each side.
  const svg = await readFile(ICON, 'base64');
  await page.setViewportSize({ width: 128, height: 128 });
  await page.setContent(
    `<body style="margin:0;background:transparent">` +
      `<img src="data:image/svg+xml;base64,${svg}" alt="" ` +
      `style="position:absolute;left:12.8px;top:12px;width:102.4px;height:102.4px"></body>`,
  );
  await page.screenshot({ path: out('icon-128.png'), omitBackground: true });

  for (const [size, width, height] of [
    ['small', 440, 280],
    ['marquee', 1400, 560],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(`${pathToFileURL(path.join(STORE, 'promo.html')).href}?size=${size}`);
    await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
    await page.screenshot({ path: out(`promo-${size}.png`) });
  }
});

/** AnyKey's popup for the tab showing `page`, opened as a page of its own, for `use` to act in. */
async function openPopup(
  page: Page,
  context: BrowserContext,
  extensionId: string,
  use: (popup: Page) => Promise<void>,
): Promise<void> {
  const helper = await context.newPage();
  await helper.goto(`chrome-extension://${extensionId}/popup.html`);
  const tabId = await tabIdOf(helper, page.url());
  await helper.close();
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  await use(popup);
  if (!popup.isClosed()) await popup.close();
}
