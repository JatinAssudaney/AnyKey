import { expect, FIXTURE_ORIGIN, pageKeys, pressUntil, stored, tabIdOf, test } from './harness.ts';

const PICKER = `${FIXTURE_ORIGIN}/picker.html`;

test("the popup says when AnyKey isn't running in a tab", async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html?tab=999999`);
  await expect(page.getByText("AnyKey isn't running in this tab.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload this tab' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open settings' })).toBeVisible();
});

test('AnyKey asks for a rating after real use, and once more after Not now', async ({
  page,
  extensionContext,
  extensionId,
}) => {
  const popup = await extensionContext.newPage();
  const url = `chrome-extension://${extensionId}/popup.html?tab=999999`;
  const notNow = popup.getByRole('button', { name: 'Not now' });
  const settings = popup.getByRole('button', { name: 'Open settings' });
  await popup.goto(url);
  const seed = (rating: object) => popup.evaluate((value) => chrome.storage.local.set({ rating: value }), rating);
  const rating = () =>
    popup.evaluate(
      async () => (await chrome.storage.local.get('rating')).rating as { uses: number; snoozed?: boolean; done?: boolean },
    );
  try {
    // One short of the threshold: no question yet, and using a shortcut counts.
    await seed({ uses: 9, since: 0 });
    await popup.reload();
    await expect(settings).toBeVisible();
    await expect(notNow).toHaveCount(0);
    await page.goto(`${FIXTURE_ORIGIN}/picker.html#one`);
    await page.goto(PICKER);
    await page.bringToFront();
    await pressUntil(page, ['Shift+H'], async () => (await rating()).uses === 10);

    await popup.reload();
    await expect(popup.getByText('A rating helps other people find it.')).toBeVisible();
    await expect(popup.getByRole('link', { name: 'Rate AnyKey' })).toHaveAttribute('href', /\/reviews$/);
    await notNow.click();
    await expect(notNow).toHaveCount(0);
    await expect.poll(async () => (await rating()).snoozed).toBe(true);
    expect((await rating()).uses).toBe(0);
    await popup.reload();
    await expect(settings).toBeVisible();
    await expect(notNow).toHaveCount(0);

    // The second ask is the last, and shows on the settings page too.
    await seed({ uses: 10, since: 0, snoozed: true });
    await popup.goto(`chrome-extension://${extensionId}/options.html`);
    await notNow.click();
    await expect.poll(async () => (await rating()).done).toBe(true);
    await popup.reload();
    await expect(popup.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(notNow).toHaveCount(0);
  } finally {
    await popup.evaluate(() => chrome.storage.local.remove('rating'));
    // An open settings tab would be reused by the next test that opens the settings.
    await popup.close();
  }
});

test('the popup teaches the key that opens it, as the browser writes it', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html?tab=999999`);
  const commands = await page.evaluate(() => chrome.commands.getAll());
  // The browser gave the command its suggested key: Alt+Shift+K, which macOS writes ⌥⇧K.
  expect(commands.find(({ name }) => name === '_execute_action')?.shortcut).toMatch(/^(⌥⇧K|Alt\+Shift\+K)$/);
  await expect(page.getByText('to open this panel from any tab.').locator('kbd')).toHaveText([
    /^(⌥|Alt)$/,
    /^(⇧|Shift)$/,
    'K',
  ]);
});

test('the popup turns AnyKey off and on for a site', async ({ page, extensionContext, extensionId }) => {
  await page.goto(PICKER);
  const popup = await extensionContext.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${await tabIdOf(popup, PICKER)}`);
  await expect(popup.getByText('127.0.0.1', { exact: true })).toBeVisible();
  await expect(popup.getByRole('heading', { name: 'Shortcuts for this site' })).toBeVisible();

  const use = popup.getByRole('switch', { name: 'Use AnyKey on this site' });
  await use.uncheck();
  await expect(popup.getByText('AnyKey is off here, so every key goes to the site.')).toBeVisible();
  await expect.poll(() => stored(popup)).toEqual({ 'site:127.0.0.1': { v: 1, disabled: true, shortcuts: [] } });
  await page.bringToFront();
  await pressUntil(page, ['j'], async () => (await pageKeys(page)).includes('keydown:j'));

  await use.check();
  await expect.poll(() => stored(popup)).toEqual({});
  // AnyKey takes j again, so the page stops seeing it.
  await expect
    .poll(async () => {
      const before = (await pageKeys(page)).length;
      await page.keyboard.press('j');
      return (await pageKeys(page)).length === before;
    })
    .toBe(true);
  await popup.close();
});

test('the popup teaches hint mode with the keys that show hints on the page', async ({
  page,
  extensionContext,
  extensionId,
}) => {
  await page.goto(PICKER);
  const popup = await extensionContext.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${await tabIdOf(popup, PICKER)}`);
  const hintMode = popup.getByRole('region', { name: 'Hint mode' });
  await expect(hintMode).toContainText('on the page to label every link and button, then type a label to click it.');
  await expect(hintMode).toContainText('keys pick labels instead of running your shortcuts');
  // Shift+F, as macOS or other platforms write it.
  await expect(hintMode.locator('kbd')).toHaveText([/^(⇧|Shift)$/, 'F', 'Esc']);
  await expect(popup.getByText('on the page to see every shortcut.').locator('kbd')).toHaveText(['?']);

  // It follows the user's keys, and goes when hints have none.
  const setOverride = (override: object) =>
    popup.evaluate(
      (value) => chrome.storage.sync.set({ global: { v: 1, shortcuts: [], overrides: { 'default:hints': value } } }),
      override,
    );
  await setOverride({ keys: 'g h' });
  await expect(hintMode.locator('kbd')).toHaveText(['g', 'h', 'Esc']);
  await setOverride({ enabled: false });
  await expect(hintMode).toBeHidden();
  await expect(popup.getByRole('heading', { name: 'Shortcuts for this site' })).toBeVisible();
  await popup.close();
});
