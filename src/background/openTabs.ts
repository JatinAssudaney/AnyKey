import { browser, type Browser } from 'wxt/browser';
import type { PageRequest } from '../core/messages';

// After an install or update the browser adds AnyKey's content script only to pages that load from then on: a tab
// already open has no AnyKey, or a dead copy that lets every key through. So the background starts AnyKey in each
// open tab itself, into the page as it stands, never by reloading it, which would lose what the user typed there.
// That takes the `scripting` permission and host access to every site, which the content script has already, so the
// install warning stays the same. The background never reads the tabs' addresses: it asks each tab whether AnyKey
// runs there, and tries the ones that don't answer.

/** The content script, as WXT builds `src/entrypoints/content.ts`. */
export const CONTENT_SCRIPT = '/content-scripts/content.js';

/** Starts AnyKey in each open tab it isn't running in, after an install or update. */
export async function startInOpenTabs({ reason }: Browser.runtime.InstalledDetails): Promise<void> {
  if (reason !== 'install' && reason !== 'update') return;
  // A tab the browser discarded to save memory loads its page again when it is opened, and AnyKey starts with it.
  const tabs = await browser.tabs.query({ discarded: false });
  // All at once, so a frozen background tab, which may answer only once it is shown, holds up no other.
  await Promise.all(
    tabs.map(async ({ id }) => {
      if (id === undefined || id === browser.tabs.TAB_ID_NONE || (await isRunning(id))) return;
      try {
        await browser.scripting.executeScript({ target: { tabId: id }, files: [CONTENT_SCRIPT] });
      } catch {
        // A page where extensions can't run (the browser's own pages, the extension store), or a tab that closed.
      }
    }),
  );
}

async function isRunning(tabId: number): Promise<boolean> {
  try {
    const answer = await browser.tabs.sendMessage<PageRequest, unknown>(tabId, { type: 'ping' }, { frameId: 0 });
    return typeof answer === 'object' && answer !== null && 'ok' in answer && answer.ok === true;
  } catch {
    return false; // No content script answered.
  }
}
