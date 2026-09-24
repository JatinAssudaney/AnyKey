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

/** Global shortcuts that work on every site. Users can rekey or disable each one. */
export const DEFAULT_SHORTCUTS: readonly Shortcut[] = [
  defaultShortcut('scroll-down', 'j', 'Scroll down', { type: 'scroll', direction: 'down' }),
  defaultShortcut('scroll-up', 'k', 'Scroll up', { type: 'scroll', direction: 'up' }),
  defaultShortcut('scroll-half-down', 'd', 'Scroll down half a page', { type: 'scroll', direction: 'halfDown' }),
  defaultShortcut('scroll-half-up', 'u', 'Scroll up half a page', { type: 'scroll', direction: 'halfUp' }),
  defaultShortcut('scroll-top', 'g g', 'Scroll to the top', { type: 'scroll', direction: 'top' }),
  defaultShortcut('scroll-bottom', 'G', 'Scroll to the bottom', { type: 'scroll', direction: 'bottom' }),
  // Not f, which YouTube and most video players use for fullscreen (docs/design.md, "Hints").
  defaultShortcut('hints', 'F', 'Click a link or button', { type: 'hints' }),
  defaultShortcut('hints-new-tab', 'g f', 'Open a link in a new tab', { type: 'hints', newTab: true }),
  defaultShortcut('history-back', 'H', 'Go back', { type: 'history', op: 'back' }),
  defaultShortcut('history-forward', 'L', 'Go forward', { type: 'history', op: 'forward' }),
  defaultShortcut('tab-prev', 'J', 'Previous tab', { type: 'tab', op: 'prev' }),
  defaultShortcut('tab-next', 'K', 'Next tab', { type: 'tab', op: 'next' }),
  defaultShortcut('tab-close', 'x', 'Close tab', { type: 'tab', op: 'close' }),
  defaultShortcut('cheatsheet', '?', 'Show keyboard shortcuts', { type: 'cheatsheet' }),
];
