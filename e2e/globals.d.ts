import type { WxtBrowser } from 'wxt/browser';

declare global {
  // Callbacks passed to serviceWorker.evaluate() run inside the extension, where `chrome` is the extension API.
  const chrome: WxtBrowser;
}
