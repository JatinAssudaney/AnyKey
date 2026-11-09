import type { KeyMode } from './schema';
import type { Text } from './text';

/**
 * One key press of a shortcut: modifiers plus a key. In key mode, `key` is a character ("g", "G", "?") or a named
 * key ("enter", "up", "f5"). In code mode it is a physical key code ("KeyG", "Digit1"). `mod` means Meta on macOS
 * and Ctrl elsewhere, so a synced shortcut such as "mod+k" works on both.
 */
export interface Chord {
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

export interface Modifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export type ParsedKeys = { ok: true; chords: Chord[] } | { ok: false; error: Text };

export const MAX_SEQUENCE_LENGTH = 4;

/** Event codes for Shift, Ctrl, Alt, Meta and the lock keys. They never form a shortcut on their own. */
export const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Fn',
  'FnLock',
]);

/** Physical key codes look like "KeyK", "Digit1", "BracketLeft" or "F5". */
export const CODE_NAME = /^[A-Z][A-Za-z\d]*$/;

type ModifierName = keyof Modifiers | 'mod';

const MODIFIER_ALIASES = new Map<string, ModifierName>([
  ['mod', 'mod'],
  ['ctrl', 'ctrl'],
  ['control', 'ctrl'],
  ['alt', 'alt'],
  ['option', 'alt'],
  ['opt', 'alt'],
  ['shift', 'shift'],
  ['meta', 'meta'],
  ['cmd', 'meta'],
  ['command', 'meta'],
  ['super', 'meta'],
  ['win', 'meta'],
]);

/** Named keys by every accepted spelling (lowercase), mapped to the canonical name stored in shortcuts. */
const NAMED_KEYS = new Map<string, string>([
  ['enter', 'enter'],
  ['return', 'enter'],
  ['escape', 'escape'],
  ['esc', 'escape'],
  ['tab', 'tab'],
  ['space', 'space'],
  ['spacebar', 'space'],
  ['backspace', 'backspace'],
  ['delete', 'delete'],
  ['del', 'delete'],
  ['insert', 'insert'],
  ['up', 'up'],
  ['arrowup', 'up'],
  ['down', 'down'],
  ['arrowdown', 'down'],
  ['left', 'left'],
  ['arrowleft', 'left'],
  ['right', 'right'],
  ['arrowright', 'right'],
  ['home', 'home'],
  ['end', 'end'],
  ['pageup', 'pageup'],
  ['pgup', 'pageup'],
  ['pagedown', 'pagedown'],
  ['pgdn', 'pagedown'],
  ['plus', 'plus'],
  ...Array.from({ length: 24 }, (_, i): [string, string] => [`f${i + 1}`, `f${i + 1}`]),
]);

/** The canonical name for a named key, from a shortcut string or a KeyboardEvent `key` ("ArrowUp", " ", "+"). */
export function namedKey(key: string): string | undefined {
  if (key === ' ') return 'space';
  if (key === '+') return 'plus';
  return key.length > 1 ? NAMED_KEYS.get(key.toLowerCase()) : undefined;
}

/** A single visible character: what `event.key` holds for character keys. */
export function isPrintable(key: string): boolean {
  const code = key.codePointAt(0) ?? 0;
  return isOneCodePoint(key) && code > 0x20 && (code < 0x7f || code > 0x9f);
}

/** A letter with distinct upper and lower case forms, where Shift picks the case. */
export function isCased(char: string): boolean {
  const lower = char.toLowerCase();
  const upper = char.toUpperCase();
  // "ß" uppercases to "SS": not a single key's character.
  return lower !== upper && isOneCodePoint(lower) && isOneCodePoint(upper);
}

function isOneCodePoint(text: string): boolean {
  const code = text.codePointAt(0);
  return code !== undefined && text.length === (code > 0xffff ? 2 : 1);
}

/**
 * Parses shortcut notation: chords separated by spaces ("g i"), modifiers joined with "+" ("ctrl+shift+k").
 *
 * Key mode rules, which match how `keyToken` (keyEvent.ts) reads events:
 * - Without Ctrl, Alt, Meta or mod, letter case carries Shift: "G" and "shift+g" are the same chord.
 * - With them, letter case is ignored and Shift must be explicit: "ctrl+K" is "ctrl+k".
 * - Shift with any other character is an error: the character already shows it ("?", not "shift+/").
 */
export function parseKeys(keys: string, mode: KeyMode): ParsedKeys {
  const text = keys.trim();
  if (text === '') return { ok: false, error: { key: 'errors.enterKey' } };
  const parts = text.split(/\s+/);
  if (parts.length > MAX_SEQUENCE_LENGTH) {
    return { ok: false, error: { key: 'errors.maxKeys', args: { n: MAX_SEQUENCE_LENGTH } } };
  }
  const chords: Chord[] = [];
  for (const part of parts) {
    const chord = parseChord(part, mode);
    if ('error' in chord) return { ok: false, error: chord.error };
    chords.push(chord);
  }
  return { ok: true, chords };
}

type ChordResult = Chord | { error: Text };

function parseChord(text: string, mode: KeyMode): ChordResult {
  const pieces = text.split('+');
  const keyText = pieces.pop() ?? '';
  const chord: Chord = { mod: false, ctrl: false, alt: false, shift: false, meta: false, key: '' };
  for (const piece of pieces) {
    const modifier = MODIFIER_ALIASES.get(piece.toLowerCase());
    if (modifier === undefined) {
      return { error: piece === '' ? { key: 'errors.writePlus' } : { key: 'errors.notModifier', args: { piece } } };
    }
    if (chord[modifier]) return { error: { key: 'errors.twice', args: { piece, text } } };
    chord[modifier] = true;
  }
  if (keyText === '') return { error: { key: 'errors.addKey' } };
  if (MODIFIER_ALIASES.has(keyText.toLowerCase())) return { error: { key: 'errors.modifiersOnly' } };
  return mode === 'key' ? finishKeyChord(chord, keyText) : finishCodeChord(chord, keyText);
}

const SHIFTED_CHARACTER: { error: Text } = { error: { key: 'errors.shiftedChar' } };

function finishKeyChord(chord: Chord, keyText: string): ChordResult {
  const named = namedKey(keyText);
  // "plus" is the character "+", spelled out because "+" joins modifiers. Shift already made it.
  if (named === 'plus') return chord.shift ? SHIFTED_CHARACTER : { ...chord, key: named };
  if (named !== undefined) return { ...chord, key: named };
  if (!isPrintable(keyText)) return { error: { key: 'errors.unknownKey', args: { key: keyText } } };
  if (isCased(keyText)) {
    if (chord.mod || chord.ctrl || chord.alt || chord.meta) return { ...chord, key: keyText.toLowerCase() };
    return { ...chord, shift: false, key: chord.shift ? keyText.toUpperCase() : keyText };
  }
  if (chord.shift) return SHIFTED_CHARACTER;
  return { ...chord, key: keyText };
}

function finishCodeChord(chord: Chord, keyText: string): ChordResult {
  if (!CODE_NAME.test(keyText) || MODIFIER_CODES.has(keyText)) {
    return { error: { key: 'errors.notCode', args: { key: keyText } } };
  }
  return { ...chord, key: keyText };
}

/** The canonical stored form of a chord: "mod+shift+k". */
export function chordText(chord: Chord): string {
  const parts: string[] = [];
  if (chord.mod) parts.push('mod');
  if (chord.ctrl) parts.push('ctrl');
  if (chord.alt) parts.push('alt');
  if (chord.shift) parts.push('shift');
  if (chord.meta) parts.push('meta');
  parts.push(chord.key);
  return parts.join('+');
}

/** The canonical stored form of a sequence, or null when it doesn't parse. */
export function canonicalKeys(keys: string, mode: KeyMode): string | null {
  const parsed = parseKeys(keys, mode);
  return parsed.ok ? parsed.chords.map(chordText).join(' ') : null;
}

/** A match token: a chord with `mod` resolved for the platform and modifiers in a fixed order. */
export function tokenOf(mods: Modifiers, key: string): string {
  let token = '';
  if (mods.ctrl) token += 'ctrl+';
  if (mods.alt) token += 'alt+';
  if (mods.shift) token += 'shift+';
  if (mods.meta) token += 'meta+';
  return token + key;
}

/** The modifiers a chord holds on this platform: `mod` becomes Meta on macOS and Ctrl elsewhere. */
export function resolveMod(chord: Chord, isMac: boolean): Modifiers {
  return {
    ctrl: chord.ctrl || (chord.mod && !isMac),
    alt: chord.alt,
    shift: chord.shift,
    meta: chord.meta || (chord.mod && isMac),
  };
}

/** Match tokens for a shortcut's keys, or null when they don't parse. */
export function sequenceTokens(keys: string, mode: KeyMode, isMac: boolean): string[] | null {
  const parsed = parseKeys(keys, mode);
  return parsed.ok ? parsed.chords.map((chord) => tokenOf(resolveMod(chord, isMac), chord.key)) : null;
}

const MAC_MODIFIERS: Record<keyof Modifiers, string> = { ctrl: '⌃', alt: '⌥', shift: '⇧', meta: '⌘' };
const PC_MODIFIERS: Record<keyof Modifiers, Text> = {
  ctrl: { key: 'keys.ctrl' },
  alt: { key: 'keys.alt' },
  shift: { key: 'keys.shift' },
  meta: { key: 'keys.meta' },
};

/** A keycap: a symbol or letter, the same in every language, or a key's name, which is a message. */
export type KeyCap = string | Text;

const KEY_LABELS = new Map<string, KeyCap>([
  ['up', '↑'],
  ['down', '↓'],
  ['left', '←'],
  ['right', '→'],
  ['enter', { key: 'keys.enter' }],
  ['escape', { key: 'keys.esc' }],
  ['tab', { key: 'keys.tab' }],
  ['space', { key: 'keys.space' }],
  ['backspace', { key: 'keys.backspace' }],
  ['delete', { key: 'keys.delete' }],
  ['insert', { key: 'keys.insert' }],
  ['home', { key: 'keys.home' }],
  ['end', { key: 'keys.end' }],
  ['pageup', { key: 'keys.pageUp' }],
  ['pagedown', { key: 'keys.pageDown' }],
  ['plus', '+'],
]);

const CODE_LABELS = new Map<string, KeyCap>([
  ['Backquote', '`'],
  ['Minus', '-'],
  ['Equal', '='],
  ['BracketLeft', '['],
  ['BracketRight', ']'],
  ['Backslash', '\\'],
  ['Semicolon', ';'],
  ['Quote', "'"],
  ['Comma', ','],
  ['Period', '.'],
  ['Slash', '/'],
  ['Space', { key: 'keys.space' }],
  ['Escape', { key: 'keys.esc' }],
  ['ArrowUp', '↑'],
  ['ArrowDown', '↓'],
  ['ArrowLeft', '←'],
  ['ArrowRight', '→'],
]);

/**
 * Keycap labels for display: one array per chord, modifiers first. macOS uses its symbols in Apple's order
 * (⌃ ⌥ ⇧ ⌘); other platforms use names. A capital letter shows the Shift it takes: keyboards print their letters as
 * capitals, so a bare G would read as the g key.
 */
export function keycapLabels(keys: string, mode: KeyMode, isMac: boolean): KeyCap[][] | null {
  const parsed = parseKeys(keys, mode);
  if (!parsed.ok) return null;
  const names: Record<keyof Modifiers, KeyCap> = isMac ? MAC_MODIFIERS : PC_MODIFIERS;
  return parsed.chords.map((chord) => {
    const mods = resolveMod(chord, isMac);
    const command = mods.ctrl || mods.alt || mods.meta;
    const held = { ...mods, shift: mods.shift || (mode === 'key' && !command && isCapital(chord.key)) };
    const labels = (['ctrl', 'alt', 'shift', 'meta'] as const).filter((name) => held[name]).map((name) => names[name]);
    labels.push(keyLabel(chord.key, mode, command));
    return labels;
  });
}

/** A single letter written as a capital, which in key mode means Shift is held. */
function isCapital(key: string): boolean {
  return Array.from(key).length === 1 && key !== key.toLowerCase();
}

/**
 * Keycap labels for a browser command's shortcut, as `commands.getAll()` writes it: "⌥⇧K" on macOS, and "Alt+Shift+K"
 * elsewhere, with the modifiers named in the browser's language. The text shows which form it is in, so this reads
 * the form rather than guess the platform. Empty when the command has no key.
 */
export function commandKeycaps(shortcut: string): string[] {
  const symbols: readonly string[] = Object.values(MAC_MODIFIERS);
  if (!symbols.includes(shortcut.charAt(0))) return shortcut.split('+').filter((label) => label !== '');
  // The modifier symbols come first, one character each.
  const labels: string[] = [];
  let rest = shortcut;
  while (symbols.includes(rest.charAt(0))) {
    labels.push(rest.charAt(0));
    rest = rest.slice(1);
  }
  return rest === '' ? labels : [...labels, rest];
}

function keyLabel(key: string, mode: KeyMode, withCommandModifier: boolean): KeyCap {
  if (mode === 'code') {
    const label = CODE_LABELS.get(key);
    if (label !== undefined) return label;
    const match = /^(?:Key|Digit)(.)$/.exec(key) ?? /^Numpad(.+)$/.exec(key);
    if (match?.[1] === undefined) return key;
    return key.startsWith('Numpad') ? { key: 'keys.numpad', args: { n: match[1] } } : match[1];
  }
  const label = KEY_LABELS.get(key);
  if (label !== undefined) return label;
  // Shortcuts with Ctrl, Alt or Cmd are conventionally written with a capital letter: Ctrl K, ⌘K.
  return /^f\d+$/.test(key) || withCommandModifier ? key.toUpperCase() : key;
}
