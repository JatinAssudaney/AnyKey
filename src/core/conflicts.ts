import { parseKeys, resolveMod, sequenceTokens, tokenOf, type Chord } from './keys';
import { resolve } from './resolve';
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
  | { kind: 'typing' };

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
 * unique). Shadowing follows `resolve()`, so disabled shortcuts take no keys.
 */
export function findConflicts(shortcuts: readonly Shortcut[], isMac: boolean): Map<string, Conflict[]> {
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
  return conflicts;
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

/** A conflict in words, for the options page and the picker. */
export function describeConflict(conflict: Conflict): string {
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
