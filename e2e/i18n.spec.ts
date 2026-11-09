import { readFileSync } from 'node:fs';
import { expect, FIXTURE_ORIGIN, openCheatsheetText, pressUntil, test } from './harness.ts';

// The browser's language picks AnyKey's. Unit tests and the other specs run in English; this one checks that another
// language reaches every kind of place AnyKey shows text, with the words taken from the file so wording can change.
const de = JSON.parse(readFileSync('src/locales/de.json', 'utf8')) as {
  manifest: { name: string };
  options: { title: string };
  popup: { reload: string };
  action: { scrollBottom: string };
  page: { cheatsheet: { title: string } };
  keys: { shift: string };
};

test.use({ lang: 'de' });
// Chromium on macOS takes its language from the system and ignores --lang, so CI (Linux) runs this.
test.skip(process.platform === 'darwin', 'macOS ignores --lang');

test('AnyKey follows the language of the browser', async ({ page, extensionContext, extensionId, platform }) => {
  const options = await extensionContext.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.getByRole('heading', { name: de.options.title })).toBeVisible();
  await expect(options).toHaveTitle(de.options.title);
  expect(await options.evaluate(() => document.documentElement.lang)).toBe('de');
  expect(await options.evaluate(() => chrome.runtime.getManifest().name)).toBe(de.manifest.name);

  // Built-in shortcuts are named in the language too, though their labels are never stored.
  await expect(options.getByRole('rowheader', { name: de.action.scrollBottom })).toBeVisible();

  await options.goto(`chrome-extension://${extensionId}/popup.html?tab=999999`);
  await expect(options.getByRole('button', { name: de.popup.reload })).toBeVisible();
  await options.close();

  // In the page, as the content script has it, with the key names of the language.
  await page.goto(`${FIXTURE_ORIGIN}/long.html`);
  await pressUntil(page, ['?'], async () => (await openCheatsheetText(page)) !== null);
  const text = await openCheatsheetText(page);
  expect(text).toContain(de.page.cheatsheet.title);
  const mac = platform === 'host' && process.platform === 'darwin';
  expect(text).toContain(mac ? `⇧ G ${de.action.scrollBottom}` : `${de.keys.shift} + G ${de.action.scrollBottom}`);
});
