import { parseKeys, resolveMod, sequenceTokens, tokenOf, type Chord } from './keys';
import { resolve, type NativeKey } from './resolve';
import type { Shortcut } from './schema';

/** Why a shortcut may not run the way its owner expects. The options page words each one. */
export type Conflict =
  /** A shortcut of higher or equal precedence takes these keys, or the start of them: this one never runs. */
  | { kind: 'shadowed'; by: Shortcut }
  /** This shortcut takes the keys of `other`, which never runs. */
  | { kind: 'shadows'; other: Shortcut }
  /** A longer shortcut starts with these keys, so this one runs only after the sequence timeout. */
  | { kind: 'waits'; longer: Shortcut }
  /** The browser keeps one of these keys for itself, so the shortcut never runs. */
  | { kind: 'reserved' }
  /** It also runs in text fields, but one of its keys types or edits text there. */
  | { kind: 'typing' }
  /** It takes the keys of the site's own shortcut, or the first of them, so the site's never runs. */
  | { kind: 'takesNative'; native: NativeKey }
  /** The site's own shortcut on its first keys runs first, which can stop the rest from reaching AnyKey. */
  | { kind: 'afterNative'; native: NativeKey };

/** Keys the browser handles before any page sees them, in notation. */
const RESERVED = {
  mac: [
    'meta+t',
    'meta+n',
    'meta+w',
    'meta+q',
    'meta+shift+n',
    'meta+shift+w',
    'meta+shift+t',
    // ⌘⇧[ and ⌘⇧]: the keys report the shifted characters.
    'meta+{',
    'meta+}',
    'meta+alt+left',
    'meta+alt+right',
    'ctrl+tab',
    'ctrl+shift+tab',
    'ctrl+pageup',
    'ctrl+pagedown',
  ],
  other: [
    'ctrl+t',
    'ctrl+n',
    'ctrl+w',
    'ctrl+shift+n',
    'ctrl+shift+w',
    'ctrl+shift+t',
    'ctrl+tab',
    'ctrl+shift+tab',
    'ctrl+pageup',
    'ctrl+pagedown',
    'ctrl+f4',
    'alt+f4',
  ],
} as const;

/** Physical keys that can take part in a reserved chord, as the key-mode keys they produce. */
const CODE_KEYS = new Map([
  ['Tab', 'tab'],
  ['PageUp', 'pageup'],
  ['PageDown', 'pagedown'],
  ['F4', 'f4'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
]);

/**
 * Finds conflicts among one set of shortcuts that can be active together, keyed by shortcut id (ids must be
 * unique), and with the site's own keys (`native`). Shadowing follows `resolve()`, so disabled shortcuts take no
 * keys.
 */
export function findConflicts(
  shortcuts: readonly Shortcut[],
  isMac: boolean,
  native: readonly NativeKey[] = [],
): Map<string, Conflict[]> {
  const conflicts = new Map<string, Conflict[]>();
  const add = (shortcut: Shortcut, conflict: Conflict): void => {
    conflicts.set(shortcut.id, [...(conflicts.get(shortcut.id) ?? []), conflict]);
  };

  const { active, shadowed } = resolve({ shortcuts, isMac });
  for (const { shortcut, by } of shadowed) {
    add(shortcut, { kind: 'shadowed', by });
    add(by, { kind: 'shadows', other: shortcut });
  }

  const sequences = active.map((shortcut) => ({
    shortcut,
    tokens: sequenceTokens(shortcut.keys, shortcut.keyMode, isMac) ?? [],
  }));
  for (const short of sequences) {
    for (const long of sequences) {
      if (short.shortcut.keyMode !== long.shortcut.keyMode || short.tokens.length >= long.tokens.length) continue;
      if (short.tokens.every((token, i) => long.tokens[i] === token)) add(short.shortcut, { kind: 'waits', longer: long.shortcut });
    }
  }

  const reserved = new Set(
    (isMac ? RESERVED.mac : RESERVED.other).flatMap((keys) => sequenceTokens(keys, 'key', isMac) ?? []),
  );
  for (const shortcut of shortcuts) {
    const chords = parseChords(shortcut);
    if (chords.some((chord) => reserved.has(keyModeToken(chord, shortcut.keyMode, isMac)))) {
      add(shortcut, { kind: 'reserved' });
    }
    if (shortcut.allowInInputs === true && chords.some(editsText)) add(shortcut, { kind: 'typing' });
  }

  // The site's keys are characters, so only key-mode shortcuts are compared with them.
  const typed = sequences.filter(({ shortcut }) => shortcut.keyMode === 'key');
  for (const key of native) {
    const tokens = sequenceTokens(key.keys, 'key', isMac) ?? [];
    const takers = typed.filter(
      (entry) => startsWith(tokens, entry.tokens) && key.yieldedBy?.includes(entry.shortcut.id) !== true,
    );
    for (const { shortcut } of takers) add(shortcut, { kind: 'takesNative', native: key });
    // A site key AnyKey takes never runs, so it can't get in the way of a longer shortcut.
    if (takers.length > 0) continue;
    for (const { shortcut, tokens: own } of typed) {
      if (own.length > tokens.length && startsWith(own, tokens)) add(shortcut, { kind: 'afterNative', native: key });
    }
  }
  return conflicts;
}

/** The site's own keys that still reach the site: no active shortcut takes their keys, or the first of them. */
export function nativeKeysLeft(native: readonly NativeKey[], active: readonly Shortcut[], isMac: boolean): NativeKey[] {
  const typed = active.flatMap((shortcut) =>
    shortcut.keyMode === 'key' ? [sequenceTokens(shortcut.keys, 'key', isMac) ?? []] : [],
  );
  return native.filter((key) => {
    const tokens = sequenceTokens(key.keys, 'key', isMac) ?? [];
    return !typed.some((own) => startsWith(tokens, own));
  });
}

function startsWith(tokens: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length > 0 && prefix.length <= tokens.length && prefix.every((token, i) => tokens[i] === token);
}

function parseChords(shortcut: Shortcut): Chord[] {
  const parsed = parseKeys(shortcut.keys, shortcut.keyMode);
  return parsed.ok ? parsed.chords : [];
}

/** The key-mode token a chord presses, reading a physical key as the US-layout key it produces. */
function keyModeToken(chord: Chord, mode: Shortcut['keyMode'], isMac: boolean): string {
  const key = mode === 'key' ? chord.key : (/^Key([A-Z])$/.exec(chord.key)?.[1]?.toLowerCase() ?? CODE_KEYS.get(chord.key));
  return key === undefined ? '' : tokenOf(resolveMod(chord, isMac), key);
}

/** A chord without Ctrl, Alt or Meta types or edits text, unless it is Esc or a function key. */
function editsText(chord: Chord): boolean {
  if (chord.mod || chord.ctrl || chord.alt || chord.meta) return false;
  return !/^(?:escape|Escape|[fF]\d{1,2})$/.test(chord.key);
}

/** Site keys a shortcut clashes with in the same way, worded together: GitHub uses `t` on three kinds of page. */
interface SiteLine {
  kind: 'takesNative' | 'afterNative';
  site: string;
  labels: string[];
}

/**
 * A shortcut's conflicts in words, for the options page and the picker: a line for each, except that the site keys
 * it clashes with in the same way share one line per site.
 */
export function describeConflicts(conflicts: readonly Conflict[]): string[] {
  const lines: (string | SiteLine)[] = [];
  for (const conflict of conflicts) {
    if (conflict.kind !== 'takesNative' && conflict.kind !== 'afterNative') {
      lines.push(describeConflict(conflict));
      continue;
    }
    const { site, label } = conflict.native;
    const line = lines.find(
      (entry): entry is SiteLine => typeof entry !== 'string' && entry.kind === conflict.kind && entry.site === site,
    );
    if (line === undefined) lines.push({ kind: conflict.kind, site, labels: [label] });
    else if (!line.labels.includes(label)) line.labels.push(label);
  }
  return lines.map((line) => (typeof line === 'string' ? line : describeSiteLine(line)));
}

function describeConflict(conflict: Exclude<Conflict, { kind: SiteLine['kind'] }>): string {
  switch (conflict.kind) {
    case 'shadowed':
      return `Doesn't run: "${conflict.by.label}" uses these keys.`;
    case 'shadows':
      return `"${conflict.other.label}" doesn't run, because this shortcut uses its keys.`;
    case 'waits':
      return `Runs after a short pause, because "${conflict.longer.label}" starts with the same keys.`;
    case 'reserved':
      return 'The browser keeps these keys for itself, so this shortcut never runs.';
    case 'typing':
      return "Also runs in text fields, so you can't type these keys there.";
  }
}

function describeSiteLine({ kind, site, labels }: SiteLine): string {
  const quoted = labels.map((label) => `"${label}"`);
  const last = quoted.pop() ?? '';
  const names = quoted.length > 0 ? `${quoted.join(', ')} and ${last}` : last;
  const one = labels.length === 1;
  if (kind === 'afterNative') return `${site}'s own ${names} ${one ? 'runs' : 'run'} first, which can stop this shortcut.`;
  return `${site}'s own ${names} ${one ? "doesn't" : "don't"} run, because this shortcut takes ${one ? 'its' : 'their'} keys.`;
}
