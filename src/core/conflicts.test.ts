import { describe, expect, it } from 'vitest';
import { findConflicts } from './conflicts';
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
});
