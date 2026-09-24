import { describe, expect, it } from 'vitest';
import { parseSync, type SyncData } from '../core/docs';
import type { Mutation } from '../core/messages';
import type { Shortcut } from '../core/schema';
import { applyMutation, restoreItems, type MutationResult } from './mutations';

function mine(id: string, keys: string, extra: Partial<Shortcut> = {}): Shortcut {
  return {
    id,
    keys,
    keyMode: 'key',
    action: { type: 'scroll', direction: 'down' },
    scope: { type: 'global' },
    label: 'Mine',
    source: 'user',
    enabled: true,
    ...extra,
  };
}

function onSite(id: string, keys: string, match = '*://github.com/*'): Shortcut {
  return mine(id, keys, {
    action: { type: 'click', target: { selector: '[data-testid="star"]', text: 'Star' } },
    scope: { type: 'site', match },
  });
}

function ok(result: MutationResult): Extract<MutationResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected success, got: ${result.error}`);
  return result;
}

function error(result: MutationResult): string {
  if (result.ok) throw new Error('Expected a failure');
  return result.error;
}

/** Applies mutations in turn, as the writer does. */
function run(items: Record<string, unknown>, ...mutations: Mutation[]): SyncData {
  return mutations.reduce((data, mutation) => ok(applyMutation(data, mutation)).data, parseSync(items));
}

describe('setSettings', () => {
  it('merges changes and leaves out values equal to the default', () => {
    const data = run({}, { op: 'setSettings', settings: { scrollStep: 90, smoothScroll: true } });
    expect(data.items.settings).toEqual({ v: 1, scrollStep: 90 });
  });

  it('removes the doc when every setting is back at its default', () => {
    const data = run({ settings: { v: 1, scrollStep: 90 } }, { op: 'setSettings', settings: { scrollStep: 60 } });
    expect(data.items).not.toHaveProperty('settings');
  });
});

describe('setDefault and resetDefault', () => {
  it('stores rekeyed defaults in canonical form', () => {
    const data = run({}, { op: 'setDefault', id: 'default:scroll-down', keys: 'CTRL+J' });
    expect(data.items.global).toEqual({ v: 1, shortcuts: [], overrides: { 'default:scroll-down': { keys: 'ctrl+j' } } });
  });

  it('stores only what differs from the built-in shortcut', () => {
    const off = run({}, { op: 'setDefault', id: 'default:tab-close', enabled: false });
    expect(off.state.global.overrides.get('default:tab-close')).toEqual({ enabled: false });
    const back = ok(applyMutation(off, { op: 'setDefault', id: 'default:tab-close', enabled: true, keys: 'x' })).data;
    expect(back.items).not.toHaveProperty('global');
  });

  it('keeps the keys with a changed key mode', () => {
    const data = run({}, { op: 'setDefault', id: 'default:scroll-down', keys: 'KeyJ', keyMode: 'code' });
    expect(data.state.global.overrides.get('default:scroll-down')).toEqual({ keys: 'KeyJ', keyMode: 'code' });
  });

  it('refuses unknown defaults and keys that do not parse', () => {
    const data = parseSync({});
    expect(error(applyMutation(data, { op: 'setDefault', id: 'default:nope', enabled: false }))).toMatch(/no built-in/);
    expect(error(applyMutation(data, { op: 'setDefault', id: 'default:scroll-down', keys: 'shift+/' }))).toMatch(/\?/);
    expect(error(applyMutation(data, { op: 'setDefault', id: 'default:scroll-down', keys: '' }))).toBe('Enter a key.');
  });

  it('resets a default by removing its override', () => {
    const data = run(
      {},
      { op: 'setDefault', id: 'default:scroll-down', keys: 'n' },
      { op: 'resetDefault', id: 'default:scroll-down' },
    );
    expect(data.items).not.toHaveProperty('global');
  });
});

describe('saveShortcut and deleteShortcut', () => {
  it('adds, then replaces by id, with canonical keys and a trimmed name', () => {
    const added = run({}, { op: 'saveShortcut', shortcut: mine('user:1', 'Ctrl+N', { label: '  Next  ' }) });
    expect(added.state.global.shortcuts).toEqual([mine('user:1', 'ctrl+n', { label: 'Next' })]);
    const replaced = ok(applyMutation(added, { op: 'saveShortcut', shortcut: mine('user:1', 'm') })).data;
    expect(replaced.state.global.shortcuts).toEqual([mine('user:1', 'm')]);
  });

  it('saves only user shortcuts, with a site exactly when the scope is a site', () => {
    const data = parseSync({});
    expect(applyMutation(data, { op: 'saveShortcut', shortcut: mine('default:scroll-down', 'n') }).ok).toBe(false);
    expect(applyMutation(data, { op: 'saveShortcut', shortcut: mine('user:1', 'n', { source: 'preset' }) }).ok).toBe(false);
    expect(error(applyMutation(data, { op: 'saveShortcut', shortcut: onSite('user:1', 'n') }))).toBe(
      'Choose the site this shortcut is for.',
    );
    expect(applyMutation(data, { op: 'saveShortcut', shortcut: mine('user:1', 'n'), site: 'github.com' }).ok).toBe(false);
    expect(error(applyMutation(data, { op: 'saveShortcut', shortcut: onSite('user:1', 'n'), site: 'Not a host' }))).toBe(
      'Enter a site such as github.com.',
    );
  });

  it('deletes by id, and does nothing for an unknown id', () => {
    const data = run({}, { op: 'saveShortcut', shortcut: mine('user:1', 'n') });
    expect(ok(applyMutation(data, { op: 'deleteShortcut', id: 'user:2' })).touched).toEqual([]);
    expect(ok(applyMutation(data, { op: 'deleteShortcut', id: 'user:1' })).data.items).not.toHaveProperty('global');
  });

  it('refuses a change that would pass the 8 KB item quota', () => {
    const long = (n: number) => mine(`user:${n}`, `ctrl+${n}`, { action: { type: 'navigate', url: `/${'x'.repeat(2000)}` } });
    const data = run({}, ...[1, 2, 3].map((n) => ({ op: 'saveShortcut', shortcut: long(n) }) as const));
    expect(error(applyMutation(data, { op: 'saveShortcut', shortcut: long(4) }))).toMatch(/8 KB/);
  });
});

describe('site shortcuts', () => {
  it("saves a site shortcut in its site's doc, and deletes it from there", () => {
    const data = run({}, { op: 'saveShortcut', shortcut: onSite('user:1', 'G S'), site: 'github.com' });
    expect(data.items).toEqual({ 'site:github.com': { v: 1, shortcuts: [onSite('user:1', 'G S')] } });
    expect(data.state.sites.get('github.com')?.shortcuts).toEqual([onSite('user:1', 'G S')]);
    const deleted = ok(applyMutation(data, { op: 'deleteShortcut', id: 'user:1' }));
    expect(deleted.touched).toEqual(['site:github.com']);
    expect(deleted.data.items).toEqual({});
    expect(deleted.data.state.sites.size).toBe(0);
  });

  it('moves a shortcut between docs when where it works changes, writing both', () => {
    const global = run({}, { op: 'saveShortcut', shortcut: mine('user:1', 'n') });
    const toSite = ok(applyMutation(global, { op: 'saveShortcut', shortcut: onSite('user:1', 'n'), site: 'github.com' }));
    expect(toSite.touched).toEqual(['site:github.com', 'global']);
    expect(toSite.data.items).toEqual({ 'site:github.com': { v: 1, shortcuts: [onSite('user:1', 'n')] } });

    const otherSite = onSite('user:1', 'n', '*://gitlab.com/*');
    const moved = ok(applyMutation(toSite.data, { op: 'saveShortcut', shortcut: otherSite, site: 'gitlab.com' }));
    expect(moved.touched).toEqual(['site:gitlab.com', 'site:github.com']);
    expect(moved.data.items).toEqual({ 'site:gitlab.com': { v: 1, shortcuts: [otherSite] } });

    const back = ok(applyMutation(moved.data, { op: 'saveShortcut', shortcut: mine('user:1', 'n') }));
    expect(back.touched).toEqual(['global', 'site:gitlab.com']);
    expect(back.data.items).toEqual({ global: { v: 1, shortcuts: [mine('user:1', 'n')], overrides: {} } });
  });

  it('keeps a site shortcut in place when it is edited', () => {
    const data = run(
      {},
      { op: 'saveShortcut', shortcut: onSite('user:1', 'a'), site: 'github.com' },
      { op: 'saveShortcut', shortcut: onSite('user:2', 'b'), site: 'github.com' },
      { op: 'saveShortcut', shortcut: onSite('user:1', 'c', '*://github.com/*/issues*'), site: 'github.com' },
    );
    expect(data.state.sites.get('github.com')?.shortcuts.map((s) => [s.id, s.keys])).toEqual([
      ['user:1', 'c'],
      ['user:2', 'b'],
    ]);
  });

  it('switches a site off and on, keeping nothing once the site is back to normal', () => {
    const off = run({}, { op: 'setSiteDisabled', site: 'www.youtube.com', disabled: true });
    expect(off.items).toEqual({ 'site:www.youtube.com': { v: 1, disabled: true, shortcuts: [] } });
    const on = ok(applyMutation(off, { op: 'setSiteDisabled', site: 'www.youtube.com', disabled: false }));
    expect(on.touched).toEqual(['site:www.youtube.com']);
    expect(on.data.items).toEqual({});
    expect(on.data.state.sites.size).toBe(0);
    expect(error(applyMutation(off, { op: 'setSiteDisabled', site: 'https://x.com', disabled: true }))).toBe(
      'Enter a site such as github.com.',
    );
  });

  it('keeps shortcuts when a site is switched off, and the switch when its last shortcut goes', () => {
    const data = run(
      {},
      { op: 'saveShortcut', shortcut: onSite('user:1', 'a'), site: 'github.com' },
      { op: 'setSiteDisabled', site: 'github.com', disabled: true },
      { op: 'deleteShortcut', id: 'user:1' },
    );
    expect(data.items).toEqual({ 'site:github.com': { v: 1, disabled: true, shortcuts: [] } });
  });

  it("refuses to move a shortcut out of, or into, a site doc that's damaged", () => {
    const damaged = { 'site:github.com': { v: 1, shortcuts: [onSite('user:1', 'a'), { id: 42 }] } };
    const data = parseSync(damaged);
    expect(error(applyMutation(data, { op: 'saveShortcut', shortcut: mine('user:1', 'a') }))).toMatch(/partly damaged/);
    expect(error(applyMutation(data, { op: 'deleteShortcut', id: 'user:1' }))).toMatch(/^Your shortcuts for github\.com are partly damaged/);
    expect(
      error(applyMutation(data, { op: 'saveShortcut', shortcut: onSite('user:2', 'b'), site: 'github.com' })),
    ).toMatch(/partly damaged/);
  });
});

describe('what a change writes reads back whole', () => {
  it('refuses keys that pass the length limit once stored in canonical form', () => {
    // 59 characters as typed, 79 once stored: "cmd+shift+pgdn" becomes "meta+shift+pagedown".
    const keys = Array.from({ length: 4 }, () => 'cmd+shift+pgdn').join(' ');
    const data = parseSync({});
    const tooLong = 'These keys are too long to save. Use fewer keys.';
    expect(error(applyMutation(data, { op: 'setDefault', id: 'default:scroll-down', keys }))).toBe(tooLong);
    expect(error(applyMutation(data, { op: 'saveShortcut', shortcut: mine('user:1', keys) }))).toBe(tooLong);
  });

  it('refuses a change the reader would flag, rather than lock the doc as damaged', () => {
    // The background validates messages before they get here; this one skipped that.
    const shortcut = mine('user:1', 'n', { label: 'x'.repeat(101) });
    expect(error(applyMutation(parseSync({}), { op: 'saveShortcut', shortcut }))).toBe(
      "This change would damage your global shortcuts, so AnyKey didn't save it.",
    );
  });
});

describe('docs with problems', () => {
  const newer = { global: { v: 2, shortcuts: [mine('user:1', 'n')], future: {} } };

  it('refuses to write over a doc from a newer version', () => {
    const data = parseSync(newer);
    expect(error(applyMutation(data, { op: 'saveShortcut', shortcut: mine('user:2', 'm') }))).toMatch(/newer version/);
    // Docs without problems still change.
    expect(applyMutation(data, { op: 'setSettings', settings: { scrollStep: 90 } }).ok).toBe(true);
  });

  it('repairs a doc by writing back what this version reads', () => {
    const repaired = ok(applyMutation(parseSync(newer), { op: 'repairDoc', key: 'global' })).data;
    expect(repaired.items.global).toEqual({ v: 1, shortcuts: [mine('user:1', 'n')], overrides: {} });
    expect(repaired.problems.size).toBe(0);
    expect(error(applyMutation(repaired, { op: 'repairDoc', key: 'global' }))).toMatch(/no repair/);
  });
});

describe('setSiteDefault', () => {
  it("sets a built-in shortcut's switch for one site, and removes it again", () => {
    const on = run({}, { op: 'setSiteDefault', site: 'www.youtube.com', id: 'default:scroll-down', enabled: true });
    expect(on.items['site:www.youtube.com']).toEqual({
      v: 1,
      shortcuts: [],
      globals: { 'default:scroll-down': { enabled: true } },
    });
    const cleared = ok(applyMutation(on, { op: 'setSiteDefault', site: 'www.youtube.com', id: 'default:scroll-down' })).data;
    expect(cleared.items).not.toHaveProperty(['site:www.youtube.com']);
  });

  it('refuses unknown defaults and sites', () => {
    const data = parseSync({});
    expect(error(applyMutation(data, { op: 'setSiteDefault', site: 'a.com', id: 'default:nope', enabled: true }))).toMatch(
      /no built-in/,
    );
    expect(error(applyMutation(data, { op: 'setSiteDefault', site: 'Not A Host', id: 'default:scroll-down' }))).toMatch(
      /site such as/,
    );
  });
});

describe('setPresetOverride', () => {
  it('stores the change with canonical keys, and removes the doc once nothing is changed', () => {
    const changed = run(
      {},
      { op: 'setPresetOverride', preset: 'github', id: 'preset:github:star', override: { keys: 'CTRL+S', keyMode: 'key' } },
      { op: 'setPresetOverride', preset: 'github', id: 'preset:github:releases', override: { enabled: false } },
    );
    expect(changed.items['preset:github']).toEqual({
      v: 1,
      overrides: { 'preset:github:star': { keys: 'ctrl+s', keyMode: 'key' }, 'preset:github:releases': { enabled: false } },
    });
    const back = run(
      changed.items,
      { op: 'setPresetOverride', preset: 'github', id: 'preset:github:star', override: {} },
      { op: 'setPresetOverride', preset: 'github', id: 'preset:github:releases', override: {} },
    );
    expect(back.items).not.toHaveProperty(['preset:github']);
  });

  it("refuses another preset's shortcut", () => {
    const result = applyMutation(parseSync({}), {
      op: 'setPresetOverride',
      preset: 'github',
      id: 'preset:youtube:like',
      override: { enabled: false },
    });
    expect(error(result)).toMatch(/no shortcut/);
  });
});

describe('resetToPreset', () => {
  const items = {
    'preset:github': { v: 1, overrides: { 'preset:github:star': { enabled: false } } },
    'site:github.com': {
      v: 1,
      shortcuts: [onSite('user:1', 'g x')],
      globals: { 'default:scroll-top': { enabled: true } },
    },
  };

  it("clears the preset's changes and the site's switches, and keeps the site's shortcuts", () => {
    const result = ok(
      applyMutation(parseSync(items), { op: 'resetToPreset', preset: 'github', site: 'github.com', deleteShortcuts: false }),
    );
    expect(result.data.items).toEqual({ 'site:github.com': { v: 1, shortcuts: [onSite('user:1', 'g x')] } });
    expect([...result.touched].sort()).toEqual(['preset:github', 'site:github.com']);
  });

  it("also deletes the site's shortcuts when asked", () => {
    const data = run(items, { op: 'resetToPreset', preset: 'github', site: 'github.com', deleteShortcuts: true });
    expect(data.items).toEqual({});
  });
});

describe('replaceAll', () => {
  it('replaces every known doc, keeps unknown keys, and clears problems', () => {
    const before = parseSync({
      settings: { v: 1, scrollStep: 90 },
      global: { v: 2 },
      'site:old.example': { v: 1, disabled: true },
      'preset:github': { v: 1, overrides: { 'preset:github:star': { enabled: false } } },
      'future:thing': { v: 1 },
    });
    const result = ok(
      applyMutation(before, {
        op: 'replaceAll',
        items: {
          'site:new.example': { v: 1, disabled: true },
          'preset:youtube': { v: 1, overrides: { 'preset:youtube:like': { enabled: false } } },
          other: 1,
        },
      }),
    );
    expect(result.data.items).toEqual({
      'future:thing': { v: 1 },
      'site:new.example': { v: 1, disabled: true, shortcuts: [] },
      'preset:youtube': { v: 1, overrides: { 'preset:youtube:like': { enabled: false } } },
    });
    expect(result.data.problems.size).toBe(0);
    expect([...result.touched].sort()).toEqual([
      'global',
      'preset:github',
      'preset:youtube',
      'settings',
      'site:new.example',
      'site:old.example',
    ]);
  });

  it('leaves the restore to the background writer', () => {
    expect(applyMutation(parseSync({}), { op: 'restoreBackup' }).ok).toBe(false);
  });
});

describe('restoreItems', () => {
  it('puts the backup back exactly, even what this version reads only partly, and keeps unknown keys', () => {
    const current = parseSync({ settings: { v: 1, scrollStep: 90 }, 'site:old.example': { v: 1, disabled: true }, other: 1 });
    const newer = { v: 2, shortcuts: [], future: { kept: true } };
    const result = ok(restoreItems(current, { global: newer, 'site:new.example': { v: 1, disabled: true }, ignored: 2 }));
    expect(result.data.items).toEqual({ other: 1, global: newer, 'site:new.example': { v: 1, disabled: true } });
    expect(result.data.problems.get('global')).toBe('newer');
    expect([...result.touched].sort()).toEqual(['global', 'settings', 'site:new.example', 'site:old.example']);
  });

  it('refuses a backup that would pass the 100 KB quota', () => {
    const current = parseSync({ other: 'x'.repeat(98_000) });
    const items = { global: { v: 1, shortcuts: [], note: 'y'.repeat(5000) } };
    expect(error(restoreItems(current, items))).toMatch(/100 KB/);
  });
});
