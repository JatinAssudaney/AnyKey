import { expect, FIXTURE_ORIGIN, pageKeys, scrollY, test } from './harness.ts';

const LONG = `${FIXTURE_ORIGIN}/long.html`;

test.describe('scrolling', () => {
  test('j, k, d, u, G and g g scroll the page', async ({ page }) => {
    await page.goto(LONG);
    const half = await page.evaluate(() => Math.round(window.innerHeight / 2));
    const bottom = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

    await page.keyboard.press('j');
    await expect.poll(() => scrollY(page)).toBe(60);
    await page.keyboard.press('k');
    await expect.poll(() => scrollY(page)).toBe(0);
    await page.keyboard.press('d');
    await expect.poll(() => scrollY(page)).toBe(half);
    await page.keyboard.press('u');
    await expect.poll(() => scrollY(page)).toBe(0);
    await page.keyboard.press('Shift+G');
    await expect.poll(() => scrollY(page)).toBe(bottom);
    await page.keyboard.press('g');
    await page.keyboard.press('g');
    await expect.poll(() => scrollY(page)).toBe(0);
  });

  test('g g still works when the page rewrites the # part between the keys', async ({ page }) => {
    await page.goto(LONG);
    await page.keyboard.press('Shift+G');
    await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
    await page.keyboard.press('g');
    // Some sites keep the # part in step with the section in view.
    await page.evaluate(() => {
      history.replaceState(null, '', '#part-2');
    });
    await page.keyboard.press('g');
    await expect.poll(() => scrollY(page)).toBe(0);
  });

  test('a held key keeps scrolling', async ({ page }) => {
    await page.goto(LONG);
    await page.keyboard.down('j');
    // Playwright marks further downs of a held key as repeats.
    await page.keyboard.down('j');
    await page.keyboard.down('j');
    await page.keyboard.up('j');
    await expect.poll(() => scrollY(page)).toBeGreaterThan(60);
    expect(await pageKeys(page)).toEqual([]);
  });

  test('j scrolls the main pane of an app whose page does not scroll', async ({ page }) => {
    await page.goto(`${FIXTURE_ORIGIN}/scroller.html`);
    await page.keyboard.press('j');
    await expect.poll(() => page.evaluate(() => document.getElementById('pane')?.scrollTop)).toBe(60);
    expect(await scrollY(page)).toBe(0);
  });
});

test.describe('what reaches the page', () => {
  test('keys AnyKey handles are hidden from the page, keyups included', async ({ page }) => {
    await page.goto(LONG);
    await page.keyboard.press('j');
    await page.keyboard.press('Shift+G');
    await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
    // Shift itself is not a shortcut, so the page still sees it.
    expect(await pageKeys(page)).toEqual(['keydown:Shift', 'keyup:Shift']);
  });

  test("keys AnyKey doesn't use reach the page, including a lone prefix", async ({ page }) => {
    await page.goto(LONG);
    // "g" starts AnyKey's "g g" and "g f", but a site's own "g i" must keep working.
    await page.keyboard.press('g');
    await page.keyboard.press('i');
    await page.keyboard.press('z');
    // Plain f stays with the site: it is fullscreen on YouTube and other video players.
    await page.keyboard.press('f');
    expect(await pageKeys(page)).toEqual([
      'keydown:g',
      'keyup:g',
      'keydown:i',
      'keyup:i',
      'keydown:z',
      'keyup:z',
      'keydown:f',
      'keyup:f',
    ]);
    expect(await scrollY(page)).toBe(0);
  });

  test('typing in text fields is left alone', async ({ page }) => {
    await page.goto(LONG);
    for (const selector of ['#text', '#notes']) {
      await page.locator(selector).focus();
      await page.keyboard.type('jkdxG?');
      await expect(page.locator(selector)).toHaveValue('jkdxG?');
    }
    await page.locator('#editor').fill('');
    await page.keyboard.type('jk');
    await expect(page.locator('#editor')).toHaveText('jk');

    await page.evaluate(() => {
      window.focusClosedInput?.();
    });
    await page.keyboard.type('jk');
    expect(await page.evaluate(() => window.closedInputValue?.())).toBe('jk');
    expect(await scrollY(page)).toBe(0);
  });

  test('shortcuts still work while a checkbox has focus', async ({ page }) => {
    await page.goto(LONG);
    await page.locator('#check').focus();
    await page.keyboard.press('j');
    await expect.poll(() => scrollY(page)).toBe(60);
  });
});

test('H and L go back and forward', async ({ page }) => {
  await page.goto(`${FIXTURE_ORIGIN}/basic.html`);
  await page.goto(LONG);
  await page.keyboard.press('Shift+H');
  await expect(page).toHaveURL(/basic\.html$/);
  await page.waitForLoadState();
  await page.keyboard.press('Shift+L');
  await expect(page).toHaveURL(/long\.html$/);
});
