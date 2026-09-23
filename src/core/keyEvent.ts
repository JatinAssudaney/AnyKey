import { CODE_NAME, isCased, isPrintable, MODIFIER_CODES, namedKey, tokenOf } from './keys';

/** The KeyboardEvent fields shortcuts depend on. `altGraph` is `event.getModifierState('AltGraph')`. */
export interface KeyInput {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  altGraph: boolean;
}

const MODIFIER_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'AltGraph',
  'Meta',
  'OS',
  'Super',
  'Hyper',
  'Fn',
  'FnLock',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Symbol',
  'SymbolLock',
]);

/** Pressing Shift on its way to "G" must not break a sequence, so modifier and lock keys are ignored entirely. */
export function isModifierOnly(input: Pick<KeyInput, 'key' | 'code'>): boolean {
  return MODIFIER_KEYS.has(input.key) || MODIFIER_CODES.has(input.code);
}

/** US-layout characters by physical key, unshifted then shifted. Letters are handled separately. */
const US_LAYOUT = new Map<string, readonly [string, string]>([
  ['Backquote', ['`', '~']],
  ['Digit1', ['1', '!']],
  ['Digit2', ['2', '@']],
  ['Digit3', ['3', '#']],
  ['Digit4', ['4', '$']],
  ['Digit5', ['5', '%']],
  ['Digit6', ['6', '^']],
  ['Digit7', ['7', '&']],
  ['Digit8', ['8', '*']],
  ['Digit9', ['9', '(']],
  ['Digit0', ['0', ')']],
  ['Minus', ['-', '_']],
  ['Equal', ['=', '+']],
  ['BracketLeft', ['[', '{']],
  ['BracketRight', [']', '}']],
  ['Backslash', ['\\', '|']],
  ['Semicolon', [';', ':']],
  ['Quote', ["'", '"']],
  ['Comma', [',', '<']],
  ['Period', ['.', '>']],
  ['Slash', ['/', '?']],
  ['Space', [' ', ' ']],
]);

function usLayoutChar(code: string, shift: boolean): string | undefined {
  const letter = /^Key([A-Z])$/.exec(code)?.[1];
  if (letter !== undefined) return shift ? letter : letter.toLowerCase();
  return US_LAYOUT.get(code)?.[shift ? 1 : 0];
}

/**
 * The key-mode match token for a keydown, or null when it can't be part of a shortcut (modifier-only, dead keys,
 * IME processing, media keys). Mirrors the notation rules in `parseKeys`.
 */
export function keyToken(input: KeyInput, isMac: boolean): string | null {
  if (isModifierOnly(input)) return null;
  // AltGr reports Ctrl+Alt on Windows while typing characters such as "@"; the character already reflects it.
  const ctrl = input.ctrlKey && !input.altGraph;
  const alt = input.altKey && !input.altGraph;
  const mods = { ctrl, alt, shift: input.shiftKey, meta: input.metaKey };
  // macOS Option turns letters into symbols (Option+K types "˚"), so Option chords use the US-layout character.
  const key = isMac && alt ? (usLayoutChar(input.code, input.shiftKey) ?? input.key) : input.key;

  const named = namedKey(key);
  // Named keys keep Shift (Shift+Tab), except "plus": the "+" character, which Shift already produced.
  if (named !== undefined) return tokenOf(named === 'plus' ? { ...mods, shift: false } : mods, named);
  if (!isPrintable(key)) return null;
  if (isCased(key)) {
    if (ctrl || alt || input.metaKey) return tokenOf(mods, key.toLowerCase());
    // Letter case follows Shift, so Caps Lock never changes which shortcut a letter triggers.
    return tokenOf({ ...mods, shift: false }, input.shiftKey ? key.toUpperCase() : key.toLowerCase());
  }
  return tokenOf({ ...mods, shift: false }, key);
}

/** The code-mode match token for a keydown: the physical key plus every held modifier. */
export function codeToken(input: KeyInput): string | null {
  if (isModifierOnly(input) || !CODE_NAME.test(input.code)) return null;
  return tokenOf({ ctrl: input.ctrlKey, alt: input.altKey, shift: input.shiftKey, meta: input.metaKey }, input.code);
}
