import type { Action, Settings, Shortcut } from './schema';

export const DEFAULT_SETTINGS: Settings = {
  sequenceTimeoutMs: 800,
  scrollStep: 60,
  smoothScroll: true,
  hintChars: 'sadfjklewcmpgh',
  newTabInBackground: true,
};

function defaultShortcut(name: string, keys: string, label: string, action: Action): Shortcut {
  return {
    id: `default:${name}`,
    keys,
    keyMode: 'key',
    action,
    scope: { type: 'global' },
    label,
    source: 'default',
    enabled: true,
  };
}

/** Global shortcuts that work on every site. Users can rekey or disable each one; `f` and `F` arrive with hints. */
export const DEFAULT_SHORTCUTS: readonly Shortcut[] = [
  defaultShortcut('scroll-down', 'j', 'Scroll down', { type: 'scroll', direction: 'down' }),
  defaultShortcut('scroll-up', 'k', 'Scroll up', { type: 'scroll', direction: 'up' }),
  defaultShortcut('scroll-half-down', 'd', 'Scroll down half a page', { type: 'scroll', direction: 'halfDown' }),
  defaultShortcut('scroll-half-up', 'u', 'Scroll up half a page', { type: 'scroll', direction: 'halfUp' }),
  defaultShortcut('scroll-top', 'g g', 'Scroll to the top', { type: 'scroll', direction: 'top' }),
  defaultShortcut('scroll-bottom', 'G', 'Scroll to the bottom', { type: 'scroll', direction: 'bottom' }),
  defaultShortcut('history-back', 'H', 'Go back', { type: 'history', op: 'back' }),
  defaultShortcut('history-forward', 'L', 'Go forward', { type: 'history', op: 'forward' }),
  defaultShortcut('tab-prev', 'J', 'Previous tab', { type: 'tab', op: 'prev' }),
  defaultShortcut('tab-next', 'K', 'Next tab', { type: 'tab', op: 'next' }),
  defaultShortcut('tab-close', 'x', 'Close tab', { type: 'tab', op: 'close' }),
  defaultShortcut('cheatsheet', '?', 'Show keyboard shortcuts', { type: 'cheatsheet' }),
];
