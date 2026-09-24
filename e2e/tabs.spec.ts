import { expect, extensionWorker, FIXTURE_ORIGIN, launchExtensionContext, pageKeys, scrollY, test, welcomePage } from './harness.ts';

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
  // x acts on keydown, and the tab can be gone before a keyup could be sent.
  await second.keyboard.down('x');
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

test('tabs AnyKey is not running in are marked on install, until they load a page', async () => {
  const context = await launchExtensionContext();
  try {
    // The browser's first tab was open before AnyKey was installed, and the install opened the welcome page.
    const [first] = context.pages();
    const welcome = await welcomePage(context);
    if (first === undefined || first === welcome) throw new Error('The browser opened no tab of its own');
    await first.bringToFront();
    const firstId = await welcome.evaluate(
      async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id,
    );
    const welcomeId = await welcome.evaluate(async () => (await chrome.tabs.getCurrent())?.id);
    const badge = (tabId: number | undefined) =>
      welcome.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId);

    await expect.poll(() => badge(firstId)).toBe('!');
    expect(await welcome.evaluate((id) => chrome.action.getTitle({ tabId: id }), firstId)).toBe(
      'AnyKey: reload this tab to use your shortcuts here',
    );
    // AnyKey runs in the welcome page, which may have been loading when it was asked: its mark, if any, goes.
    await expect.poll(() => badge(welcomeId)).toBe('');

    await first.goto(`${FIXTURE_ORIGIN}/long.html`);
    expect(await badge(firstId)).toBe('');
    await expect
      .poll(async () => {
        await first.keyboard.press('j');
        return scrollY(first);
      })
      .toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});
