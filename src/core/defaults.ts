import type { Action, Settings, Shortcut } from './schema';
import type { Text } from './text';

export const DEFAULT_SETTINGS: Settings = {
  sequenceTimeoutMs: 800,
  scrollStep: 60,
  smoothScroll: true,
  hintChars: 'sadfjklewcmpgh',
  newTabInBackground: true,
};

/** `label` names a message: a built-in shortcut's label is translated where it shows (`shortcutLabel` in src/i18n.ts). */
function defaultShortcut(name: string, keys: string, label: Text['key'], action: Action): Shortcut {
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
  defaultShortcut('scroll-down', 'j', 'action.scrollDown', { type: 'scroll', direction: 'down' }),
  defaultShortcut('scroll-up', 'k', 'action.scrollUp', { type: 'scroll', direction: 'up' }),
  defaultShortcut('scroll-half-down', 'd', 'action.scrollHalfDown', { type: 'scroll', direction: 'halfDown' }),
  defaultShortcut('scroll-half-up', 'u', 'action.scrollHalfUp', { type: 'scroll', direction: 'halfUp' }),
  defaultShortcut('scroll-top', 'g g', 'action.scrollTop', { type: 'scroll', direction: 'top' }),
  defaultShortcut('scroll-bottom', 'G', 'action.scrollBottom', { type: 'scroll', direction: 'bottom' }),
  // Not f, which YouTube and most video players use for fullscreen (docs/design.md, "Hints").
  defaultShortcut('hints', 'F', 'action.hintsClickDefault', { type: 'hints' }),
  defaultShortcut('hints-new-tab', 'g f', 'action.hintsNewTabDefault', { type: 'hints', newTab: true }),
  defaultShortcut('history-back', 'H', 'action.back', { type: 'history', op: 'back' }),
  defaultShortcut('history-forward', 'L', 'action.forward', { type: 'history', op: 'forward' }),
  defaultShortcut('tab-prev', 'J', 'action.prevTab', { type: 'tab', op: 'prev' }),
  defaultShortcut('tab-next', 'K', 'action.nextTab', { type: 'tab', op: 'next' }),
  defaultShortcut('tab-close', 'x', 'action.closeTab', { type: 'tab', op: 'close' }),
  defaultShortcut('cheatsheet', '?', 'action.cheatsheet', { type: 'cheatsheet' }),
];
