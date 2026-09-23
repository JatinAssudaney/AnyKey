import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: ['<all_urls>'],
  // document_start lets the key listener register before any page script, so it runs first.
  runAt: 'document_start',
  // v1 handles the top frame only.
  allFrames: false,
  main() {
    // The key engine is wired up here in M2.
  },
});
