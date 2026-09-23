import { expect, extensionWorker, FIXTURE_ORIGIN, launchExtensionContext, pageKeys, scrollY, test } from './harness.ts';

test('J and K switch tabs, and x closes the tab', async ({ extensionContext }) => {
  const first = await extensionContext.newPage();
  await first.goto(`${FIXTURE_ORIGIN}/basic.html`);
  const second = await extensionContext.newPage();
  await second.goto(`${FIXTURE_ORIGIN}/long.html`);
  // Without the "tabs" permission AnyKey can't read tab URLs, so check which page the browser shows instead.
  const visible = (page: typeof first) => page.evaluate(() => document.visibilityState);

  await first.bringToFront();
  await first.keyboard.press('Shift+K');
  await expect.poll(() => visible(second)).toBe('visible');
  await second.keyboard.press('Shift+J');
  await expect.poll(() => visible(first)).toBe('visible');

  const closed = second.waitForEvent('close');
  await second.keyboard.press('x');
  await closed;
  await first.close();
});

test('a tab left behind by an extension reload lets every key through', async () => {
  const context = await launchExtensionContext();
  try {
    const worker = await extensionWorker(context);
    const page = await context.newPage();
    await page.goto(`${FIXTURE_ORIGIN}/long.html`);
    await page.keyboard.press('j');
    await expect.poll(() => scrollY(page)).toBe(60);

    // Chrome doesn't inject the reloaded extension into open tabs, so the old script stays with dead APIs.
    // (The new service worker only starts when an event needs it, so wait for the old one to stop instead.)
    const stopped = worker.waitForEvent('close');
    await worker.evaluate(() => {
      chrome.runtime.reload();
    });
    await stopped;

    // The unload reaches the page's renderer on its own schedule: press j until the page receives it.
    await expect
      .poll(async () => {
        await page.keyboard.press('j');
        return pageKeys(page);
      })
      .toContain('keydown:j');
    // x would close the tab if the stale script still acted on keys.
    await page.keyboard.press('x');
    expect((await pageKeys(page)).slice(-2)).toEqual(['keydown:x', 'keyup:x']);
    expect(page.isClosed()).toBe(false);
  } finally {
    await context.close();
  }
});
