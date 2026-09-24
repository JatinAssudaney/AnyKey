import { expect, FIXTURE_ORIGIN, pageKeys, pressUntil, stored, tabIdOf, test } from './harness.ts';

const PICKER = `${FIXTURE_ORIGIN}/picker.html`;

test("the popup says when AnyKey isn't running in a tab", async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html?tab=999999`);
  await expect(page.getByText("AnyKey isn't running in this tab.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload this tab' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open settings' })).toBeVisible();
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
