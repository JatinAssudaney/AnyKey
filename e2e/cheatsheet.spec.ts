import { expect, FIXTURE_ORIGIN, openCheatsheetText, pageKeys, scrollY, test } from './harness.ts';

test('? opens the cheatsheet, which keeps keys from the page until Esc closes it', async ({ page }) => {
  await page.goto(`${FIXTURE_ORIGIN}/long.html`);
  await page.locator('#check').focus();

  await page.keyboard.press('?');
  await expect.poll(() => openCheatsheetText(page)).toContain('Keyboard shortcuts');
  const text = await openCheatsheetText(page);
  for (const label of ['Scroll down', 'Scroll to the top', 'Go back', 'Next tab', 'Close tab']) {
    expect(text).toContain(label);
  }

  // Inside the cheatsheet, j scrolls the list, not the page.
  await page.keyboard.press('j');
  await page.keyboard.press('Escape');
  await expect.poll(() => openCheatsheetText(page)).toBeNull();
  expect(await scrollY(page)).toBe(0);
  expect(await pageKeys(page)).toEqual([]);

  // Focus returns to where it was, and shortcuts work again.
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('check');
  await page.keyboard.press('j');
  await expect.poll(() => scrollY(page)).toBe(60);
});

test('? toggles the cheatsheet closed', async ({ page }) => {
  await page.goto(`${FIXTURE_ORIGIN}/basic.html`);
  await page.keyboard.press('?');
  await expect.poll(() => openCheatsheetText(page)).not.toBeNull();
  await page.keyboard.press('?');
  await expect.poll(() => openCheatsheetText(page)).toBeNull();
});
