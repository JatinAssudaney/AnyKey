import { describe, expect, it } from 'vitest';
import { codeToken, eventChord, isModifierOnly, keyToken, type KeyInput } from './keyEvent';
import { chordText, sequenceTokens } from './keys';

function press(key: string, code: string, mods: Partial<KeyInput> = {}): KeyInput {
  return { key, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, altGraph: false, ...mods };
}

describe('keyToken', () => {
  it('reads plain and shifted characters', () => {
    expect(keyToken(press('j', 'KeyJ'), false)).toBe('j');
    expect(keyToken(press('G', 'KeyG', { shiftKey: true }), false)).toBe('G');
    expect(keyToken(press('?', 'Slash', { shiftKey: true }), false)).toBe('?');
  });

  it('ignores Caps Lock: letter case follows Shift', () => {
    // Caps Lock on, no Shift: the browser reports "J".
    expect(keyToken(press('J', 'KeyJ'), false)).toBe('j');
    // Caps Lock on with Shift: Windows reports "j".
    expect(keyToken(press('j', 'KeyJ', { shiftKey: true }), false)).toBe('J');
  });

  it('lowercases letters and keeps Shift explicit next to Ctrl, Alt or Meta', () => {
    expect(keyToken(press('K', 'KeyK', { ctrlKey: true, shiftKey: true }), false)).toBe('ctrl+shift+k');
    expect(keyToken(press('k', 'KeyK', { metaKey: true }), true)).toBe('meta+k');
  });

  it('reads macOS Option chords from the physical key', () => {
    expect(keyToken(press('˚', 'KeyK', { altKey: true }), true)).toBe('alt+k');
    expect(keyToken(press('', 'KeyK', { altKey: true, shiftKey: true }), true)).toBe('alt+shift+k');
    expect(keyToken(press('÷', 'Slash', { altKey: true }), true)).toBe('alt+/');
    expect(keyToken(press('¿', 'Slash', { altKey: true, shiftKey: true }), true)).toBe('alt+?');
    expect(keyToken(press('Dead', 'KeyE', { altKey: true }), true)).toBe('alt+e');
  });

  it('drops the Ctrl+Alt that AltGr reports while typing a character', () => {
    expect(keyToken(press('@', 'KeyQ', { ctrlKey: true, altKey: true, altGraph: true }), false)).toBe('@');
  });

  it('names special keys and keeps Shift on them', () => {
    expect(keyToken(press('ArrowDown', 'ArrowDown'), false)).toBe('down');
    expect(keyToken(press('Tab', 'Tab', { shiftKey: true }), false)).toBe('shift+tab');
    expect(keyToken(press(' ', 'Space'), false)).toBe('space');
    expect(keyToken(press('+', 'Equal', { shiftKey: true }), false)).toBe('plus');
    expect(keyToken(press('Escape', 'Escape'), false)).toBe('escape');
  });

  it('returns null for keys that cannot be shortcuts', () => {
    expect(keyToken(press('Shift', 'ShiftLeft', { shiftKey: true }), false)).toBeNull();
    expect(keyToken(press('Dead', 'BracketLeft'), false)).toBeNull();
    expect(keyToken(press('Process', 'KeyA'), false)).toBeNull();
    expect(keyToken(press('Unidentified', ''), false)).toBeNull();
    expect(keyToken(press('MediaPlayPause', 'MediaPlayPause'), false)).toBeNull();
  });

  it('produces the same tokens as parsed shortcut notation', () => {
    const cases: [string, KeyInput, boolean][] = [
      ['G', press('G', 'KeyG', { shiftKey: true }), false],
      ['ctrl+shift+k', press('K', 'KeyK', { ctrlKey: true, shiftKey: true }), false],
      ['mod+k', press('k', 'KeyK', { metaKey: true }), true],
      ['mod+k', press('k', 'KeyK', { ctrlKey: true }), false],
      ['alt+k', press('˚', 'KeyK', { altKey: true }), true],
      ['shift+space', press(' ', 'Space', { shiftKey: true }), false],
    ];
    for (const [notation, input, isMac] of cases) {
      expect(keyToken(input, isMac)).toBe(sequenceTokens(notation, 'key', isMac)?.[0]);
    }
  });
});

describe('codeToken', () => {
  it('uses the physical key and every held modifier', () => {
    expect(codeToken(press('˚', 'KeyK', { altKey: true }))).toBe('alt+KeyK');
    expect(codeToken(press('?', 'Slash', { shiftKey: true }))).toBe('shift+Slash');
    expect(sequenceTokens('shift+Slash', 'code', false)).toEqual(['shift+Slash']);
  });

  it('returns null for modifiers and missing codes', () => {
    expect(codeToken(press('Control', 'ControlLeft', { ctrlKey: true }))).toBeNull();
    expect(codeToken(press('a', ''))).toBeNull();
  });
});

describe('isModifierOnly', () => {
  it('covers modifier and lock keys', () => {
    expect(isModifierOnly(press('Meta', 'MetaLeft'))).toBe(true);
    expect(isModifierOnly(press('CapsLock', 'CapsLock'))).toBe(true);
    expect(isModifierOnly(press('AltGraph', 'AltRight'))).toBe(true);
    expect(isModifierOnly(press('a', 'KeyA'))).toBe(false);
  });
});

describe('eventChord', () => {
  const text = (input: KeyInput, mode: 'key' | 'code', isMac = false): string | null => {
    const chord = eventChord(input, mode, isMac);
    return chord === null ? null : chordText(chord);
  };

  it('writes the notation that parseKeys reads back', () => {
    expect(text(press('G', 'KeyG', { shiftKey: true }), 'key')).toBe('G');
    expect(text(press('K', 'KeyK', { ctrlKey: true, shiftKey: true }), 'key')).toBe('ctrl+shift+k');
    expect(text(press('+', 'Equal', { shiftKey: true }), 'key')).toBe('plus');
    expect(text(press('Tab', 'Tab', { shiftKey: true }), 'key')).toBe('shift+tab');
    expect(text(press('?', 'Slash', { shiftKey: true }), 'code')).toBe('shift+Slash');
  });

  it('returns null for keys that cannot be part of a shortcut', () => {
    expect(eventChord(press('Shift', 'ShiftLeft', { shiftKey: true }), 'key', false)).toBeNull();
    expect(eventChord(press('Dead', 'Quote'), 'key', false)).toBeNull();
    expect(eventChord(press('Process', ''), 'code', false)).toBeNull();
  });
});
