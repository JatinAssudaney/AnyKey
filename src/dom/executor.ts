import type { BackgroundMessage } from '../core/messages';
import type { Action, Settings } from '../core/schema';
import { isSafeUrl } from '../core/url';
import { sendToBackground } from '../messaging';
import type { Scroller } from './scroll';

export interface ExecutorOptions {
  settings: () => Settings;
  scroller: Scroller;
  openCheatsheet: () => void;
  toast: (message: string) => void;
}

export type RunAction = (action: Action, repeat: boolean) => void;

export function createExecutor(options: ExecutorOptions): RunAction {
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

  return (action, repeat) => {
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
      case 'click':
      case 'focus':
      case 'hints':
        // Element targets arrive with the picker (M4) and hints with M5; no shortcut can hold these actions yet.
        toast('This version of AnyKey cannot run this shortcut yet.');
        return;
    }
  };
}
