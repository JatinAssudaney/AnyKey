import type { BackgroundMessage } from '../core/messages';
import type { Settings, Shortcut } from '../core/schema';
import { isSafeUrl } from '../core/url';
import { sendToBackground } from '../messaging';
import { clickElement, focusElement, linkOf } from './click';
import { isEditable } from './editable';
import type { Scroller } from './scroll';
import { findTarget } from './targets';

export interface ExecutorOptions {
  settings: () => Settings;
  scroller: Scroller;
  isMac: boolean;
  openCheatsheet: () => void;
  /** Shows link hints. Typing one runs `activate` on its element. */
  openHints: (activate: (element: Element) => void) => void;
  toast: (message: string) => void;
}

export type RunShortcut = (shortcut: Shortcut, repeat: boolean) => void;

export function createExecutor(options: ExecutorOptions): RunShortcut {
  const { toast } = options;

  async function request(message: BackgroundMessage): Promise<void> {
    const response = await sendToBackground(message);
    if (!response.ok) toast(response.error);
  }

  function navigate(url: string, newTab: boolean, settings: Settings): void {
    let resolved: URL | null = null;
    try {
      if (isSafeUrl(url)) resolved = new URL(url, location.href);
    } catch {
      resolved = null;
    }
    // A relative URL on a file:// page would resolve to another file:// URL.
    if (resolved === null || (resolved.protocol !== 'http:' && resolved.protocol !== 'https:')) {
      toast('AnyKey only opens http and https links.');
      return;
    }
    if (newTab) void request({ type: 'openUrl', url: resolved.href, background: settings.newTabInBackground });
    else location.assign(resolved.href);
  }

  /**
   * A click. For a new tab, a link opens through the background, which can place the tab, and anything else gets
   * a Ctrl or Cmd click.
   */
  function click(element: Element, newTab: boolean, settings: Settings): void {
    const link = newTab ? linkOf(element) : null;
    if (link !== null) navigate(link.href, true, settings);
    else clickElement(element, { modifier: newTab, isMac: options.isMac });
  }

  /** What typing a hint does: a text field or list takes focus (a list opens too), and anything else is clicked. */
  function activate(element: Element, newTab: boolean): void {
    if (!element.isConnected) {
      toast('That element is gone from the page.');
      return;
    }
    if (isEditable(element) && focusElement(element)) {
      if (element instanceof HTMLSelectElement) showPicker(element);
      return;
    }
    click(element, newTab, options.settings());
  }

  return ({ action, label }, repeat) => {
    const settings = options.settings();
    switch (action.type) {
      case 'scroll': {
        // Smooth scrolling restarts on every key repeat and stutters, so held keys scroll instantly.
        const smooth = settings.smoothScroll && !repeat && !matchMedia('(prefers-reduced-motion: reduce)').matches;
        options.scroller.scroll(action.direction, { step: settings.scrollStep, smooth });
        return;
      }
      case 'history':
        if (action.op === 'back') history.back();
        else history.forward();
        return;
      case 'tab':
        void request({ type: 'tab', op: action.op });
        return;
      case 'navigate':
        navigate(action.url, action.newTab ?? false, settings);
        return;
      case 'cheatsheet':
        options.openCheatsheet();
        return;
      case 'click': {
        const element = findTarget(action.target);
        if (element === null) {
          toast(notFound(label));
          return;
        }
        click(element, action.newTab === true, settings);
        return;
      }
      case 'focus': {
        const element = findTarget(action.target);
        if (element === null) toast(notFound(label));
        else if (!focusElement(element)) toast(`"${label}" found an element that can't take focus.`);
        return;
      }
      case 'hints': {
        const newTab = action.newTab === true;
        options.openHints((element) => {
          activate(element, newTab);
        });
        return;
      }
    }
  };
}

function notFound(label: string): string {
  return `Couldn't find the element for "${label}" on this page.`;
}

/** Opens a list's options, as a click would. Only a key press or click just before allows it. */
function showPicker(select: HTMLSelectElement): void {
  try {
    select.showPicker();
  } catch {
    // Focused is enough: the arrow keys and typing still choose an option.
  }
}
