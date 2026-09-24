import type { Page } from '@playwright/test';
import { expect, FIXTURE_ORIGIN, pageKeys, scrollY, shownHints, stored, test, uiBox, uiText } from './harness.ts';

const HINTS = `${FIXTURE_ORIGIN}/hints.html`;

/** All the page sees of Shift+F: the Shift on the way to F goes down and comes up, as it does for any shortcut. */
const SHIFT = ['keydown:Shift', 'keyup:Shift'];

/** What the hints are on: each hint's label by the id of the element under it, in the order they were made. */
async function hintsById(page: Page): Promise<Map<string, string>> {
  const hints = await shownHints(page);
  const ids = await page.evaluate(
    (points) => points.map(([x, y]) => document.elementFromPoint(x + 2, y + 2)?.closest('[id]')?.id ?? '?'),
    hints.map(({ x, y }): [number, number] => [x, y]),
  );
  const byId = new Map(hints.map(({ label }, i): [string, string] => [ids[i] ?? '?', label]));
  // Two hints on one element would collapse into one entry here.
  expect(byId.size).toBe(hints.length);
  return byId;
}

/** Presses the keys that show hints and waits for them. */
async function showHints(page: Page, keys: readonly string[] = ['Shift+F']): Promise<Map<string, string>> {
  for (const key of keys) await page.keyboard.press(key);
  await expect.poll(async () => (await shownHints(page)).length).toBeGreaterThan(0);
  return hintsById(page);
}

async function labels(page: Page): Promise<string[]> {
  return (await shownHints(page)).map(({ label }) => label);
}

function clickLog(page: Page): Promise<string[]> {
  return page.evaluate(() => window.clickLog ?? []);
}

test('F puts a hint on everything in view that can be clicked, and typing one clicks it', async ({ page }) => {
  await page.goto(HINTS);
  const hints = await showHints(page);
  // Not on the disabled, hidden, covered or out-of-view elements, nor on a wrapper around a button or a focusable
  // region around a link, and the menu item's hint goes on the link that fills it.
  expect([...hints.keys()]).toEqual([
    'docs',
    'like',
    'search',
    'agree',
    'switch',
    'card',
    'wrapped',
    'styled-link',
    'item-link',
    'player',
    'region-link',
    'region-card',
    'focusable',
  ]);
  expect([...hints.values()]).toEqual(Array.from('sadfjklewcmpg'));

  await page.keyboard.type(hints.get('like') ?? '');
  await expect.poll(() => clickLog(page)).toEqual(['like']);
  expect(await shownHints(page)).toEqual([]);
  expect(await pageKeys(page)).toEqual(SHIFT);

  // Inside a closed shadow root too.
  await page.keyboard.type((await showHints(page)).get('player') ?? '');
  await expect.poll(() => clickLog(page)).toEqual(['like', 'player']);
});

test('Esc closes the hints, and other keys do nothing while they show', async ({ page }) => {
  await page.goto(HINTS);
  await showHints(page);
  expect(await uiText(page, 'ak-link-hints-bar')).toBe(
    'Hint mode: type a label to click it, or press Esc to go back to your shortcuts.',
  );
  // x would close the tab, z is no hint character, and the arrow would scroll.
  for (const key of ['x', 'z', 'ArrowDown']) await page.keyboard.press(key);
  expect(await shownHints(page)).toHaveLength(13);
  await page.keyboard.press('Escape');
  await expect.poll(() => shownHints(page)).toEqual([]);
  expect(await uiText(page, 'ak-link-hints-bar')).toBeNull();
  expect(await pageKeys(page)).toEqual(SHIFT);
  expect(await scrollY(page)).toBe(0);
  expect(await clickLog(page)).toEqual([]);

  await page.keyboard.press('j');
  await expect.poll(() => scrollY(page)).toBe(60);
});

test('typing narrows the hints, Backspace widens them again, and case does not matter', async ({ page }) => {
  await page.goto(`${HINTS}?many=30`);
  const hints = await showHints(page);
  const all = [...hints.values()];
  const startingWith = (start: string): string[] => all.filter((label) => label.startsWith(start));
  // 43 hints from 14 characters: the three least comfortable characters start two-letter labels.
  expect(all).toHaveLength(43);
  expect(all.filter((label) => label.length === 1)).toEqual(Array.from('sadfjklewcm'));
  expect(startingWith('p')).toEqual(['ps', 'pa', 'pd', 'pf']);
  expect(startingWith('g')).toHaveLength(14);
  expect(startingWith('h')).toHaveLength(14);

  await page.keyboard.press('h');
  expect(await labels(page)).toEqual(startingWith('h'));
  await page.keyboard.press('Backspace');
  expect(await labels(page)).toEqual(all);

  await page.keyboard.press('Shift+P');
  expect(await labels(page)).toEqual(startingWith('p'));
  // No label is "ph", so h changes nothing now.
  await page.keyboard.press('h');
  expect(await labels(page)).toEqual(startingWith('p'));
  await page.keyboard.press('f');
  await expect.poll(() => clickLog(page)).toEqual(['more-2']);
  expect(hints.get('more-2')).toBe('pf');
});

test('a hint on a text field focuses it, and a hint on a link follows it', async ({ page }) => {
  await page.goto(HINTS);
  await page.keyboard.type((await showHints(page)).get('search') ?? '');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('search');
  await page.keyboard.type('jk');
  await expect(page.locator('#search')).toHaveValue('jk');

  await page.locator('#search').blur();
  await page.keyboard.type((await showHints(page)).get('docs') ?? '');
  await page.waitForURL(`${FIXTURE_ORIGIN}/basic.html`);
});

test('g f opens a link in a new tab, and clicks anything else with Ctrl or Cmd', async ({ page, extensionContext }) => {
  await page.goto(HINTS);
  const opened = extensionContext.waitForEvent('page');
  const hints = await showHints(page, ['g', 'f']);
  expect(await uiText(page, 'ak-link-hints-bar')).toBe(
    'Hint mode: type a label to open it in a new tab, or press Esc to go back to your shortcuts.',
  );
  await page.keyboard.type(hints.get('docs') ?? '');
  const tab = await opened;
  await tab.waitForURL(`${FIXTURE_ORIGIN}/basic.html`);
  expect(page.url()).toBe(HINTS);
  await tab.close();

  await page.keyboard.type((await showHints(page, ['g', 'f'])).get('like') ?? '');
  await expect.poll(() => clickLog(page)).toEqual(['mod+like']);
});

test('holding F shows the hints once, without typing a label', async ({ page }) => {
  await page.goto(HINTS);
  await page.keyboard.down('Shift');
  await page.keyboard.down('F');
  await expect.poll(async () => (await shownHints(page)).length).toBe(13);
  // Playwright marks further downs of a held key as repeats. "f" is a label here, so a repeat must not pick it.
  await page.keyboard.down('F');
  await page.keyboard.down('F');
  await page.keyboard.up('F');
  await page.keyboard.up('Shift');
  expect(await shownHints(page)).toHaveLength(13);
  expect(await clickLog(page)).toEqual([]);
});

test('the hint mode bar sits at the bottom, or at the top while labels would sit on it at the bottom', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 560 });
  await page.goto(`${HINTS}?many=30`);
  await showHints(page);
  const bar = await uiBox(page, 'ak-link-hints-bar');
  expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeCloseTo(560 - 16);
  await page.keyboard.press('Escape');

  // The last row of buttons and their labels now sit where the bar would go.
  await page.setViewportSize({ width: 900, height: 395 });
  await showHints(page);
  expect((await uiBox(page, 'ak-link-hints-bar'))?.y).toBe(16);
});

test('a click closes the hints and reaches the page', async ({ page }) => {
  await page.goto(HINTS);
  await showHints(page);
  await page.locator('#like').click();
  await expect.poll(() => shownHints(page)).toEqual([]);
  expect(await clickLog(page)).toEqual(['like']);
});

test('hints move with the page as it scrolls', async ({ page }) => {
  await page.goto(HINTS);
  const label = (await showHints(page)).get('docs');
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 30);
  await expect
    .poll(async () => {
      const hint = (await shownHints(page)).find((shown) => shown.label === label);
      const top = await page.evaluate(() => document.getElementById('docs')?.getBoundingClientRect().top ?? Number.NaN);
      return (await scrollY(page)) === 30 && hint !== undefined && Math.abs(hint.y - top) <= 1;
    })
    .toBe(true);
  expect(await shownHints(page)).toHaveLength(13);
});

test('the hint characters come from the settings', async ({ page, extensionContext, extensionId }) => {
  const options = await extensionContext.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const field = options.getByLabel('Hint characters');
  await field.fill('asa');
  await field.press('Enter');
  await expect(options.getByRole('alert').filter({ hasText: 'Use each character once.' })).toBeVisible();
  await field.fill('QWER');
  await field.press('Tab');
  await expect.poll(() => stored(options)).toEqual({ settings: { v: 1, hintChars: 'qwer' } });
  await options.close();

  await page.goto(HINTS);
  expect([...(await showHints(page)).values()]).toEqual([
    ...['q', 'wq', 'ww', 'we', 'wr'],
    ...['eq', 'ew', 'ee', 'er', 'rq', 'rw', 're', 'rr'],
  ]);
});

test('a page with nothing to click says so', async ({ page }) => {
  await page.goto(`${FIXTURE_ORIGIN}/basic.html`);
  await page.keyboard.press('Shift+F');
  await expect.poll(() => uiText(page, 'ak-toast')).toBe('No links or buttons in view.');
});
