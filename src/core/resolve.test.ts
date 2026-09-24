import { describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUTS } from './defaults';
import { EMPTY_STATE, type SiteState, type SyncState } from './docs';
import type { Preset } from './presets';
import { effectiveDefaults, pageShortcuts, presetYields, resolve, shortcutsOnSite } from './resolve';
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

const url = (host: string, path = '/') => ({ scheme: 'https', host, port: '', path });

function site(partial: Partial<SiteState>): SiteState {
  return { disabled: false, shortcuts: [], globals: new Map(), ...partial };
}

describe('effectiveDefaults', () => {
  it('applies global overrides, then the host\'s own switches', () => {
    const state: SyncState = {
      ...EMPTY_STATE,
      global: {
        shortcuts: [],
        overrides: new Map([
          ['default:scroll-down', { keys: 'n' }],
          ['default:tab-close', { enabled: false }],
        ]),
      },
    };
    const byId = (list: readonly Shortcut[]) => new Map(list.map((s) => [s.id, s]));
    const everywhere = byId(effectiveDefaults(state));
    expect(everywhere.get('default:scroll-down')).toMatchObject({ keys: 'n', enabled: true });
    expect(everywhere.get('default:tab-close')?.enabled).toBe(false);
    expect(everywhere.get('default:scroll-up')).toBe(DEFAULT_SHORTCUTS[1]);

    const onSite = byId(effectiveDefaults(state, site({ globals: new Map([['default:tab-close', true]]) })));
    expect(onSite.get('default:tab-close')?.enabled).toBe(true);
  });
});

describe('pageShortcuts', () => {
  const global = shortcut('user:global', 'n', 'user');
  const github = shortcut('user:gh', 'g x', 'user', true);
  const githubSite: Shortcut = { ...github, scope: { type: 'site', match: '*://github.com/*' } };
  const state: SyncState = {
    ...EMPTY_STATE,
    global: { shortcuts: [global], overrides: new Map() },
    sites: new Map([
      ['github.com', site({ shortcuts: [githubSite] })],
      ['off.example', site({ disabled: true })],
    ]),
  };
  const shortcutIds = (...args: Parameters<typeof pageShortcuts>) => ids(pageShortcuts(...args).shortcuts);

  it('adds the site shortcuts whose pattern matches the URL', () => {
    expect(shortcutIds(state, [], url('github.com', '/issues'))).toEqual([
      ...ids(DEFAULT_SHORTCUTS),
      'user:global',
      'user:gh',
    ]);
    expect(shortcutIds(state, [], url('example.com'))).toEqual([...ids(DEFAULT_SHORTCUTS), 'user:global']);
  });

  it('gives nothing on a switched-off host, and no site shortcuts without a URL', () => {
    expect(pageShortcuts(state, [tube], url('off.example'))).toEqual({ shortcuts: [], presets: [], native: [], yielded: [] });
    expect(shortcutIds(state, [tube], null)).toEqual([...ids(DEFAULT_SHORTCUTS), 'user:global']);
  });
});

/** A preset for a made-up video site, whose player takes j and k on watch pages and x everywhere. */
const tube: Preset = {
  schemaVersion: 1,
  id: 'tube',
  name: 'Tube',
  version: 1,
  matches: ['*://tube.example/*'],
  reserved: [
    { keys: '?', label: 'Show keyboard shortcuts' },
    { keys: 'k', label: 'Play or pause', yield: true, matches: ['*://tube.example/watch*'] },
    { keys: 'j', label: 'Go back 10 seconds', yield: true, matches: ['*://tube.example/watch*'] },
    { keys: 'x', label: 'Close the player', yield: true },
    { keys: 'f', label: 'Full screen', matches: ['*://tube.example/watch*'] },
  ],
  shortcuts: [
    {
      id: 'preset:tube:like',
      keys: 'g l',
      keyMode: 'key',
      action: { type: 'click', target: { selector: '#like' } },
      label: 'Like the video',
      verified: false,
      matches: ['*://tube.example/watch*'],
    },
    {
      id: 'preset:tube:home',
      keys: 'g h',
      keyMode: 'key',
      action: { type: 'navigate', url: '/' },
      label: 'Go home',
      verified: true,
    },
  ],
};

const watch = url('tube.example', '/watch?v=1');
const home = url('tube.example', '/');

describe('presets', () => {
  const byId = (list: readonly Shortcut[]) => new Map(list.map((s) => [s.id, s]));

  it('turn off defaults on the pages where the site uses their keys, and nowhere else', () => {
    const onWatch = pageShortcuts(EMPTY_STATE, [tube], watch);
    const shortcuts = byId(onWatch.shortcuts);
    expect(shortcuts.get('default:scroll-down')?.enabled).toBe(false);
    expect(shortcuts.get('default:scroll-up')?.enabled).toBe(false);
    expect(shortcuts.get('default:tab-close')?.enabled).toBe(false);
    expect(onWatch.yielded.map((y) => [y.shortcut.id, y.native.label])).toEqual([
      ['default:scroll-down', 'Go back 10 seconds'],
      ['default:scroll-up', 'Play or pause'],
      ['default:tab-close', 'Close the player'],
    ]);
    expect(onWatch.native.map((key) => key.keys)).toEqual(['?', 'k', 'j', 'x', 'f']);
    expect(onWatch.presets).toEqual([tube]);

    const onHome = pageShortcuts(EMPTY_STATE, [tube], home);
    expect(byId(onHome.shortcuts).get('default:scroll-down')?.enabled).toBe(true);
    expect(onHome.yielded.map((y) => y.shortcut.id)).toEqual(['default:tab-close']);
    expect(onHome.native).toEqual([
      { keys: '?', label: 'Show keyboard shortcuts', site: 'Tube' },
      { keys: 'x', label: 'Close the player', site: 'Tube' },
    ]);

    const elsewhere = pageShortcuts(EMPTY_STATE, [tube], url('example.com', '/watch'));
    expect(elsewhere.shortcuts).toEqual([...DEFAULT_SHORTCUTS]);
    expect([elsewhere.presets, elsewhere.native, elsewhere.yielded]).toEqual([[], [], []]);
  });

  it('never turn off what the user set: a rekeyed default, or their own shortcuts on the same keys', () => {
    const onTube: Shortcut = { ...shortcut('user:x', 'x', 'user'), scope: { type: 'site', match: '*://tube.example/*' } };
    const mine: SyncState = {
      ...EMPTY_STATE,
      global: { shortcuts: [shortcut('user:k', 'k', 'user')], overrides: new Map([['default:scroll-down', { keys: 'n' }]]) },
      sites: new Map([['tube.example', site({ shortcuts: [onTube] })]]),
    };
    const page = pageShortcuts(mine, [tube], watch);
    const shortcuts = byId(page.shortcuts);
    expect(shortcuts.get('default:scroll-down')).toMatchObject({ keys: 'n', enabled: true });
    expect(page.yielded.map((y) => y.shortcut.id)).toEqual(['default:scroll-up', 'default:tab-close']);
    expect(ids(resolve({ shortcuts: page.shortcuts, isMac: false }).active)).toEqual(
      expect.arrayContaining(['user:k', 'user:x', 'default:scroll-down']),
    );
  });

  it("follow the site's own switch for a default, whatever the preset says", () => {
    const switched: SyncState = {
      ...EMPTY_STATE,
      sites: new Map([
        [
          'tube.example',
          site({
            globals: new Map([
              ['default:scroll-down', true],
              ['default:tab-close', false],
            ]),
          }),
        ],
      ]),
    };
    const page = pageShortcuts(switched, [tube], watch);
    const shortcuts = byId(page.shortcuts);
    expect(shortcuts.get('default:scroll-down')?.enabled).toBe(true);
    expect(shortcuts.get('default:tab-close')?.enabled).toBe(false);
    // Only what the preset turned off gave way: the user turned x off themselves.
    expect(page.yielded.map((y) => y.shortcut.id)).toEqual(['default:scroll-up']);
  });

  it('say nothing gave way for a default the user turned off everywhere', () => {
    const off: SyncState = {
      ...EMPTY_STATE,
      global: { shortcuts: [], overrides: new Map([['default:tab-close', { enabled: false }]]) },
    };
    expect(pageShortcuts(off, [tube], home).yielded).toEqual([]);
  });

  it("add the preset's shortcuts for the page, with the user's changes, below user shortcuts", () => {
    const changed: SyncState = {
      ...EMPTY_STATE,
      global: { shortcuts: [shortcut('user:gh', 'g h', 'user')], overrides: new Map() },
      presets: new Map([
        [
          'tube',
          new Map([
            ['preset:tube:home', { keys: 'g o', keyMode: 'key' as const }],
            ['preset:tube:like', { enabled: false }],
          ]),
        ],
      ]),
    };
    const onWatch = byId(pageShortcuts(changed, [tube], watch).shortcuts);
    expect(onWatch.get('preset:tube:like')).toMatchObject({ keys: 'g l', enabled: false, source: 'preset', verified: false });
    expect(onWatch.get('preset:tube:home')).toMatchObject({ keys: 'g o', enabled: true, source: 'preset' });
    expect(byId(pageShortcuts(changed, [tube], home).shortcuts).has('preset:tube:like')).toBe(false);

    const { active, shadowed } = resolve({ shortcuts: pageShortcuts(EMPTY_STATE, [tube], watch).shortcuts, isMac: false });
    expect(ids(active)).toEqual(expect.arrayContaining(['preset:tube:like', 'preset:tube:home']));
    expect(shadowed).toEqual([]);
    const mine = resolve({
      shortcuts: pageShortcuts({ ...EMPTY_STATE, global: changed.global }, [tube], watch).shortcuts,
      isMac: false,
    });
    expect(mine.shadowed.map((s) => [s.shortcut.id, s.by.id])).toEqual([['preset:tube:home', 'user:gh']]);
  });

  it("keep the user's changes when a new version of the preset changes its shortcuts", () => {
    const changed: SyncState = {
      ...EMPTY_STATE,
      presets: new Map([
        [
          'tube',
          new Map([
            ['preset:tube:home', { keys: 'g x', keyMode: 'key' as const, enabled: false }],
            ['preset:tube:like', { enabled: false }],
          ]),
        ],
      ]),
    };
    const [like, home] = tube.shortcuts;
    if (like === undefined || home === undefined) throw new Error('The fixture has two shortcuts.');
    const next: Preset = { ...tube, version: 2, shortcuts: [{ ...home, keys: 'g o', label: 'Go to the home page' }] };
    const shortcuts = byId(pageShortcuts(changed, [next], watch).shortcuts);
    expect(shortcuts.get('preset:tube:home')).toMatchObject({ keys: 'g x', enabled: false, label: 'Go to the home page' });
    expect(shortcuts.has('preset:tube:like')).toBe(false);
  });
});

describe('presetYields', () => {
  it('lists the defaults that give way somewhere on the site, as the user has them everywhere else', () => {
    expect(presetYields(EMPTY_STATE, tube).map((y) => y.shortcut.id)).toEqual([
      'default:scroll-down',
      'default:scroll-up',
      'default:tab-close',
    ]);
    const rekeyed: SyncState = {
      ...EMPTY_STATE,
      global: { shortcuts: [], overrides: new Map([['default:scroll-down', { keys: 'n' }], ['default:tab-close', { enabled: false }]]) },
    };
    // A rekeyed default gives way to nothing, and one that is off everywhere has nothing to give.
    expect(presetYields(rekeyed, tube).map((y) => y.shortcut.id)).toEqual(['default:scroll-up']);
    const kept = site({ globals: new Map([['default:tab-close', true]]) });
    expect(presetYields(rekeyed, tube, kept).map((y) => [y.shortcut.id, y.shortcut.enabled])).toEqual([
      ['default:scroll-up', true],
      ['default:tab-close', false],
    ]);
  });
});

describe('shortcutsOnSite', () => {
  it("takes every shortcut and site key for the host, whichever pages they are for, and names what gives way", () => {
    const onTube: Shortcut = { ...shortcut('user:t', 't', 'user'), scope: { type: 'site', match: '*://tube.example/*' } };
    const state: SyncState = {
      ...EMPTY_STATE,
      global: { shortcuts: [shortcut('user:global', 'n', 'user')], overrides: new Map() },
      sites: new Map([['tube.example', site({ shortcuts: [onTube], globals: new Map([['default:tab-close', true]]) })]]),
      presets: new Map([['tube', new Map([['preset:tube:like', { enabled: false }]])]]),
    };
    const whole = shortcutsOnSite(state, [tube], 'tube.example');
    expect(ids(whole.shortcuts)).toEqual([
      ...ids(DEFAULT_SHORTCUTS),
      'preset:tube:like',
      'preset:tube:home',
      'user:global',
      'user:t',
    ]);
    expect(whole.shortcuts.find((s) => s.id === 'preset:tube:like')?.enabled).toBe(false);
    expect(whole.presets).toEqual([tube]);
    // The site's own switch keeps x on, so x gives way to nothing.
    expect(whole.native.map((key) => [key.keys, key.yieldedBy])).toEqual([
      ['?', undefined],
      ['k', ['default:scroll-up']],
      ['j', ['default:scroll-down']],
      ['x', undefined],
      ['f', undefined],
    ]);

    const other = shortcutsOnSite(state, [tube], 'example.com');
    expect(ids(other.shortcuts)).toEqual([...ids(DEFAULT_SHORTCUTS), 'user:global']);
    expect([other.presets, other.native]).toEqual([[], []]);
  });
});
