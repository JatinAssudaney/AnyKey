import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { browser, type Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { BackgroundResponse, Mutation, PickedShortcut } from '../core/messages';
import type { Writer } from '../storage/writer';
import { SESSION_MS } from './picker';
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

describe('the picker', () => {
  let submit: Mock<Writer['submit']>;
  let sendMessage: Mock<typeof browser.tabs.sendMessage>;
  let tab: Browser.tabs.Tab & { id: number };
  const popup = (): Browser.runtime.MessageSender => ({ id: browser.runtime.id, url: browser.runtime.getURL('/popup.html') });
  const page = (url = 'https://github.com/wxt-dev/wxt', frameId = 0): Browser.runtime.MessageSender => ({
    id: browser.runtime.id,
    url,
    tab,
    frameId,
  });
  const picked: PickedShortcut = {
    keys: 'g s',
    keyMode: 'key',
    action: { type: 'click', target: { selector: '[data-testid="star"]', text: 'Star', tag: 'button' } },
    label: 'Click Star',
  };
  const add = { type: 'addSiteShortcut', shortcut: picked };
  const session = async (tabId: number): Promise<unknown> => (await browser.storage.session.get(`picker:${tabId}`))[`picker:${tabId}`];

  beforeEach(async () => {
    fakeBrowser.reset();
    submit = vi.fn<Writer['submit']>(() => Promise.resolve());
    // fakeBrowser doesn't implement messaging a tab.
    sendMessage = vi.spyOn(browser.tabs, 'sendMessage').mockResolvedValue(undefined);
    listenForMessages({ submit });
    const created = await browser.tabs.create({ url: 'https://github.com/wxt-dev/wxt' });
    if (created.id === undefined) throw new Error('The fake tab has no id.');
    tab = { ...created, id: created.id };
  });

  it("starts from AnyKey's popup: a session for the site, then the tab's top frame is asked to pick", async () => {
    expect(await deliver({ type: 'startPicker', tabId: tab.id, host: 'github.com' }, popup())).toEqual({ ok: true });
    expect(sendMessage).toHaveBeenCalledWith(tab.id, { type: 'startPicker' }, { frameId: 0 });
    expect(await session(tab.id)).toEqual({ startedAt: expect.any(Number) as number, host: 'github.com' });
  });

  it('refuses to start for a content script', async () => {
    expect(await deliver({ type: 'startPicker', tabId: tab.id, host: 'github.com' }, page())).toEqual({
      ok: false,
      error: "Only AnyKey's own pages can start the picker.",
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ends the session when AnyKey isn't running in the tab", async () => {
    sendMessage.mockRejectedValue(new Error('Could not establish connection. Receiving end does not exist.'));
    expect(await deliver({ type: 'startPicker', tabId: tab.id, host: 'github.com' }, popup())).toEqual({
      ok: false,
      error: "AnyKey isn't running in this tab. Reload the tab, then try again.",
    });
    expect(await session(tab.id)).toBeUndefined();
  });

  it('saves one shortcut for the site of the page that sent it, then ends the session', async () => {
    await deliver({ type: 'startPicker', tabId: tab.id, host: 'github.com' }, popup());
    expect(await deliver(add, page())).toEqual({ ok: true });
    expect(submit).toHaveBeenCalledExactlyOnceWith({
      op: 'saveShortcut',
      shortcut: {
        ...picked,
        id: expect.stringMatching(/^user:[\da-f-]{36}$/) as string,
        scope: { type: 'site', match: '*://github.com/*' },
        source: 'user',
        enabled: true,
      },
      site: 'github.com',
    });
    expect(await session(tab.id)).toBeUndefined();
    expect(await deliver(add, page())).toEqual({
      ok: false,
      error: "To add a shortcut, start again from AnyKey's button in the toolbar.",
    });
  });

  it('refuses a shortcut unless this tab has a picker open for this site', async () => {
    const noSession = "To add a shortcut, start again from AnyKey's button in the toolbar.";
    expect(await deliver(add, page())).toEqual({ ok: false, error: noSession });

    await browser.storage.session.set({ [`picker:${tab.id}`]: { startedAt: Date.now(), host: 'gitlab.com' } });
    expect(await deliver(add, page())).toEqual({ ok: false, error: noSession });

    await browser.storage.session.set({ [`picker:${tab.id}`]: { startedAt: Date.now() - SESSION_MS - 1, host: 'github.com' } });
    expect(await deliver(add, page())).toEqual({ ok: false, error: noSession });

    await browser.storage.session.set({ [`picker:${tab.id + 1}`]: { startedAt: Date.now(), host: 'github.com' } });
    expect(await deliver(add, page())).toEqual({ ok: false, error: noSession });
    expect(submit).not.toHaveBeenCalled();
  });

  it('takes requests from web pages in the top frame only', async () => {
    await browser.storage.session.set({ [`picker:${tab.id}`]: { startedAt: Date.now(), host: 'github.com' } });
    const notAPage = { ok: false, error: 'AnyKey can add shortcuts only for web pages.' };
    expect(await deliver(add, page('https://github.com/wxt-dev/wxt', 3))).toEqual(notAPage);
    expect(await deliver(add, page('file:///Users/me/github.html'))).toEqual(notAPage);
    expect(await deliver(add, popup())).toEqual({ ok: false, error: 'Only pages can send this request.' });
    expect(submit).not.toHaveBeenCalled();
  });

  it('saves once when a page sends many shortcuts at the same time', async () => {
    await deliver({ type: 'startPicker', tabId: tab.id, host: 'github.com' }, popup());
    const answers = await Promise.all([deliver(add, page()), deliver(add, page()), deliver(add, page())]);
    expect(answers.filter((answer) => answer.ok)).toHaveLength(1);
    expect(submit).toHaveBeenCalledOnce();
  });

  it('keeps the session when saving fails, so the user can try again', async () => {
    await deliver({ type: 'startPicker', tabId: tab.id, host: 'github.com' }, popup());
    submit.mockRejectedValue(new Error('Your shortcuts for github.com are full.'));
    expect(await deliver(add, page())).toEqual({ ok: false, error: 'Your shortcuts for github.com are full.' });
    expect(await session(tab.id)).toEqual({ startedAt: expect.any(Number) as number, host: 'github.com' });
  });

  it('ends the session when the picker closes', async () => {
    await deliver({ type: 'startPicker', tabId: tab.id, host: 'github.com' }, popup());
    expect(await deliver({ type: 'pickerDone' }, page())).toEqual({ ok: true });
    expect(await session(tab.id)).toBeUndefined();
  });
});
