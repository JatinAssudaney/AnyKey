import { browser, type Browser } from 'wxt/browser';
import { BackgroundMessageSchema, type BackgroundMessage, type BackgroundResponse } from '../core/messages';
import { errorMessage } from '../messaging';
import type { Writer } from '../storage/writer';
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
  }
}

function senderTab(sender: Browser.runtime.MessageSender): Browser.tabs.Tab {
  if (sender.tab === undefined) throw new Error('Only pages can send this request.');
  return sender.tab;
}

/** The popup or the options page. A content script's sender URL is the page it runs in. */
function isExtensionPage(sender: Browser.runtime.MessageSender): boolean {
  return sender.url?.startsWith(browser.runtime.getURL('/')) === true;
}
