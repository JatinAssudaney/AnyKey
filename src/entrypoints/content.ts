import { defineContentScript } from 'wxt/utils/define-content-script';
import { startAnyKey } from '../dom/app';

export default defineContentScript({
  matches: ['<all_urls>'],
  // document_start lets the key listener register before any page script, so it runs first.
  runAt: 'document_start',
  // v1 handles the top frame only.
  allFrames: false,
  // Otherwise WXT posts a "content script started" message to the page itself on every load.
  noScriptStartedPostMessage: true,
  main(ctx) {
    startAnyKey(ctx, { picker: true });
  },
});
