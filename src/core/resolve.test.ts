import { describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUTS } from './defaults';
import { resolve } from './resolve';
import type { Shortcut } from './schema';

function shortcut(id: string, keys: string, source: Shortcut['source'], site = false): Shortcut {
  return {
    id,
    keys,
    keyMode: 'key',
    action: { type: 'scroll', direction: 'down' },
    scope: site ? { type: 'site', match: '*://example.com/*' } : { type: 'global' },
    label: id,
    source,
    enabled: true,
  };
}

const ids = (list: readonly Shortcut[]): string[] => list.map((s) => s.id);

describe('resolve', () => {
  it('keeps every default active', () => {
    const { active, shadowed } = resolve({ shortcuts: DEFAULT_SHORTCUTS, isMac: false });
    expect(ids(active)).toEqual(ids(DEFAULT_SHORTCUTS));
    expect(shadowed).toEqual([]);
  });

  it('drops disabled shortcuts', () => {
    const disabled = { ...shortcut('off', 'j', 'default'), enabled: false };
    expect(resolve({ shortcuts: [disabled], isMac: false }).active).toEqual([]);
  });

  it('lets the higher precedence win identical keys: user site > user global > preset > default', () => {
    const list = [
      shortcut('default', 'j', 'default'),
      shortcut('preset', 'j', 'preset'),
      shortcut('global', 'j', 'user'),
      shortcut('site', 'j', 'user', true),
    ];
    const { active, shadowed } = resolve({ shortcuts: list, isMac: false });
    expect(ids(active)).toEqual(['site']);
    expect(shadowed.map((s) => [s.shortcut.id, s.by.id])).toEqual([
      ['global', 'site'],
      ['preset', 'site'],
      ['default', 'site'],
    ]);
  });

  it('keeps the first of two identical shortcuts at the same rank', () => {
    const { active } = resolve({ shortcuts: [shortcut('a', 'j', 'user'), shortcut('b', 'j', 'user')], isMac: false });
    expect(ids(active)).toEqual(['a']);
  });

  it('lets a higher-precedence key shadow lower-precedence sequences that start with it', () => {
    const list = [shortcut('preset-ge', 'g e', 'preset'), shortcut('user-g', 'g', 'user')];
    const { active, shadowed } = resolve({ shortcuts: list, isMac: false });
    expect(ids(active)).toEqual(['user-g']);
    expect(shadowed[0]?.shortcut.id).toBe('preset-ge');
  });

  it('keeps a same-rank prefix and its longer sequence both active', () => {
    const list = [shortcut('g', 'g', 'user'), shortcut('gi', 'g i', 'user')];
    expect(ids(resolve({ shortcuts: list, isMac: false }).active)).toEqual(['g', 'gi']);
  });

  it('compares keys after resolving mod for the platform', () => {
    const list = [shortcut('mod', 'mod+k', 'user'), shortcut('ctrl', 'ctrl+k', 'default')];
    expect(ids(resolve({ shortcuts: list, isMac: false }).active)).toEqual(['mod']);
    expect(ids(resolve({ shortcuts: list, isMac: true }).active)).toEqual(['mod', 'ctrl']);
  });
});
