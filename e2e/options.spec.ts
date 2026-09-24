import { readFile, writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, FIXTURE_ORIGIN, pageKeys, pressUntil, scrollY, stored, test } from './harness.ts';

const LONG = `${FIXTURE_ORIGIN}/long.html`;

async function openOptions(page: Page, extensionId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'Shortcuts', exact: true })).toBeVisible();
}

test('rekeying a built-in shortcut applies to an open tab right away', async ({ page, extensionContext, extensionId }) => {
  await page.goto(LONG);
  const options = await extensionContext.newPage();
  await openOptions(options, extensionId);

  await options.getByRole('button', { name: 'Edit Scroll down', exact: true }).click();
  const dialog = options.getByRole('dialog', { name: 'Edit "Scroll down"' });
  await dialog.getByLabel('Keys', { exact: true }).fill('n');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(options.getByRole('button', { name: 'Edit Scroll down', exact: true })).toBeFocused();
  await expect
    .poll(() => stored(options))
    .toEqual({ global: { v: 1, shortcuts: [], overrides: { 'default:scroll-down': { keys: 'n' } } } });

  await page.bringToFront();
  await pressUntil(page, ['n'], async () => (await scrollY(page)) > 0);
  const before = (await pageKeys(page)).length;
  await page.keyboard.press('j');
  expect((await pageKeys(page)).slice(before)).toEqual(['keydown:j', 'keyup:j']);
  await options.close();
});

test('turning a built-in shortcut off lets its key through to the page', async ({
  page,
  extensionContext,
  extensionId,
}) => {
  await page.goto(LONG);
  const options = await extensionContext.newPage();
  await openOptions(options, extensionId);

  await options.getByRole('checkbox', { name: 'Use Scroll down', exact: true }).uncheck();
  await expect(options.getByRole('button', { name: 'Reset Scroll down', exact: true })).toBeVisible();
  await expect.poll(() => stored(options)).toMatchObject({ global: { overrides: { 'default:scroll-down': { enabled: false } } } });

  await page.bringToFront();
  await pressUntil(page, ['j'], async () => (await pageKeys(page)).includes('keydown:j'));

  await options.getByRole('button', { name: 'Reset Scroll down', exact: true }).click();
  await expect(options.getByRole('checkbox', { name: 'Use Scroll down', exact: true })).toBeChecked();
  await expect.poll(() => stored(options)).toEqual({});
  await options.close();
});

test('the key recorder records a sequence, and Esc cancels it without closing the dialog', async ({
  page,
  extensionId,
}) => {
  await openOptions(page, extensionId);
  await page.getByRole('button', { name: 'Add shortcut' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a shortcut' });
  const keys = dialog.getByLabel('Keys', { exact: true });
  const record = dialog.getByRole('button', { name: 'Record keys' });

  await record.focus();
  await page.keyboard.press('Enter');
  await expect(record).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('g');
  await page.keyboard.press('i');
  // A pause finishes the recording.
  await expect(keys).toHaveValue('g i');
  await expect(record).toHaveAttribute('aria-pressed', 'false');

  await page.keyboard.press('Enter');
  await page.keyboard.press('x');
  await page.keyboard.press('Escape');
  await expect(record).toHaveAttribute('aria-pressed', 'false');
  await expect(dialog).toBeVisible();
  await expect(keys).toHaveValue('g i');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Add shortcut' })).toBeFocused();
});

test('focus moves on when the focused control goes away with a change', async ({ page, extensionId }) => {
  await openOptions(page, extensionId);
  // Reset disappears once the built-in shortcut is back to normal, so its Edit button takes focus.
  await page.getByRole('checkbox', { name: 'Use Close tab', exact: true }).uncheck();
  await expect.poll(() => stored(page)).toMatchObject({ global: { overrides: { 'default:tab-close': { enabled: false } } } });
  await page.getByRole('button', { name: 'Reset Close tab' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Edit Close tab' })).toBeFocused();
  await expect.poll(() => stored(page)).toEqual({});

  // Deleting a shortcut removes its row, so Add shortcut takes focus. An empty name describes the action.
  await page.getByRole('button', { name: 'Add shortcut' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a shortcut' });
  await dialog.getByLabel('Keys', { exact: true }).fill('n');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => stored(page)).toMatchObject({ global: { shortcuts: [{ label: 'Scroll down', keys: 'n' }] } });
  await page.getByRole('button', { name: 'Delete Scroll down' }).click();
  await page.getByRole('dialog', { name: 'Delete "Scroll down"?' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: 'Add shortcut' })).toBeFocused();
  await expect.poll(() => stored(page)).toEqual({});
});

test('repairing damaged settings moves focus to the next Repair button, then to Export', async ({
  page,
  extensionId,
}) => {
  await openOptions(page, extensionId);
  await page.evaluate(() =>
    chrome.storage.sync.set({ settings: { v: 1, scrollStep: 'fast' }, global: { v: 1, shortcuts: 'none' } }),
  );
  async function repair(name: string): Promise<void> {
    await page.getByRole('button', { name: `Repair ${name}` }).click();
    await page.getByRole('dialog', { name: `Repair ${name}?` }).getByRole('button', { name: 'Repair' }).click();
  }
  await repair('your settings');
  await expect(page.getByRole('button', { name: 'Repair your global shortcuts' })).toBeFocused();
  await repair('your global shortcuts');
  await expect(page.getByRole('button', { name: 'Export to a file' })).toBeFocused();
  await expect.poll(() => stored(page)).toEqual({});
});

test('a new shortcut that opens a web address works in open tabs', async ({ page, extensionContext, extensionId }) => {
  await page.goto(LONG);
  const options = await extensionContext.newPage();
  await openOptions(options, extensionId);

  await options.getByRole('button', { name: 'Add shortcut' }).click();
  const dialog = options.getByRole('dialog', { name: 'Add a shortcut' });
  await dialog.getByLabel('Action').selectOption({ label: 'Go to a web address' });
  const url = dialog.getByLabel('Web address');
  await url.fill('javascript:alert(1)');
  await dialog.getByLabel('Name').fill('Basic page');
  await dialog.getByLabel('Keys', { exact: true }).fill('g b');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByText('Use a web address starting with https://')).toBeVisible();
  await expect(url).toBeFocused();

  await url.fill('/basic.html');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(options.getByRole('table', { name: 'Your shortcuts' })).toContainText('Go to /basic.html');
  await expect.poll(async () => Object.keys(await stored(options))).toEqual(['global']);

  await page.bringToFront();
  await pressUntil(page, ['g', 'b'], () => Promise.resolve(page.url() === `${FIXTURE_ORIGIN}/basic.html`));
  await options.close();
});

test('settings reach pages opened after they change', async ({ page, extensionContext, extensionId }) => {
  await openOptions(page, extensionId);
  const distance = page.getByLabel('Scroll distance (pixels)');
  await distance.fill('5');
  await distance.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Use a whole number from 10 to 1000.' })).toBeVisible();
  await distance.fill('150');
  await distance.press('Tab');
  await expect.poll(() => stored(page)).toEqual({ settings: { v: 1, scrollStep: 150 } });

  const tab = await extensionContext.newPage();
  await tab.goto(LONG);
  await tab.keyboard.press('j');
  await expect.poll(() => scrollY(tab)).toBe(150);
  await tab.close();
});

test('export, import, and restoring the backup', async ({ page, extensionId }, testInfo) => {
  await openOptions(page, extensionId);
  const distance = page.getByLabel('Scroll distance (pixels)');
  await distance.fill('120');
  await distance.press('Enter');
  await expect.poll(() => stored(page)).toEqual({ settings: { v: 1, scrollStep: 120 } });

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export to a file' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^anykey-settings-\d{4}-\d{2}-\d{2}\.json$/);
  const file = testInfo.outputPath('export.json');
  await download.saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
    format: 'anykey-settings',
    version: 1,
    items: { settings: { v: 1, scrollStep: 120 } },
  });

  await distance.fill('200');
  await distance.press('Enter');
  await expect.poll(() => stored(page)).toEqual({ settings: { v: 1, scrollStep: 200 } });

  await page.locator('input[type=file]').setInputFiles(file);
  const replace = page.getByRole('dialog', { name: 'Replace your settings?' });
  await expect(replace).toContainText('1 changed setting');
  await replace.getByRole('button', { name: 'Replace my settings' }).click();
  await expect.poll(() => stored(page)).toEqual({ settings: { v: 1, scrollStep: 120 } });
  await expect(distance).toHaveValue('120');

  await page.getByRole('button', { name: 'Restore backup' }).click();
  await page
    .getByRole('dialog', { name: 'Restore the backup?' })
    .getByRole('button', { name: 'Restore backup' })
    .click();
  await expect.poll(() => stored(page)).toEqual({ settings: { v: 1, scrollStep: 200 } });
  await expect(distance).toHaveValue('200');
});

test('a file that is not an export is refused', async ({ page, extensionId }, testInfo) => {
  await openOptions(page, extensionId);
  const file = testInfo.outputPath('notes.json');
  await writeFile(file, '{"hello": "world"}');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByRole('alert').filter({ hasText: "isn't an AnyKey settings export" })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a site shortcut added in settings clicks an element on that site', async ({
  page,
  extensionContext,
  extensionId,
}) => {
  await page.goto(`${FIXTURE_ORIGIN}/picker.html`);
  const options = await extensionContext.newPage();
  await openOptions(options, extensionId);
  await expect(options.getByText('No sites yet.')).toBeVisible();

  await options.getByRole('button', { name: 'Add a site shortcut' }).click();
  const dialog = options.getByRole('dialog', { name: 'Add a shortcut' });
  await expect(dialog.getByLabel('Works on')).toHaveValue('site');
  // A pasted address becomes its site.
  await dialog.getByLabel('Site', { exact: true }).fill(`${FIXTURE_ORIGIN}/picker.html`);
  await expect(dialog.getByLabel('Pages', { exact: true })).toHaveValue('*://127.0.0.1/*');
  await dialog.getByLabel('Element', { exact: true }).fill('#like');
  await dialog.getByLabel('Keys', { exact: true }).fill('q');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => stored(options)).toMatchObject({
    'site:127.0.0.1': {
      shortcuts: [
        {
          keys: 'q',
          action: { type: 'click', target: { selector: '#like' } },
          scope: { type: 'site', match: '*://127.0.0.1/*' },
        },
      ],
    },
  });
  const site = options.getByRole('region', { name: '127.0.0.1', exact: true });
  await expect(site.getByRole('table', { name: 'Shortcuts for 127.0.0.1' })).toBeVisible();

  await page.bringToFront();
  await pressUntil(page, ['q'], async () => (await page.evaluate(() => window.clicks?.like)) === 1);

  // Deleting the site's last shortcut keeps the site listed, with focus on its Add button.
  await site.getByRole('button', { name: /^Delete / }).click();
  await options.getByRole('dialog', { name: /^Delete "/ }).getByRole('button', { name: 'Delete' }).click();
  await expect(options.getByRole('button', { name: 'Add shortcut for 127.0.0.1' })).toBeFocused();
  await expect.poll(() => stored(options)).toEqual({});
  await options.close();
});
