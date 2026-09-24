import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { APP_NAME } from '../core/app';
import { markTabsWithoutAnyKey, RECHECK_MS } from './badge';

describe('markTabsWithoutAnyKey', () => {
  let running: Set<number>;
  let tabIds: number[] = [];

  beforeEach(async () => {
    fakeBrowser.reset();
    running = new Set();
    // fakeBrowser starts with one tab: open two more.
    await browser.tabs.create({ url: 'https://example.com/1' });
    await browser.tabs.create({ url: 'https://example.com/2' });
    tabIds = (await browser.tabs.query({})).flatMap(({ id }) => (id === undefined ? [] : [id]));
    // fakeBrowser implements neither tabs.sendMessage nor the action API. Their mocks take the type of the callback
    // form, which returns nothing, while AnyKey uses the form that returns a promise.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    vi.spyOn(browser.tabs, 'sendMessage').mockImplementation((tabId: number) =>
      running.has(tabId) ? Promise.resolve({ ok: true }) : Promise.reject(new Error('Receiving end does not exist.')),
    );
    vi.spyOn(browser.action, 'setBadgeText').mockResolvedValue(undefined);
    vi.spyOn(browser.action, 'setBadgeBackgroundColor').mockResolvedValue(undefined);
    vi.spyOn(browser.action, 'setTitle').mockResolvedValue(undefined);
  });

  const badges = () =>
    vi.mocked(browser.action.setBadgeText).mock.calls.map(([details]) => [details.tabId, details.text]);

  it.each(['install', 'update'] as const)('marks the tabs AnyKey is not running in on %s', async (reason) => {
    const [first, second, third] = tabIds;
    running.add(second ?? -1);
    await markTabsWithoutAnyKey({ reason }, () => Promise.resolve());
    expect(badges()).toEqual([
      [first, '!'],
      [third, '!'],
    ]);
    expect(browser.action.setTitle).toHaveBeenCalledWith({
      tabId: first,
      title: 'AnyKey: reload this tab to use your shortcuts here',
    });
    // It asks only whether AnyKey runs, never for the page's address.
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(first, { type: 'ping' }, { frameId: 0 });
  });

  it.each(['chrome_update', 'shared_module_update'] as const)('marks nothing on %s', async (reason) => {
    await markTabsWithoutAnyKey({ reason }, () => Promise.resolve());
    expect(browser.tabs.sendMessage).not.toHaveBeenCalled();
    expect(browser.action.setBadgeText).not.toHaveBeenCalled();
  });

  it('clears the mark of a page that started AnyKey just after it was asked', async () => {
    const [first, second] = tabIds;
    const wait = vi.fn((ms: number) => {
      expect(ms).toBe(RECHECK_MS);
      running.add(first ?? -1);
      return Promise.resolve();
    });
    await markTabsWithoutAnyKey({ reason: 'update' }, wait);
    expect(wait).toHaveBeenCalledOnce();
    expect(badges()).toEqual([
      [first, '!'],
      [second, '!'],
      [tabIds[2], '!'],
      [first, ''],
    ]);
    expect(browser.action.setTitle).toHaveBeenLastCalledWith({ tabId: first, title: APP_NAME });
  });

  it('marks the other tabs when one closes on the way', async () => {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- the promise form, as above
    vi.mocked(browser.action.setBadgeText).mockImplementation(({ tabId }) =>
      tabId === tabIds[0] ? Promise.reject(new Error('No tab with id.')) : Promise.resolve(),
    );
    await expect(markTabsWithoutAnyKey({ reason: 'update' }, () => Promise.resolve())).resolves.toBeUndefined();
    expect(badges()).toEqual(tabIds.map((id) => [id, '!']));
  });
});
