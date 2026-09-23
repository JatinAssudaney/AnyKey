import { browser, type Browser } from 'wxt/browser';
import type { TabOp } from '../core/schema';

// None of these calls needs the "tabs" permission: AnyKey never reads tab URLs or titles.

export async function runTabOp(op: TabOp, tab: Browser.tabs.Tab): Promise<void> {
  const tabId = requireId(tab);
  switch (op) {
    case 'next':
    case 'prev': {
      const tabs = await browser.tabs.query({ windowId: tab.windowId });
      tabs.sort((a, b) => a.index - b.index);
      const current = tabs.findIndex((t) => t.id === tabId);
      const offset = op === 'next' ? 1 : -1;
      const target = tabs[(current + offset + tabs.length) % tabs.length];
      if (target?.id !== undefined && target.id !== tabId) await browser.tabs.update(target.id, { active: true });
      return;
    }
    case 'close':
      await browser.tabs.remove(tabId);
      return;
    case 'duplicate':
      await browser.tabs.duplicate(tabId);
      return;
  }
}

/** Opens `url` in a new tab right after `opener`, in front of it or behind it. */
export async function openTab(url: string, background: boolean, opener: Browser.tabs.Tab): Promise<void> {
  await browser.tabs.create({
    url,
    active: !background,
    windowId: opener.windowId,
    index: opener.index + 1,
    openerTabId: requireId(opener),
  });
}

function requireId(tab: Browser.tabs.Tab): number {
  if (tab.id === undefined) throw new Error('This tab cannot be controlled.');
  return tab.id;
}
