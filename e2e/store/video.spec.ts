import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, type Locator, type Page } from '@playwright/test';
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
  type Box,
} from '../harness.ts';

// Captures the stills the demo video (store/video) animates: `pnpm store:images`. Each is the real extension in one
// state, on the made-up recipe site the store screenshots use, at 1280 by 720 CSS pixels and 1.5 device pixels each,
// so 1920 by 1080. layout.json says where the elements the video points at are, in CSS pixels.

const STORE = path.resolve(import.meta.dirname, '../../store');
const OUT = path.join(STORE, 'video/public/frames');
const SITE = 'https://pantry.example';
const DEMO = `${SITE}/recipes/lemon-garlic-spaghetti`;
const SCALE = 1.5;

test('video frames', async () => {
  await mkdir(OUT, { recursive: true });
  const context = await launchExtensionContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: SCALE });
  const boxes: Record<string, Box> = {};
  const labels: Record<string, string> = {};
  const shot = (name: string, target: Page, fullPage = false) =>
    target.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  const measure = async (name: string, locator: Locator) => {
    const box = await locator.boundingBox();
    if (box === null) throw new Error(`${name} isn't on the page`);
    boxes[name] = box;
  };
  const measureUi = async (name: string, page: Page, className: string) => {
    const box = await uiBox(page, className);
    if (box === null) throw new Error(`AnyKey shows no ${className}`);
    boxes[name] = box;
  };

  try {
    await (await welcomePage(context)).close();
    const extensionId = new URL((await extensionWorker(context)).url()).host;
    await context.route(`${SITE}/**`, (route) => route.fulfill({ path: path.join(STORE, 'demo.html') }));
    const page = await context.newPage();

    async function openDemo(url: string): Promise<void> {
      await page.goto(url);
      await expect
        .poll(async () => {
          if ((await openCheatsheetText(page)) === null) await page.keyboard.press('?');
          return openCheatsheetText(page);
        })
        .not.toBeNull();
      await page.keyboard.press('Escape');
      await expect.poll(() => openCheatsheetText(page)).toBeNull();
    }

    // The page as it opens, and all of it, for the video to scroll through.
    await openDemo(DEMO);
    await shot('page', page);
    await shot('page-full', page, true);

    // Link hints, narrowed by the first letter of a label, then followed to another recipe.
    await page.keyboard.press('Shift+F');
    await expect.poll(async () => (await shownHints(page)).length).toBeGreaterThan(10);
    await shot('hints-all', page);
    const card = page.getByRole('link', { name: /Miso glazed salmon/ });
    await measure('hintTarget', card);
    const target = boxes.hintTarget;
    const hint = (await shownHints(page)).find(
      ({ x, y }) => target !== undefined && Math.abs(x - target.x) < 12 && Math.abs(y - target.y) < 12,
    );
    if (hint?.label.length !== 2) throw new Error(`The salmon's hint should have two letters: ${hint?.label}`);
    labels.hint = hint.label.toLowerCase();
    await page.keyboard.press(labels.hint.charAt(0));
    await shot('hints-typed', page);
    await page.keyboard.press(labels.hint.charAt(1));
    await page.waitForURL(`${SITE}/recipes/miso-salmon`);
    await expect(page.getByRole('heading', { name: 'Miso glazed salmon' })).toBeVisible();
    await shot('hints-picked', page);

    // The popup, on its own: the video shows it over the page, where the browser does.
    await openDemo(DEMO);
    const helper = await context.newPage();
    await helper.goto(`chrome-extension://${extensionId}/popup.html`);
    const tabId = await tabIdOf(helper, page.url());
    await helper.close();
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
    const add = popup.getByRole('button', { name: 'Add shortcut for this site' });
    await expect(add).toBeVisible();
    await popup.locator('main').screenshot({ path: path.join(OUT, 'popup.png') });
    const main = await popup.locator('main').boundingBox();
    const addBox = await add.boundingBox();
    if (main === null || addBox === null) throw new Error("The popup's button isn't there");
    boxes.popup = { x: 0, y: 0, width: main.width, height: main.height };
    boxes.popupAdd = { x: addBox.x - main.x, y: addBox.y - main.y, width: addBox.width, height: addBox.height };
    const closed = popup.waitForEvent('close');
    await add.click();
    await closed;

    // Picking the Save button, giving it g s, and pressing g s.
    await page.bringToFront();
    await expect.poll(() => uiText(page, 'ak-banner')).toContain('Pick an element for a shortcut.');
    // The pointer starts on Print, then goes to Save.
    const print = page.getByRole('button', { name: 'Print' });
    await measure('print', print);
    await print.hover();
    await expect.poll(() => uiText(page, 'ak-highlight-label')).toBe('Button "Print"');
    await shot('picker-start', page);
    const save = page.getByRole('button', { name: 'Save recipe' });
    await measure('save', save);
    await save.hover();
    await expect.poll(() => uiText(page, 'ak-highlight-label')).toBe('Button "Save recipe"');
    await shot('picker-hover', page);
    await save.click();
    await expect.poll(() => uiText(page, 'ak-panel')).toContain('New shortcut for pantry.example');
    await shot('picker-panel', page);
    await measureUi('panel', page, 'ak-panel');
    await page.keyboard.press('g');
    await page.keyboard.press('s');
    await shot('picker-keys', page);
    await page.keyboard.press('Enter');
    await expect.poll(() => uiText(page, 'ak-banner-status')).toContain('Saved');
    await shot('picker-saved', page);
    await page.keyboard.press('Escape');
    await expect.poll(() => uiText(page, 'ak-toast')).toContain('Press g then s to use it.');
    await shot('picker-toast', page);
    await measureUi('toast', page, 'ak-toast');
    await expect.poll(() => uiBox(page, 'ak-toast').catch(() => null), { timeout: 10_000 }).toBeNull();
    await page.mouse.move(640, 700);
    await page.keyboard.press('g');
    await page.keyboard.press('s');
    await expect(page.getByRole('button', { name: 'Saved ✓' })).toBeVisible();
    await shot('picker-used', page);

    // The cheatsheet, which now lists the new shortcut.
    await page.keyboard.press('?');
    await expect.poll(() => openCheatsheetText(page)).toContain('Click Save recipe');
    await shot('cheatsheet', page);
    await page.keyboard.press('Escape');

    // A preset's settings.
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await options.getByRole('button', { name: 'github.com', exact: true }).click();
    await expect(options.getByRole('table', { name: 'GitHub preset shortcuts' })).toBeVisible();
    await options.getByRole('heading', { name: 'Sites', exact: true }).evaluate((heading) => {
      window.scrollBy(0, heading.getBoundingClientRect().top - 24);
    });
    await shot('settings', options);

    await writeFile(path.join(OUT, 'layout.json'), `${JSON.stringify({ scale: SCALE, boxes, labels }, null, 2)}\n`);
    await copyFile(path.resolve(STORE, '../src/assets/icon.svg'), path.join(OUT, 'icon.svg'));
  } finally {
    await context.close();
  }
});
