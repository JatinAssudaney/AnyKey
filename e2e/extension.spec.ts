import { expect, FIXTURE_ORIGIN, test } from './harness.ts';

test('manifest keeps the permission footprint minimal', async ({ serviceWorker }) => {
  const manifest = await serviceWorker.evaluate(() => chrome.runtime.getManifest());
  expect(manifest.name).toBe('AnyKey');
  expect(manifest.permissions).toEqual(['storage', 'scripting']);
  // A key for the popup. Commands are not permissions, so no install warning comes with it.
  expect(manifest.commands).toEqual({ _execute_action: { suggested_key: { default: 'Alt+Shift+K' } } });
  // Host access to every site, as the content script has, so AnyKey can start in tabs open at an install or update.
  expect(manifest.host_permissions).toEqual(['<all_urls>']);
  expect(manifest.content_scripts).toEqual([
    expect.objectContaining({ matches: ['<all_urls>'], run_at: 'document_start' }),
  ]);
});

test('popup renders', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole('heading', { name: 'AnyKey', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open settings' })).toBeVisible();
});

test('options page renders and its skip link is the first tab stop', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { level: 1, name: 'AnyKey settings' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
});

test('a normal page loads without errors', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.goto(`${FIXTURE_ORIGIN}/basic.html`);
  await expect(page).toHaveTitle('Basic fixture');
  expect(errors).toEqual([]);
});
