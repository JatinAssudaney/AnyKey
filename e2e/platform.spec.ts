import { expect, FIXTURE_ORIGIN, openCheatsheetText, pageKeys, pressUntil, scrollY, stored, test } from './harness.ts';

// `mod` is the command key of the system AnyKey runs on: Cmd on macOS, Ctrl elsewhere. The `windows` project runs
// this as Windows, so both ways are checked from one machine.
test('a shortcut recorded with Cmd or Ctrl takes the command key of the system it runs on', async ({
  page,
  extensionContext,
  extensionId,
  platform,
}) => {
  const mac = platform === 'host' && process.platform === 'darwin';
  const command = mac ? 'Meta' : 'Control';
  const other = mac ? 'Control' : 'Meta';

  const options = await extensionContext.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByRole('button', { name: 'Add shortcut', exact: true }).click();
  const dialog = options.getByRole('dialog', { name: 'Add a shortcut' });
  await dialog.getByLabel('Action').selectOption({ label: 'Scroll to the bottom' });
  await dialog.getByRole('button', { name: 'Record keys' }).focus();
  await options.keyboard.press('Enter');
  await options.keyboard.press(`${command}+k`);
  // Recorded as `mod`, so the shortcut also works on the user's computers with the other system.
  await expect(dialog.getByLabel('Keys', { exact: true })).toHaveValue('mod+k');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(() => stored(options))
    .toMatchObject({ global: { shortcuts: [expect.objectContaining({ keys: 'mod+k' })] } });
  await expect(options.getByRole('table', { name: 'Your shortcuts' }).locator('kbd')).toHaveText(
    mac ? ['⌘', 'K'] : ['Ctrl', 'K'],
  );
  await options.close();

  await page.goto(`${FIXTURE_ORIGIN}/long.html`);
  await pressUntil(page, [`${command}+k`], async () => (await scrollY(page)) > 500);
  // AnyKey kept the key from the page, and the other system's command key goes to the page.
  expect(await pageKeys(page)).not.toContain('keydown:k');
  await page.keyboard.press(`${other}+k`);
  await expect.poll(() => pageKeys(page)).toContain('keydown:k');

  // The cheatsheet names it as the system does, beside the built-in key for the same action.
  await page.keyboard.press('?');
  await expect
    .poll(() => openCheatsheetText(page))
    .toContain(mac ? '⌘ K or ⇧ G Scroll to the bottom' : 'Ctrl + K or Shift + G Scroll to the bottom');
});
