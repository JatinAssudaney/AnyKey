import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { CONTENT_SCRIPT, startInOpenTabs } from './openTabs';

describe('startInOpenTabs', () => {
  let running: Set<number>;
  let tabIds: number[] = [];

  beforeEach(async () => {
    fakeBrowser.reset();
    running = new Set();
    // fakeBrowser starts with one tab: open two more.
    await browser.tabs.create({ url: 'https://example.com/1' });
    await browser.tabs.create({ url: 'https://example.com/2' });
    tabIds = (await browser.tabs.query({})).flatMap(({ id }) => (id === undefined ? [] : [id]));
    // fakeBrowser implements neither tabs.sendMessage nor scripting. Their mocks take the type of the callback form,
    // which returns nothing, while AnyKey uses the form that returns a promise.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    vi.spyOn(browser.tabs, 'sendMessage').mockImplementation((tabId: number) =>
      running.has(tabId) ? Promise.resolve({ ok: true }) : Promise.reject(new Error('Receiving end does not exist.')),
    );
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- the promise form, as above
    vi.spyOn(browser.scripting, 'executeScript').mockImplementation(() => Promise.resolve([]));
  });

  const started = () =>
    vi.mocked(browser.scripting.executeScript).mock.calls.map(([injection]) => injection.target.tabId);

  it.each(['install', 'update'] as const)('starts AnyKey in the tabs it is not running in on %s', async (reason) => {
    const [first, second, third] = tabIds;
    running.add(second ?? -1);
    await startInOpenTabs({ reason });
    expect(started()).toEqual([first, third]);
    expect(browser.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: first }, files: [CONTENT_SCRIPT] });
    // It asks only whether AnyKey runs, never for the page's address.
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(first, { type: 'ping' }, { frameId: 0 });
  });

  it('leaves the tabs the browser discarded, which start AnyKey when they load again', async () => {
    const query = vi.spyOn(browser.tabs, 'query');
    await startInOpenTabs({ reason: 'update' });
    expect(query).toHaveBeenCalledExactlyOnceWith({ discarded: false });
  });

  it.each(['chrome_update', 'shared_module_update'] as const)('starts nothing on %s', async (reason) => {
    await startInOpenTabs({ reason });
    expect(browser.tabs.sendMessage).not.toHaveBeenCalled();
    expect(browser.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('goes on to the other tabs when a page refuses it', async () => {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- the promise form, as above
    vi.mocked(browser.scripting.executeScript).mockImplementation(({ target }) =>
      target.tabId === tabIds[0] ? Promise.reject(new Error('Cannot access a chrome:// URL')) : Promise.resolve([]),
    );
    await expect(startInOpenTabs({ reason: 'install' })).resolves.toBeUndefined();
    expect(started()).toEqual(tabIds);
  });
});
