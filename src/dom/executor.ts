import type { BackgroundMessage } from '../core/messages';
import type { Settings, Shortcut } from '../core/schema';
import { isSafeUrl } from '../core/url';
import { sendToBackground } from '../messaging';
import { clickElement, focusElement, linkOf } from './click';
import type { Scroller } from './scroll';
import { findTarget } from './targets';

export interface ExecutorOptions {
  settings: () => Settings;
  scroller: Scroller;
  isMac: boolean;
  openCheatsheet: () => void;
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
        const link = action.newTab === true ? linkOf(element) : null;
        // A link opens through the background, which can place the tab; anything else gets a Ctrl or Cmd click.
        if (link !== null) navigate(link.href, true, settings);
        else clickElement(element, { modifier: action.newTab === true, isMac: options.isMac });
        return;
      }
      case 'focus': {
        const element = findTarget(action.target);
        if (element === null) toast(notFound(label));
        else if (!focusElement(element)) toast(`"${label}" found an element that can't take focus.`);
        return;
      }
      case 'hints':
        // Hints arrive with M5; no shortcut can hold this action yet.
        toast('This version of AnyKey cannot run this shortcut yet.');
        return;
    }
  };
}

function notFound(label: string): string {
  return `Couldn't find the element for "${label}" on this page.`;
}
