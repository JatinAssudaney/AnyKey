import { browser, type Browser } from 'wxt/browser';
import { APP_NAME } from '../core/app';
import type { PageRequest } from '../core/messages';

// After an install or update the browser adds AnyKey's content script only to pages that load from then on: a tab
// already open has no AnyKey, or a dead copy that lets every key through. Starting AnyKey there would take more
// permissions (BACKLOG.md), so the background marks those tabs instead: a badge on the toolbar button, and a tooltip
// that says to reload. The browser keeps the mark with the tab and clears it when the tab loads a page, which is also
// what starts AnyKey there. None of this needs a permission, and the background never learns the tabs' addresses.

const BADGE = '!';
const BADGE_COLOR = '#44403c';
const TITLE = 'AnyKey: reload this tab to use your shortcuts here';

/** How long a page that was loading when it was asked gets to start AnyKey, before its mark is checked again. */
export const RECHECK_MS = 1000;

/** Marks each open tab that AnyKey isn't running in, after an install or update. */
export async function markTabsWithoutAnyKey(
  { reason }: Browser.runtime.InstalledDetails,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<void> {
  if (reason !== 'install' && reason !== 'update') return;
  const tabs = await browser.tabs.query({});
  const ids = tabs.flatMap(({ id }) => (id === undefined || id === browser.tabs.TAB_ID_NONE ? [] : [id]));
  const running = await Promise.all(ids.map(isRunning));
  const marked = ids.filter((_, i) => !running[i]);
  await Promise.all(marked.map(mark));
  // A page that was loading when it was asked can start AnyKey a moment later, after its load cleared no mark yet.
  await wait(RECHECK_MS);
  await Promise.all(
    marked.map(async (tabId) => {
      if (await isRunning(tabId)) await unmark(tabId);
    }),
  );
}

async function isRunning(tabId: number): Promise<boolean> {
  try {
    const answer = await browser.tabs.sendMessage<PageRequest, unknown>(tabId, { type: 'ping' }, { frameId: 0 });
    return typeof answer === 'object' && answer !== null && 'ok' in answer && answer.ok === true;
  } catch {
    return false; // No content script answered: a tab from before, or a page where extensions can't run.
  }
}

async function mark(tabId: number): Promise<void> {
  try {
    await Promise.all([
      browser.action.setBadgeText({ tabId, text: BADGE }),
      browser.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR }),
      browser.action.setTitle({ tabId, title: TITLE }),
    ]);
  } catch {
    // The tab closed.
  }
}

async function unmark(tabId: number): Promise<void> {
  try {
    await Promise.all([
      browser.action.setBadgeText({ tabId, text: '' }),
      // The manifest gives the button no title of its own, so the browser shows AnyKey's name.
      browser.action.setTitle({ tabId, title: APP_NAME }),
    ]);
  } catch {
    // The tab closed.
  }
}
