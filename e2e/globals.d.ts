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
    /** How often the picker fixture's buttons were clicked. */
    clicks?: { like: number; play: number };
    /** The hints fixture's clicks, as the id of the element clicked, with "mod+" before it for Ctrl or Cmd clicks. */
    clickLog?: string[];
  }
}
