import { browser, type Browser } from 'wxt/browser';
import { BackgroundMessageSchema, type BackgroundMessage, type BackgroundResponse } from '../core/messages';
import { errorMessage } from '../messaging';
import { openTab, runTabOp } from './tabs';

/**
 * Answers content-script requests. Every message is validated first: a content script runs inside the page's
 * renderer, so its messages are untrusted input.
 */
export function listenForMessages(): void {
  browser.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return false;
    const parsed = BackgroundMessageSchema.safeParse(raw);
    if (!parsed.success) {
      sendResponse({ ok: false, error: 'AnyKey received an invalid request.' } satisfies BackgroundResponse);
      return false;
    }
    handle(parsed.data, sender).then(
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

async function handle(message: BackgroundMessage, sender: Browser.runtime.MessageSender): Promise<void> {
  const tab = sender.tab;
  if (tab === undefined) throw new Error('Only pages can send this request.');
  switch (message.type) {
    case 'tab':
      await runTabOp(message.op, tab);
      return;
    case 'openUrl':
      await openTab(message.url, message.background, tab);
      return;
  }
}
