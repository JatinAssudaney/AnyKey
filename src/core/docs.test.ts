import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { effectiveSettings, EMPTY_STATE, itemBytes, parseSync, serializeDoc, siteKey, type SyncState } from './docs';
import type { Shortcut } from './schema';

function userShortcut(id: string, keys: string, site?: string): Shortcut {
  return {
    id,
    keys,
    keyMode: 'key',
    action: { type: 'scroll', direction: 'down' },
    scope: site === undefined ? { type: 'global' } : { type: 'site', match: `*://${site}/*` },
    label: id,
    source: 'user',
    enabled: true,
  };
}

describe('parseSync', () => {
  it('reads empty storage as no changes', () => {
    const { state, problems } = parseSync({});
    expect(state).toEqual(EMPTY_STATE);
    expect(problems.size).toBe(0);
  });

  it('reads the settings it can and reports the rest', () => {
    const { state, problems } = parseSync({ settings: { v: 1, scrollStep: 120, smoothScroll: 'yes' } });
    expect(state.settings).toEqual({ scrollStep: 120 });
    expect(problems.get('settings')).toBe('invalid');
    expect(effectiveSettings(state)).toEqual({ ...DEFAULT_SETTINGS, scrollStep: 120 });
  });

  it('reads a doc from a newer version and marks it newer, not damaged', () => {
    const j = userShortcut('user:1', 'n');
    const { state, problems } = parseSync({ global: { v: 2, shortcuts: [j, { future: true }] } });
    expect(state.global.shortcuts).toEqual([j]);
    expect(problems.get('global')).toBe('newer');
  });

  it('reports a doc without a version as damaged', () => {
    expect(parseSync({ settings: { scrollStep: 120 } }).problems.get('settings')).toBe('invalid');
    expect(parseSync({ settings: 'x' }).problems.get('settings')).toBe('invalid');
  });

  it('keeps only user shortcuts of the right scope, once per id', () => {
    const good = userShortcut('user:1', 'n');
    const { state, problems } = parseSync({
      global: {
        v: 1,
        shortcuts: [
          good,
          { ...good, keys: 'm' },
          userShortcut('user:2', 'm', 'example.com'),
          { ...userShortcut('default:scroll-down', 'j'), source: 'default' },
        ],
      },
    });
    expect(state.global.shortcuts).toEqual([good]);
    expect(problems.get('global')).toBe('invalid');
  });

  it('reads default overrides and skips bad entries', () => {
    const { state, problems } = parseSync({
      global: {
        v: 1,
        overrides: { 'default:scroll-down': { keys: 'n' }, 'default:x': { enabled: 'no' }, '': { enabled: false } },
      },
    });
    expect([...state.global.overrides]).toEqual([['default:scroll-down', { keys: 'n' }]]);
    expect(problems.get('global')).toBe('invalid');
  });

  it("skips overrides with keys the built-in shortcut can't use, and keeps overrides of unknown built-ins", () => {
    const { state, problems } = parseSync({
      global: {
        v: 1,
        overrides: {
          'default:scroll-up': { keys: 'shift+/' },
          // Scroll down's "j" is a character, not a physical key code.
          'default:scroll-down': { keyMode: 'code' },
          'default:from-a-later-version': { keys: 'n' },
        },
      },
    });
    expect([...state.global.overrides]).toEqual([['default:from-a-later-version', { keys: 'n' }]]);
    expect(problems.get('global')).toBe('invalid');
  });

  it('reads site docs by host and reports keys that are not hosts', () => {
    const site = userShortcut('user:3', 'g x', 'github.com');
    const { state, problems } = parseSync({
      'site:github.com': { v: 1, disabled: true, shortcuts: [site], globals: { 'default:tab-close': { enabled: false } } },
      'site:Not A Host': { v: 1, disabled: true },
    });
    expect(state.sites.get('github.com')).toEqual({
      disabled: true,
      shortcuts: [site],
      globals: new Map([['default:tab-close', false]]),
    });
    expect(state.sites.has('Not A Host')).toBe(false);
    expect(problems.get('site:Not A Host')).toBe('invalid');
  });

  it('keeps unknown keys in the raw items and ignores them otherwise', () => {
    const data = parseSync({ 'preset:github': { v: 1, overrides: {} } });
    expect(data.items).toHaveProperty(['preset:github']);
    expect(data.problems.size).toBe(0);
  });
});

describe('serializeDoc', () => {
  const state: SyncState = {
    settings: { scrollStep: 90 },
    global: { shortcuts: [userShortcut('user:1', 'n')], overrides: new Map([['default:tab-close', { enabled: false }]]) },
    sites: new Map([
      ['example.com', { disabled: true, shortcuts: [], globals: new Map() }],
      ['github.com', { disabled: false, shortcuts: [userShortcut('user:2', 'g x', 'github.com')], globals: new Map() }],
    ]),
  };

  it('writes docs that read back as the same state', () => {
    const items = Object.fromEntries(
      ['settings', 'global', siteKey('example.com'), siteKey('github.com')].map((key) => [key, serializeDoc(state, key)]),
    );
    const read = parseSync(items);
    expect(read.state).toEqual(state);
    expect(read.problems.size).toBe(0);
  });

  it('returns undefined for docs with nothing in them, so the key is removed', () => {
    expect(serializeDoc(EMPTY_STATE, 'settings')).toBeUndefined();
    expect(serializeDoc(EMPTY_STATE, 'global')).toBeUndefined();
    const idle = { ...EMPTY_STATE, sites: new Map([['a.com', { disabled: false, shortcuts: [], globals: new Map() }]]) };
    expect(serializeDoc(idle, siteKey('a.com'))).toBeUndefined();
  });
});

describe('itemBytes', () => {
  it('counts UTF-8 bytes of the key and the JSON value', () => {
    expect(itemBytes('k', 'é')).toBe(1 + 4);
    expect(itemBytes('ké', 1)).toBe(3 + 1);
  });

  it('counts "<" as the six-character escape Chrome writes', () => {
    expect(itemBytes('k', '<')).toBe(1 + 8);
  });
});
