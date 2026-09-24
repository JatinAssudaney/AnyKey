import { expect, pageKeys, pressUntil, scrollY, test, waitForPresets } from '../harness.ts';
import { openOnSite, press, recordPageKeys, toast } from './live.ts';

// Signed out, on a public repository with releases, Discussions, Actions runs and open issues. `g e` (the Settings
// tab, which only a repository's admins see) and what signed-in people get from S and x are checked by hand.
const REPO = 'https://github.com/wxt-dev/wxt';

test.beforeEach(async ({ extensionContext, extensionId }) => {
  await waitForPresets(extensionContext, extensionId);
});

test("the GitHub preset's shortcuts", async ({ page }) => {
  await openOnSite(page, REPO, 'GitHub');
  await page.keyboard.press('Shift+C');
  await expect(page.getByText('Which remote URL should I use?')).toBeVisible();
  await page.keyboard.press('Escape');

  // Starring needs an account, so GitHub asks a signed-out visitor to sign in.
  await page.keyboard.press('Shift+S');
  await page.waitForURL(/^https:\/\/github\.com\/login\?return_to=/);

  await openOnSite(page, REPO, 'GitHub');
  await press(page, 'g', 'r');
  await page.waitForURL(`${REPO}/releases`);
  expect(await toast(page)).toBeNull();
});

test("GitHub's own keys where AnyKey gives way", async ({ page }) => {
  await openOnSite(page, REPO, 'GitHub');
  await press(page, 'g', 'g');
  await page.waitForURL(`${REPO}/discussions`);

  // On the issue list GitHub's keys filter by author (u), move the focus (j) and select (x, where AnyKey's would
  // close the tab). The author filter goes away while an issue is selected, so u comes first.
  // GitHub sets up the list's keys a while after the page loads.
  await openOnSite(page, `${REPO}/issues`, 'GitHub');
  const authors = page.getByLabel('Filter authors');
  await pressUntil(page, ['u'], () => authors.evaluate((box) => box === document.activeElement).catch(() => false));
  // Closing the filter leaves the focus on its toolbar, which keeps j to itself.
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.keyboard.press('j');
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('LI');
  await page.keyboard.press('x');
  await expect(page.getByRole('listitem', { name: /^Selected\./ })).toBeVisible();
  expect(await scrollY(page)).toBe(0);

  await page.goto(`${REPO}/actions`);
  const run = await page.locator('a[href*="/actions/runs/"]').first().getAttribute('href');
  await openOnSite(page, new URL(run ?? '', REPO).href, 'GitHub');
  await press(page, 'g', 'f');
  await page.waitForURL(/\/actions\/runs\/\d+\/workflow$/);

  // The network graph takes j, k and the rest to scroll itself. AnyKey keeps d.
  await openOnSite(page, `${REPO}/network`, 'GitHub');
  await page.locator('canvas').first().waitFor();
  const top = await scrollY(page);
  await recordPageKeys(page);
  await press(page, 'j', 'k', 'Shift+H', 'Shift+L', 'Shift+J', 'Shift+K');
  expect((await pageKeys(page)).filter((key) => key !== 'keydown:Shift')).toEqual(
    ['j', 'k', 'H', 'L', 'J', 'K'].map((key) => `keydown:${key}`),
  );
  expect(await scrollY(page)).toBe(top);
  await page.keyboard.press('d');
  await expect.poll(() => scrollY(page)).toBeGreaterThan(top);
});

test('AnyKey keeps g g where GitHub has no use for it', async ({ page }) => {
  await openOnSite(page, 'https://github.com/', 'GitHub');
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
  await press(page, 'g', 'g');
  await expect.poll(() => scrollY(page)).toBe(0);
});
