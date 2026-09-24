import type { Locator, Page } from '@playwright/test';
import {
  expect,
  FIXTURE_ORIGIN,
  launchExtensionContext,
  openCheatsheetText,
  pressUntil,
  scrollY,
  shownHints,
  tabIdOf,
  test,
  uiText,
  welcomePage,
} from './harness.ts';

/** The keys the welcome page teaches first: what each does, as the page says it. */
function tries(page: Page): Locator {
  return page.getByRole('region', { name: 'Try these now' });
}

/** AnyKey's popup for the tab showing `url`, opened as a page of its own. */
async function openPopup(popup: Page, extensionId: string, url: string): Promise<void> {
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${await tabIdOf(popup, url)}`);
}

test("installing AnyKey opens its welcome page, where AnyKey's keys work", async () => {
  const context = await launchExtensionContext();
  try {
    const welcome = await welcomePage(context);
    await expect(welcome.getByRole('heading', { name: 'Welcome to AnyKey', level: 1 })).toBeVisible();
    await expect(tries(welcome).getByRole('definition')).toHaveText([
      'Scroll down',
      'Scroll up',
      'See every shortcut, on any page',
      'Label every link and button, then type a label to click it',
      'Open a link in a new tab, the same way',
    ]);
    await expect(welcome.getByRole('region', { name: 'Made for your favorite sites' })).toContainText(
      'GitHub, Reddit and YouTube come with extra shortcuts',
    );

    await welcome.bringToFront();
    await pressUntil(welcome, ['j'], async () => (await scrollY(welcome)) > 0);
    await welcome.keyboard.press('?');
    await expect.poll(() => openCheatsheetText(welcome)).toContain('Keyboard shortcuts');
    await welcome.keyboard.press('Escape');
    await expect.poll(() => openCheatsheetText(welcome)).toBeNull();
    await welcome.keyboard.press('Shift+F');
    await expect.poll(async () => (await shownHints(welcome)).length).toBeGreaterThan(0);
    await welcome.keyboard.press('Escape');
    await expect.poll(async () => (await shownHints(welcome)).length).toBe(0);
  } finally {
    await context.close();
  }
});

test('the welcome page teaches the keys as the user has them', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/welcome.html`);
  await expect(tries(page).getByRole('term').first()).toHaveText('j');
  await page.evaluate(() =>
    chrome.storage.sync.set({
      global: {
        v: 1,
        shortcuts: [],
        overrides: { 'default:scroll-down': { keys: 'n' }, 'default:scroll-up': { enabled: false } },
      },
    }),
  );

  await expect(tries(page).getByRole('term').first()).toHaveText('n');
  await expect(tries(page).getByText('Scroll up', { exact: true })).toHaveCount(0);
  await pressUntil(page, ['n'], async () => (await scrollY(page)) > 0);
});

test('the popup opened on the welcome page says site shortcuts need a web page', async ({
  page,
  extensionContext,
  extensionId,
}) => {
  await page.goto(`chrome-extension://${extensionId}/welcome.html`);
  const popup = await extensionContext.newPage();
  await openPopup(popup, extensionId, page.url());
  await expect(popup.getByText('Shortcuts for one site work on web pages only.')).toBeVisible();
  await expect(popup.getByText("AnyKey isn't running in this tab.")).toBeHidden();
  await popup.close();
});

test('the picker started in a tab leaves the welcome page alone', async ({ page, extensionContext, extensionId }) => {
  const welcome = await extensionContext.newPage();
  await welcome.goto(`chrome-extension://${extensionId}/welcome.html`);
  await page.goto(`${FIXTURE_ORIGIN}/picker.html`);
  const popup = await extensionContext.newPage();
  await openPopup(popup, extensionId, page.url());
  const closed = popup.waitForEvent('close');
  await popup.getByRole('button', { name: 'Add shortcut for this site' }).click();
  await closed;
  await expect.poll(() => uiText(page, 'ak-banner')).toContain('Pick an element for a shortcut.');

  // Every extension page gets the popup's request to the background, the welcome page too, where a picker would
  // take j for itself.
  await welcome.bringToFront();
  await pressUntil(welcome, ['j'], async () => (await scrollY(welcome)) > 0);
  await page.bringToFront();
  await page.keyboard.press('Escape');
  await expect.poll(() => uiText(page, 'ak-banner')).toBeNull();
  await welcome.close();
});

test('Getting started, in the settings, opens the welcome page', async ({ page, extensionContext, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.getByRole('link', { name: 'Getting started' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to AnyKey', level: 1 })).toBeVisible();

  const opened = extensionContext.waitForEvent('page');
  await page.getByRole('button', { name: 'Open settings' }).click();
  const options = await opened;
  await options.waitForURL(`chrome-extension://${extensionId}/options.html`);
  await options.close();
});
