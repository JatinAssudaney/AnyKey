import { expect, pressUntil, test, waitForPresets } from '../harness.ts';
import { openOnSite, press, toast } from './live.ts';

// Hacker News has no keys of its own, so the cheatsheet shows the preset's shortcuts but no "own keys" group.
const HN = 'https://news.ycombinator.com/';

test.beforeEach(async ({ extensionContext, extensionId }) => {
  await waitForPresets(extensionContext, extensionId);
});

test("the Hacker News preset's shortcuts", async ({ page }) => {
  await openOnSite(page, HN, 'Hacker News', 'Go to the newest stories');

  await page.keyboard.press('/');
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('name'))).toBe('q');
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  await press(page, 'n');
  await page.waitForURL(`${HN}?p=2`);
  expect(await toast(page)).toBeNull();

  // Each page is a fresh load, so press until AnyKey runs on it.
  for (const [keys, path] of [
    [['g', 'n'], 'newest'],
    [['g', 'p'], 'front'],
    [['g', 'c'], 'newcomments'],
    [['g', 'a'], 'ask'],
    [['g', 's'], 'show'],
    [['g', 'j'], 'jobs'],
    [['g', 'h'], ''],
  ] as const) {
    await pressUntil(page, keys, () => Promise.resolve(page.url() === `${HN}${path}`));
  }
});
