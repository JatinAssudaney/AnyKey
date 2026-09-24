import { browser, type Browser } from 'wxt/browser';
import {
  BackgroundMessageSchema,
  type BackgroundMessage,
  type BackgroundResponse,
  type PickedShortcut,
} from '../core/messages';
import type { Shortcut } from '../core/schema';
import { isHost, siteMatch } from '../core/url';
import { errorMessage } from '../messaging';
import type { Writer } from '../storage/writer';
import { endSession, saveInSession, startPicker } from './picker';
import { openTab, runTabOp } from './tabs';

/**
 * Answers requests from content scripts and AnyKey's own pages. Every message is validated first: a content script
 * runs inside the page's renderer, so its messages are untrusted input.
 */
export function listenForMessages(writer: Writer): void {
  browser.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return false;
    const parsed = BackgroundMessageSchema.safeParse(raw);
    if (!parsed.success) {
      sendResponse({ ok: false, error: 'AnyKey received an invalid request.' } satisfies BackgroundResponse);
      return false;
    }
    handle(parsed.data, sender, writer).then(
      () => {
        sendResponse({ ok: true } satisfies BackgroundResponse);
      },
      (error: unknown) => {
        sendResponse({ ok: false, error: errorMessage(error) } satisfies BackgroundResponse);
      },
    );
    // Keeps the channel open for the async answer. Promise-returning listeners need Chrome 148+.
    return true;
  });
}

async function handle(message: BackgroundMessage, sender: Browser.runtime.MessageSender, writer: Writer): Promise<void> {
  switch (message.type) {
    case 'tab':
      await runTabOp(message.op, senderTab(sender));
      return;
    case 'openUrl':
      await openTab(message.url, message.background, senderTab(sender));
      return;
    case 'mutate':
      // Pages can't change settings: a hostile page could otherwise drive its content script to rewrite them.
      if (!isExtensionPage(sender)) throw new Error("Only AnyKey's own pages can change settings.");
      await writer.submit(message.mutation);
      return;
    case 'startPicker':
      if (!isExtensionPage(sender)) throw new Error("Only AnyKey's own pages can start the picker.");
      await startPicker(message.tabId, message.host);
      return;
    case 'addSiteShortcut': {
      const { tabId, host } = pickerPage(sender);
      await saveInSession(tabId, host, () =>
        writer.submit({ op: 'saveShortcut', shortcut: siteShortcut(message.shortcut, host), site: host }),
      );
      return;
    }
    case 'pickerDone':
      await endSession(pickerPage(sender).tabId);
      return;
  }
}

/** The picker's shortcut, completed: a new id, and every page of the site it was made on. */
function siteShortcut(picked: PickedShortcut, host: string): Shortcut {
  return {
    id: `user:${crypto.randomUUID()}`,
    ...picked,
    scope: { type: 'site', match: siteMatch(host) },
    source: 'user',
    enabled: true,
  };
}

function senderTab(sender: Browser.runtime.MessageSender): Browser.tabs.Tab {
  if (sender.tab === undefined) throw new Error('Only pages can send this request.');
  return sender.tab;
}

/**
 * The tab and site of a picker's request. The site comes from the sender's URL, which the browser vouches for,
 * never from the message. The picker runs in the top frame only.
 */
function pickerPage(sender: Browser.runtime.MessageSender): { tabId: number; host: string } {
  const tabId = senderTab(sender).id;
  const url = sender.url !== undefined && URL.canParse(sender.url) ? new URL(sender.url) : null;
  if (tabId === undefined || sender.frameId !== 0 || url === null || !/^https?:$/.test(url.protocol)) {
    throw new Error('AnyKey can add shortcuts only for web pages.');
  }
  if (!isHost(url.hostname)) throw new Error('AnyKey can add shortcuts only for web pages.');
  return { tabId, host: url.hostname };
}

/** The popup or the options page. A content script's sender URL is the page it runs in. */
function isExtensionPage(sender: Browser.runtime.MessageSender): boolean {
  return sender.url?.startsWith(browser.runtime.getURL('/')) === true;
}
