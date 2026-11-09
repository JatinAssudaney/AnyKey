import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser, type Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { BackgroundResponse } from '../core/messages';
import { RATING_KEY } from '../core/rating';
import { listenForMessages } from './router';

function deliver(message: unknown, sender: Browser.runtime.MessageSender): Promise<BackgroundResponse> {
  return new Promise((resolve) => {
    void fakeBrowser.runtime.onMessage.trigger(message, sender, resolve);
  });
}

const stored = async (): Promise<unknown> => (await browser.storage.local.get(RATING_KEY))[RATING_KEY];

describe('rating messages', () => {
  const webPage = (): Browser.runtime.MessageSender => ({ id: browser.runtime.id, url: 'https://example.com/' });
  const popup = (): Browser.runtime.MessageSender => ({
    id: browser.runtime.id,
    url: browser.runtime.getURL('/popup.html'),
  });

  beforeEach(() => {
    fakeBrowser.reset();
    listenForMessages({ submit: vi.fn(() => Promise.resolve()) });
  });

  it('counts a use from a page', async () => {
    expect(await deliver({ type: 'used' }, webPage())).toEqual({ ok: true });
    expect(await stored()).toMatchObject({ uses: 1 });
  });

  it('takes the answer only from AnyKey\'s own pages', async () => {
    expect((await deliver({ type: 'ratingAnswer', rated: true }, webPage())).ok).toBe(false);
    expect(await stored()).toBeUndefined();
    expect(await deliver({ type: 'ratingAnswer', rated: true }, popup())).toEqual({ ok: true });
    expect(await stored()).toMatchObject({ done: true });
  });
});
