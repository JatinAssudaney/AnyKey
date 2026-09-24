import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { browser, type Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { BackgroundResponse, Mutation } from '../core/messages';
import type { Writer } from '../storage/writer';
import { listenForMessages } from './router';

const mutation: Mutation = { op: 'setSettings', settings: { scrollStep: 90 } };

/** Delivers a message the way Chrome does, and resolves with the answer. */
function deliver(message: unknown, sender: Browser.runtime.MessageSender): Promise<BackgroundResponse> {
  return new Promise((resolve) => {
    void fakeBrowser.runtime.onMessage.trigger(message, sender, resolve);
  });
}

describe('listenForMessages', () => {
  let submit: Mock<Writer['submit']>;
  const optionsPage = (): Browser.runtime.MessageSender => ({
    id: browser.runtime.id,
    url: browser.runtime.getURL('/options.html'),
  });

  beforeEach(() => {
    fakeBrowser.reset();
    submit = vi.fn<Writer['submit']>(() => Promise.resolve());
    listenForMessages({ submit });
  });

  it("saves changes sent by AnyKey's own pages", async () => {
    expect(await deliver({ type: 'mutate', mutation }, optionsPage())).toEqual({ ok: true });
    expect(submit).toHaveBeenCalledWith(mutation);
  });

  it('refuses changes from a content script, which a hostile page could drive', async () => {
    const tab = await browser.tabs.create({ url: 'https://example.com/' });
    const sender = { id: browser.runtime.id, url: 'https://example.com/', tab };
    expect(await deliver({ type: 'mutate', mutation }, sender)).toEqual({
      ok: false,
      error: "Only AnyKey's own pages can change settings.",
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it('answers invalid requests, and ignores other extensions', async () => {
    expect(await deliver({ type: 'mutate', mutation: { op: 'nope' } }, optionsPage())).toEqual({
      ok: false,
      error: 'AnyKey received an invalid request.',
    });
    const handled = await fakeBrowser.runtime.onMessage.trigger({ type: 'mutate', mutation }, { id: 'other' }, vi.fn());
    expect(handled).toEqual([false]);
    expect(submit).not.toHaveBeenCalled();
  });
});
