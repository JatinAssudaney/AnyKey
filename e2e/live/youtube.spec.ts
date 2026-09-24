import { expect, pageKeys, scrollY, test, waitForPresets } from '../harness.ts';
import { openOnSite, press, recordPageKeys, toast } from './live.ts';

// Signed out, on YouTube's first video. Liking, disliking, subscribing and commenting need an account, so a
// signed-out visitor gets YouTube's sign-in prompt for each, which shows the shortcut found its button. What
// signed-in people get is checked by hand.
const WATCH = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

test.beforeEach(async ({ extensionContext, extensionId }) => {
  await waitForPresets(extensionContext, extensionId);
});

test("the YouTube preset's shortcuts", async ({ page }) => {
  await openOnSite(page, WATCH, 'YouTube');
  for (const [keys, prompt] of [
    [['g', 'l'], 'Like this video?'],
    [['g', 'd'], "Don't like this video?"],
    [['g', 's'], 'Want to subscribe to this channel?'],
  ] as const) {
    await press(page, ...keys);
    await expect(page.getByText(prompt)).toBeVisible();
    expect(await toast(page)).toBeNull();
    await page.keyboard.press('Escape');
    await page.mouse.click(5, 300);
  }

  // The comment box loads once the comments come into view.
  await expect
    .poll(async () => {
      await page.mouse.wheel(0, 800);
      return page.locator('#simplebox-placeholder').count();
    })
    .toBeGreaterThan(0);
  await press(page, 'g', 'c');
  await expect(page.getByText('Want to join the conversation?')).toBeVisible();
  await page.keyboard.press('Escape');

  await press(page, 'g', 'u');
  await page.waitForURL('https://www.youtube.com/@jawed');
});

test("YouTube's own keys where AnyKey gives way", async ({ page }) => {
  await openOnSite(page, WATCH, 'YouTube');
  const paused = () => page.evaluate(() => document.querySelector('video')?.paused);
  const time = () => page.evaluate(() => document.querySelector('video')?.currentTime ?? Number.NaN);
  await recordPageKeys(page);

  const before = await paused();
  await page.keyboard.press('k');
  await expect.poll(paused).toBe(!before);

  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video !== null) video.currentTime = 15;
  });
  await page.keyboard.press('j');
  await expect.poll(time).toBeLessThan(10);
  expect(await pageKeys(page)).toEqual(['keydown:k', 'keydown:j']);
  expect(await scrollY(page)).toBe(0);

  // Away from videos, j is AnyKey's again.
  await openOnSite(page, 'https://www.youtube.com/', 'YouTube');
  await page.keyboard.press('j');
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
});
