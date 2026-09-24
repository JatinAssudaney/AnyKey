import { describe, expect, it } from 'vitest';
import { canonicalKeys, commandKeycaps, keycapLabels, keysInWords, parseKeys, sequenceTokens } from './keys';

describe('parseKeys', () => {
  it.each([
    ['j', 'j'],
    ['G', 'G'],
    ['shift+g', 'G'],
    ['shift+G', 'G'],
    ['?', '?'],
    ['g g', 'g g'],
    ['  g   i  ', 'g i'],
    ['ctrl+shift+k', 'ctrl+shift+k'],
    ['Ctrl+K', 'ctrl+k'],
    ['shift+ctrl+K', 'ctrl+shift+k'],
    ['cmd+option+k', 'alt+meta+k'],
    ['mod+k', 'mod+k'],
    ['ArrowDown', 'down'],
    ['shift+tab', 'shift+tab'],
    ['esc', 'escape'],
    ['ctrl+plus', 'ctrl+plus'],
    ['ctrl+-', 'ctrl+-'],
    ['F5', 'f5'],
    ['é', 'é'],
    ['shift+é', 'É'],
  ])('reads %j as %j', (input, expected) => {
    expect(canonicalKeys(input, 'key')).toBe(expected);
  });

  it.each([
    ['', 'Enter a key.'],
    ['a b c d e', 'at most 4'],
    ['ctrl+', 'Add a key'],
    ['ctrl++', 'plus'],
    ['hyper+k', 'not a modifier'],
    ['ctrl+ctrl+k', 'appears twice'],
    ['ctrl+shift', 'besides the modifiers'],
    ['shift+/', 'write the character itself'],
    ['shift+1', 'write the character itself'],
    ['Enterr', 'Unknown key'],
  ])('rejects %j', (input, message) => {
    const parsed = parseKeys(input, 'key');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain(message);
  });

  it('takes physical key codes in code mode', () => {
    expect(canonicalKeys('alt+KeyK', 'code')).toBe('alt+KeyK');
    expect(canonicalKeys('shift+Slash', 'code')).toBe('shift+Slash');
    expect(canonicalKeys('k', 'code')).toBeNull();
    expect(canonicalKeys('ShiftLeft', 'code')).toBeNull();
  });
});

describe('sequenceTokens', () => {
  it('resolves mod to Cmd on macOS and Ctrl elsewhere', () => {
    expect(sequenceTokens('mod+k', 'key', true)).toEqual(['meta+k']);
    expect(sequenceTokens('mod+k', 'key', false)).toEqual(['ctrl+k']);
    expect(sequenceTokens('mod+shift+p g', 'key', false)).toEqual(['ctrl+shift+p', 'g']);
  });

  it('returns null for keys that do not parse', () => {
    expect(sequenceTokens('shift+/', 'key', false)).toBeNull();
  });
});

describe('keycapLabels', () => {
  it('uses symbols in Apple order on macOS', () => {
    expect(keycapLabels('ctrl+alt+shift+meta+k', 'key', true)).toEqual([['⌃', '⌥', '⇧', '⌘', 'K']]);
    expect(keycapLabels('mod+k', 'key', true)).toEqual([['⌘', 'K']]);
  });

  it('uses names elsewhere', () => {
    expect(keycapLabels('mod+shift+k', 'key', false)).toEqual([['Ctrl', 'Shift', 'K']]);
  });

  it('keeps plain letters as typed and names special keys', () => {
    expect(keycapLabels('g g', 'key', false)).toEqual([['g'], ['g']]);
    expect(keycapLabels('shift+down', 'key', false)).toEqual([['Shift', '↓']]);
    expect(keycapLabels('f5', 'key', false)).toEqual([['F5']]);
  });

  it('shows the Shift a capital letter takes, and none for other characters', () => {
    expect(keycapLabels('G', 'key', false)).toEqual([['Shift', 'G']]);
    expect(keycapLabels('g F', 'key', true)).toEqual([['g'], ['⇧', 'F']]);
    expect(keycapLabels('É', 'key', false)).toEqual([['Shift', 'É']]);
    expect(keycapLabels('ctrl+shift+k', 'key', false)).toEqual([['Ctrl', 'Shift', 'K']]);
    expect(keycapLabels('?', 'key', false)).toEqual([['?']]);
    expect(keycapLabels('shift+KeyG', 'code', false)).toEqual([['Shift', 'G']]);
  });

  it('shows physical keys by their US-layout character', () => {
    expect(keycapLabels('alt+KeyK', 'code', false)).toEqual([['Alt', 'K']]);
    expect(keycapLabels('Digit1 BracketLeft Numpad4', 'code', false)).toEqual([['1'], ['['], ['Num 4']]);
  });
});

describe('keysInWords', () => {
  it('joins chords with "then", and keys within a chord as each platform writes them', () => {
    expect(keysInWords('g s', 'key', false)).toBe('g then s');
    expect(keysInWords('mod+shift+k', 'key', false)).toBe('Ctrl+Shift+K');
    expect(keysInWords('mod+shift+k', 'key', true)).toBe('⇧⌘K');
    expect(keysInWords('?', 'key', true)).toBe('?');
    expect(keysInWords('F', 'key', true)).toBe('⇧F');
    expect(keysInWords('F', 'key', false)).toBe('Shift+F');
  });

  it('says nothing for notation that does not parse', () => {
    expect(keysInWords('shift+/', 'key', false)).toBe('');
  });
});

describe('commandKeycaps', () => {
  it("splits a browser command's shortcut into keycaps, as each platform writes it", () => {
    expect(commandKeycaps('⌥⇧K', true)).toEqual(['⌥', '⇧', 'K']);
    expect(commandKeycaps('⇧⌘Space', true)).toEqual(['⇧', '⌘', 'Space']);
    expect(commandKeycaps('Alt+Shift+K', false)).toEqual(['Alt', 'Shift', 'K']);
    expect(commandKeycaps('Strg+Umschalt+K', false)).toEqual(['Strg', 'Umschalt', 'K']);
  });

  it('gives no keycaps when the command has no key', () => {
    expect(commandKeycaps('', true)).toEqual([]);
    expect(commandKeycaps('', false)).toEqual([]);
  });
});
