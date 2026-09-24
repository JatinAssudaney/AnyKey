import { keycapLabels } from '../../core/keys';
import type { NativeKey } from '../../core/resolve';
import type { Action, KeyMode, Shortcut } from '../../core/schema';
import type { Mode } from '../modes';
import { deepActiveElement } from '../shadow';
import { h } from './h';
import type { UiRoot } from './root';

const GROUPS: readonly { title: string; types: readonly Action['type'][] }[] = [
  { title: 'Scrolling', types: ['scroll'] },
  { title: 'Pages and links', types: ['history', 'navigate', 'hints'] },
  { title: 'Tabs', types: ['tab'] },
  { title: 'Page elements', types: ['click', 'focus'] },
  { title: 'Help', types: ['cheatsheet'] },
];

export interface CheatsheetOptions {
  root: UiRoot;
  isMac: boolean;
  shortcuts: readonly Shortcut[];
  /** The site's own keys that reach it on this page, listed after AnyKey's. */
  native: readonly NativeKey[];
  /** Key-mode tokens that close it besides Esc: the cheatsheet shortcut's own key. */
  closeTokens: readonly string[];
  scrollStep: number;
  pushMode: (mode: Mode) => void;
  popMode: (mode: Mode) => void;
}

/** Opens the `?` cheatsheet: a modal dialog listing the active shortcuts. Resolves once it is showing. */
export async function openCheatsheet(options: CheatsheetOptions): Promise<void> {
  const container = await options.root.container();
  const previousFocus = deepActiveElement();

  const closeButton = h('button', { type: 'button', class: 'ak-close', 'aria-label': 'Close' }, '×');
  // Focused on open, so arrow keys, Page Down and Space scroll the list.
  const body = h('div', { class: 'ak-cheatsheet-body', tabindex: -1, autofocus: true }, ...groups(options));
  const dialog = h(
    'dialog',
    { class: 'ak-surface ak-cheatsheet', 'aria-labelledby': 'ak-cheatsheet-title' },
    h(
      'header',
      { class: 'ak-cheatsheet-header' },
      h('h2', { id: 'ak-cheatsheet-title' }, 'Keyboard shortcuts'),
      closeButton,
    ),
    body,
    h('footer', { class: 'ak-cheatsheet-footer' }, 'AnyKey. Press Esc to close.'),
  );

  let closed = false;
  /**
   * Leaves the key stack at once. The dialog's own close event comes later, as a queued task, and input outranks
   * queued tasks: a key pressed right after Esc could otherwise still reach the closed cheatsheet.
   */
  function close(): void {
    if (closed) return;
    closed = true;
    options.popMode(mode);
    dialog.close();
    dialog.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  }

  const mode: Mode = {
    keyDown(event, token) {
      if (token === 'escape' || (token !== null && options.closeTokens.includes(token))) {
        // Auto-repeats are the same press: holding "?" a little long must not close what it just opened.
        if (!event.repeat) close();
        return 'consume';
      }
      if (token === 'j' || token === 'k') {
        const top = (token === 'j' ? 1 : -1) * options.scrollStep;
        body.scrollBy({ top, behavior: event.repeat ? 'instant' : 'smooth' });
        return 'consume';
      }
      return 'isolate';
    },
  };

  closeButton.addEventListener('click', close);
  // A click on the backdrop targets the dialog itself, outside its box.
  dialog.addEventListener('click', (event) => {
    const box = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (event.target === dialog && !inside) close();
  });
  // Any other way the dialog closes.
  dialog.addEventListener('close', close, { once: true });

  container.append(dialog);
  dialog.showModal();
  options.pushMode(mode);
}

function groups(options: CheatsheetOptions): HTMLElement[] {
  const own = GROUPS.map(({ title, types }) => ({
    title,
    rows: options.shortcuts.filter((shortcut) => types.includes(shortcut.action.type)),
  }));
  // The site's own keys come last, by site: "YouTube's own keys".
  const sites = [...new Set(options.native.map(({ site }) => site))].map((site) => ({
    title: `${site}'s own keys`,
    rows: options.native.filter((key) => key.site === site).map((key) => ({ ...key, keyMode: 'key' as const })),
  }));
  return [...own, ...sites].flatMap(({ title, rows }) => {
    if (rows.length === 0) return [];
    const cells = rows.map((row) =>
      h('tr', {}, h('td', { class: 'ak-keys' }, ...keycaps(row, options.isMac)), h('td', {}, row.label)),
    );
    return [h('section', { class: 'ak-group' }, h('h3', {}, title), h('table', {}, h('tbody', {}, ...cells)))];
  });
}

function keycaps(shortcut: { keys: string; keyMode: KeyMode }, isMac: boolean): HTMLElement[] {
  const chords = keycapLabels(shortcut.keys, shortcut.keyMode, isMac) ?? [];
  return chords.flatMap((labels, i) => [
    ...(i > 0 ? [h('span', { class: 'ak-then' }, 'then')] : []),
    ...labels.flatMap((label, j) => [
      ...(j > 0 && !isMac ? [h('span', { class: 'ak-plus', 'aria-hidden': 'true' }, '+')] : []),
      h('kbd', {}, label),
    ]),
  ]);
}
