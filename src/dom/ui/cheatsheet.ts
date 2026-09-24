import { keycapLabels } from '../../core/keys';
import type { NativeKey } from '../../core/resolve';
import type { Action, KeyMode, Shortcut } from '../../core/schema';
import type { Mode } from '../modes';
import { deepActiveElement } from '../shadow';
import { h } from './h';
import type { UiRoot } from './root';

// Page elements come first: most are shortcuts for the site's own pages, a preset's or ones picked there.
const GROUPS: readonly { title: string; types: readonly Action['type'][] }[] = [
  { title: 'Page elements', types: ['click', 'focus'] },
  { title: 'Scrolling', types: ['scroll'] },
  { title: 'Pages and links', types: ['history', 'navigate', 'hints'] },
  { title: 'Tabs', types: ['tab'] },
  { title: 'Help', types: ['cheatsheet'] },
];

/** Past this many rows, the cheatsheet widens to fit more columns. */
const WIDE_ROWS = 24;

export interface CheatsheetOptions {
  root: UiRoot;
  isMac: boolean;
  shortcuts: readonly Shortcut[];
  /** The site's own keys that reach it on this page, listed before AnyKey's. */
  native: readonly NativeKey[];
  /** Key-mode tokens that close it besides Esc: the cheatsheet shortcut's own key. */
  closeTokens: readonly string[];
  scrollStep: number;
  pushMode: (mode: Mode) => void;
  popMode: (mode: Mode) => void;
}

interface Keys {
  keys: string;
  keyMode: KeyMode;
}

/** One line of the cheatsheet: what it does, and every key that does it ("k or Space"). */
interface Row {
  label: string;
  keys: Keys[];
}

interface Section {
  title: string;
  rows: Row[];
}

/** Opens the `?` cheatsheet: a modal dialog listing the active shortcuts. Resolves once it is showing. */
export async function openCheatsheet(options: CheatsheetOptions): Promise<void> {
  const container = await options.root.container();
  const previousFocus = deepActiveElement();

  const { sites, own } = sections(options);
  const rows = [...sites, ...own].reduce((count, section) => count + section.rows.length, 0);
  const closeButton = h('button', { type: 'button', class: 'ak-close', 'aria-label': 'Close' }, '×');
  // Focused on open, so arrow keys, Page Down and Space scroll the list.
  const body = h(
    'div',
    { class: 'ak-cheatsheet-body', tabindex: -1, autofocus: true },
    // The site's keys come first: on a site with a preset, they are what its pages are built around. Each site's
    // list runs on from column to column, while AnyKey's groups each keep to one column.
    ...sites.map((section) => h('section', { class: 'ak-band ak-site-keys' }, ...sectionContent(section, options))),
    own.length > 0 &&
      h(
        'div',
        { class: 'ak-band' },
        ...own.map((section) => h('section', { class: 'ak-group' }, ...sectionContent(section, options))),
      ),
  );
  const dialog = h(
    'dialog',
    {
      class: rows > WIDE_ROWS ? 'ak-surface ak-cheatsheet ak-cheatsheet-wide' : 'ak-surface ak-cheatsheet',
      'aria-labelledby': 'ak-cheatsheet-title',
    },
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

/** The site's own keys, by site ("YouTube's own keys"), and AnyKey's shortcuts in their groups. */
function sections({ shortcuts, native }: CheatsheetOptions): { sites: Section[]; own: Section[] } {
  const sites = [...new Set(native.map(({ site }) => site))].map((site) => ({
    title: `${site}'s own keys`,
    rows: rowsOf(native.filter((key) => key.site === site).map((key) => ({ ...key, keyMode: 'key' as const }))),
  }));
  const own = GROUPS.map(({ title, types }) => ({
    title,
    rows: rowsOf(shortcuts.filter((shortcut) => types.includes(shortcut.action.type))),
  }));
  return { sites, own: own.filter(({ rows }) => rows.length > 0) };
}

/** One row per label, in the order the labels first come. */
function rowsOf(entries: readonly (Keys & { label: string })[]): Row[] {
  const rows = new Map<string, Row>();
  for (const { keys, keyMode, label } of entries) {
    const row = rows.get(label) ?? { label, keys: [] };
    if (!row.keys.some((other) => other.keys === keys && other.keyMode === keyMode)) row.keys.push({ keys, keyMode });
    rows.set(label, row);
  }
  return [...rows.values()];
}

function sectionContent({ title, rows }: Section, { isMac }: CheatsheetOptions): HTMLElement[] {
  const lines = rows.map(({ label, keys }) =>
    h(
      'tr',
      {},
      // Each way to press it stays on one line, and a long row breaks before "or".
      h(
        'td',
        { class: 'ak-keys' },
        ...keys.flatMap((one, i) =>
          i === 0
            ? [h('span', { class: 'ak-alt' }, ...keycaps(one, isMac))]
            : [' ', h('span', { class: 'ak-alt' }, h('span', { class: 'ak-or' }, 'or'), ' ', ...keycaps(one, isMac))],
        ),
      ),
      h('td', {}, label),
    ),
  );
  return [h('h3', {}, title), h('table', {}, h('tbody', {}, ...lines))];
}

function keycaps(shortcut: Keys, isMac: boolean): HTMLElement[] {
  const chords = keycapLabels(shortcut.keys, shortcut.keyMode, isMac) ?? [];
  return chords.flatMap((labels, i) => [
    ...(i > 0 ? [h('span', { class: 'ak-then' }, 'then')] : []),
    ...labels.flatMap((label, j) => [
      ...(j > 0 && !isMac ? [h('span', { class: 'ak-plus', 'aria-hidden': 'true' }, '+')] : []),
      h('kbd', {}, label),
    ]),
  ]);
}
