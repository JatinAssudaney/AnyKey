import { describe, expect, it } from 'vitest';
import { describeConflicts, findConflicts, nativeKeysLeft } from './conflicts';
import type { NativeKey } from './resolve';
import type { Shortcut } from './schema';

function shortcut(id: string, keys: string, extra: Partial<Shortcut> = {}): Shortcut {
  return {
    id,
    keys,
    keyMode: 'key',
    action: { type: 'scroll', direction: 'down' },
    scope: { type: 'global' },
    label: id,
    source: 'user',
    enabled: true,
    ...extra,
  };
}

const kinds = (conflicts: Map<string, { kind: string }[]>, id: string): string[] =>
  (conflicts.get(id) ?? []).map((c) => c.kind);

describe('findConflicts', () => {
  it('reports both sides of a shadowed shortcut', () => {
    const builtIn = shortcut('default:j', 'j', { source: 'default' });
    const mine = shortcut('user:j', 'j');
    const conflicts = findConflicts([builtIn, mine], false);
    expect(conflicts.get('default:j')).toEqual([{ kind: 'shadowed', by: mine }]);
    expect(conflicts.get('user:j')).toEqual([{ kind: 'shadows', other: builtIn }]);
  });

  it('ignores disabled shortcuts', () => {
    const conflicts = findConflicts(
      [shortcut('default:j', 'j', { source: 'default' }), shortcut('user:j', 'j', { enabled: false })],
      false,
    );
    expect(conflicts.size).toBe(0);
  });

  it('warns that a key waits when a longer shortcut of the same rank starts with it', () => {
    const conflicts = findConflicts([shortcut('g', 'g'), shortcut('gi', 'g i'), shortcut('code', 'KeyG', { keyMode: 'code' })], false);
    expect(kinds(conflicts, 'g')).toEqual(['waits']);
    expect(kinds(conflicts, 'gi')).toEqual([]);
    expect(kinds(conflicts, 'code')).toEqual([]);
  });

  it("flags keys the browser keeps, for the platform's command key", () => {
    const list = [shortcut('mod-t', 'mod+t'), shortcut('code', 'mod+KeyW', { keyMode: 'code' })];
    expect(kinds(findConflicts(list, false), 'mod-t')).toEqual(['reserved']);
    expect(kinds(findConflicts(list, false), 'code')).toEqual(['reserved']);
    expect(kinds(findConflicts(list, true), 'mod-t')).toEqual(['reserved']);
    // Ctrl+T reaches pages on macOS, where the browser uses Cmd+T.
    expect(findConflicts([shortcut('ctrl-t', 'ctrl+t')], true).size).toBe(0);
    expect(kinds(findConflicts([shortcut('ctrl-t', 'ctrl+t')], false), 'ctrl-t')).toEqual(['reserved']);
  });

  it('flags keys that type text when a shortcut also runs in text fields', () => {
    const conflicts = findConflicts(
      [
        shortcut('letter', 'n', { allowInInputs: true }),
        shortcut('ctrl', 'ctrl+j', { allowInInputs: true }),
        shortcut('escape', 'escape', { allowInInputs: true }),
        shortcut('f2', 'f2', { allowInInputs: true }),
        shortcut('outside', 'm'),
      ],
      false,
    );
    expect(kinds(conflicts, 'letter')).toEqual(['typing']);
    expect(conflicts.has('ctrl')).toBe(false);
    expect(conflicts.has('escape')).toBe(false);
    expect(conflicts.has('f2')).toBe(false);
    expect(conflicts.has('outside')).toBe(false);
  });

  describe("with the site's own keys", () => {
    const search: NativeKey = { keys: 's', label: 'Focus the search bar', site: 'GitHub' };
    const code: NativeKey = { keys: 'g c', label: 'Go to the Code tab', site: 'GitHub' };
    const palette: NativeKey = { keys: 'mod+k', label: 'Open the command palette', site: 'GitHub' };

    it("flags a shortcut that takes the site's keys, or the first of them", () => {
      const list = [shortcut('s', 's'), shortcut('g', 'g'), shortcut('ctrl-k', 'ctrl+k')];
      const conflicts = findConflicts(list, false, [search, code, palette]);
      expect(conflicts.get('s')).toEqual([{ kind: 'takesNative', native: search }]);
      expect(conflicts.get('g')).toEqual([{ kind: 'takesNative', native: code }]);
      expect(kinds(conflicts, 'ctrl-k')).toEqual(['takesNative']);
      // mod+k is Cmd+K on a Mac, which Ctrl+K doesn't take.
      expect(kinds(findConflicts(list, true, [palette]), 'ctrl-k')).toEqual([]);
      expect(describeConflicts([{ kind: 'takesNative', native: search }])).toEqual([
        'GitHub\'s own "Focus the search bar" doesn\'t run, because this shortcut takes its keys.',
      ]);
    });

    it("flags a sequence that starts with the site's key, unless AnyKey takes that key", () => {
      const conflicts = findConflicts([shortcut('sx', 's x'), shortcut('ge', 'g e')], false, [search, code]);
      expect(conflicts.get('sx')).toEqual([{ kind: 'afterNative', native: search }]);
      // Sequences that only share a first key with the site's pass that key on, so both work.
      expect(conflicts.has('ge')).toBe(false);
      const taken = findConflicts([shortcut('s', 's'), shortcut('sx', 's x')], false, [search]);
      expect(kinds(taken, 'sx')).toEqual([]);
    });

    it('leaves a key to the site where a built-in shortcut gives way to it', () => {
      const graph: NativeKey = { keys: 'j', label: 'Scroll the graph down', site: 'GitHub', yieldedBy: ['default:j'] };
      const list = [shortcut('default:j', 'j', { source: 'default' }), shortcut('jx', 'j x')];
      const conflicts = findConflicts(list, false, [graph]);
      expect(kinds(conflicts, 'default:j')).toEqual(['waits']);
      expect(conflicts.get('jx')).toEqual([{ kind: 'afterNative', native: graph }]);
    });

    it('leaves out shortcuts that are off, and physical-key shortcuts', () => {
      const list = [shortcut('off', 's', { enabled: false }), shortcut('code', 'KeyS', { keyMode: 'code' })];
      expect(findConflicts(list, false, [search]).size).toBe(0);
    });

    it("words the site's keys a shortcut clashes with in one line per site and kind", () => {
      const finder: NativeKey = { keys: 't', label: 'Open the file finder', site: 'GitHub' };
      const files: NativeKey = { keys: 't', label: 'Filter the changed files', site: 'GitHub' };
      const logs: NativeKey = { keys: 't', label: 'Show or hide timestamps in logs', site: 'GitHub' };
      const lines = describeConflicts([
        { kind: 'takesNative', native: finder },
        { kind: 'reserved' },
        { kind: 'takesNative', native: files },
        { kind: 'afterNative', native: search },
        { kind: 'takesNative', native: logs },
      ]);
      expect(lines).toEqual([
        'GitHub\'s own "Open the file finder", "Filter the changed files" and "Show or hide timestamps in logs" don\'t run, because this shortcut takes their keys.',
        'The browser keeps these keys for itself, so this shortcut never runs.',
        'GitHub\'s own "Focus the search bar" runs first, which can stop this shortcut.',
      ]);
    });

    it('lists the keys that still reach the site', () => {
      const active = [shortcut('g', 'g'), shortcut('sx', 's x')];
      expect(nativeKeysLeft([search, code, palette], active, false)).toEqual([search, palette]);
    });
  });
});
