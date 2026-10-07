import { expect, pressUntil, test, waitForPresets } from '../harness.ts';
import { openOnSite, press, toast } from './live.ts';

// Wikipedia's own keys are access keys, which the browser handles with modifiers that differ by system, so the preset
// lists none and the cheatsheet shows its shortcuts but no "own keys" group. Signed out, on English and German
// Wikipedia, since the preset covers every language.
const ARTICLE = 'https://en.wikipedia.org/wiki/Keyboard_shortcut';

test.beforeEach(async ({ extensionContext, extensionId }) => {
  await waitForPresets(extensionContext, extensionId);
});

test("the Wikipedia preset's shortcuts", async ({ page }) => {
  await openOnSite(page, ARTICLE, 'Wikipedia', 'Go to a random article');

  await page.keyboard.press('/');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('searchInput');
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  // The language selector opens in place of the dropdown, with its search box focused.
  await press(page, 'g', 'l');
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('placeholder')))
    .toBe('Search languages');
  expect(await toast(page)).toBeNull();
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 400);

  // Each page is a fresh load, so press until AnyKey runs on it.
  for (const [keys, url] of [
    [['g', 't'], /\/wiki\/Talk:Keyboard_shortcut$/],
    [['g', 'c'], /\/wiki\/Keyboard_shortcut$/],
    [['g', 'h'], /[?&]action=history/],
    [['g', 'c'], /\/wiki\/Keyboard_shortcut$/],
    [['g', 'w'], /\/wiki\/Special:WhatLinksHere\/Keyboard_shortcut$/],
    [['g', 'm'], /\/wiki\/Main_Page$/],
  ] as const) {
    await pressUntil(page, keys, () => Promise.resolve(url.test(decodeURIComponent(page.url()))));
  }
  // A random article: MediaWiki marks articles with the ns-0 class (main namespace). Titles can hold colons.
  await pressUntil(page, ['g', 'r'], () => Promise.resolve(!page.url().endsWith('/wiki/Main_Page')));
  await page.waitForLoadState();
  expect(await page.evaluate(() => document.body.classList.contains('ns-0'))).toBe(true);

  await openOnSite(page, ARTICLE, 'Wikipedia', 'Go to a random article');
  await press(page, 'g', 'e');
  await page.waitForURL(/[?&]action=edit/);

  await openOnSite(page, 'https://de.wikipedia.org/wiki/Tastenkombination', 'Wikipedia', 'Go to a random article');
  await press(page, 'g', 't');
  await page.waitForURL(/de\.wikipedia\.org\/wiki\/Diskussion:Tastenkombination$/);
});
