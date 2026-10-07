import type { Page } from '@playwright/test';
import { expect, openCheatsheetText, uiText } from '../harness.ts';

// Reddit shows automated browsers a reCAPTCHA page instead of its own, Stack Overflow shows headless ones a Cloudflare
// check, and Gmail needs an account, so their presets are checked by hand (docs/preset-checklist.md).

/**
 * Opens a page of a preset's site once AnyKey runs there with the preset: its cheatsheet lists the site's own keys,
 * or, for a site with none (Hacker News), `ready`, the label of one of the preset's shortcuts on the page.
 * A live page goes on loading after its load event (GitHub fetches its sidebar, then sets up its own keys), so this
 * also waits for the network to go quiet, for a while at most, before pressing `?` until the cheatsheet opens.
 */
export async function openOnSite(page: Page, url: string, site: string, ready = `${site}'s own keys`): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  await expect
    .poll(
      async () => {
        if ((await openCheatsheetText(page)) === null) await page.keyboard.press('?');
        return openCheatsheetText(page);
      },
      { timeout: 30_000 },
    )
    .toContain(ready);
  await page.keyboard.press('Escape');
  await expect.poll(() => openCheatsheetText(page)).toBeNull();
}

/** Presses each key in turn, as Playwright names them: a sequence such as `g r` is `press(page, 'g', 'r')`. */
export async function press(page: Page, ...keys: string[]): Promise<void> {
  for (const key of keys) await page.keyboard.press(key);
}

/** AnyKey's toast, which says when a shortcut found nothing to click, or null when none shows. */
export function toast(page: Page): Promise<string | null> {
  return uiText(page, 'ak-toast');
}

/** Records, from here on, the keys that reach the page's own listeners, as the fixture pages do: "keydown:j". */
export async function recordPageKeys(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.pageKeys = [];
    document.addEventListener('keydown', (event) => window.pageKeys?.push(`keydown:${event.key}`));
  });
}
