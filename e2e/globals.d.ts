import type { WxtBrowser } from 'wxt/browser';

declare global {
  // Callbacks passed to serviceWorker.evaluate() run inside the extension, where `chrome` is the extension API.
  const chrome: WxtBrowser;

  // Helpers the fixture pages define for page.evaluate().
  interface Window {
    /** Key events the page's own document listeners received, as "keydown:j". */
    pageKeys?: string[];
    focusClosedInput?: () => void;
    closedInputValue?: () => string;
  }
}
