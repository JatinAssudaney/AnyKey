import { describe, expect, it } from 'vitest';
import github from '../../presets/github.json';
import reddit from '../../presets/reddit.json';
import youtube from '../../presets/youtube.json';
import { findConflicts } from './conflicts';
import { DEFAULT_SHORTCUTS } from './defaults';
import { EMPTY_STATE } from './docs';
import {
  parsePresets,
  PresetOverrideSchema,
  presetHosts,
  presetOverride,
  PresetSchema,
  presetShortcut,
  type Preset,
  type PresetShortcut,
} from './presets';
import { pageShortcuts } from './resolve';

const shortcut: PresetShortcut = {
  id: 'preset:tube:like',
  keys: 'g l',
  keyMode: 'key',
  action: { type: 'click', target: { selector: '#like' } },
  label: 'Like the video',
  verified: false,
};

const tube: Preset = {
  schemaVersion: 1,
  id: 'tube',
  name: 'Tube',
  version: 1,
  matches: ['*://tube.example/*', '*://*.tube.example/*', '*://m.tube.example/*'],
  reserved: [{ keys: 'k', label: 'Play or pause', yield: true, matches: ['*://tube.example/watch*'] }],
  shortcuts: [shortcut],
};

describe('PresetSchema', () => {
  it('takes a preset with canonical keys and ids of its own', () => {
    expect(PresetSchema.safeParse(tube).success).toBe(true);
  });

  it('refuses keys not in canonical notation, and shortcut ids outside the preset or repeated', () => {
    const issues = (preset: unknown) => {
      const result = PresetSchema.safeParse(preset);
      return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
    };
    expect(issues({ ...tube, reserved: [{ keys: 'Ctrl+K', label: 'Search' }] })).toEqual(['reserved.0.keys']);
    expect(issues({ ...tube, shortcuts: [{ ...shortcut, keys: 'shift+g' }] })).toEqual(['shortcuts.0.keys']);
    expect(issues({ ...tube, shortcuts: [{ ...shortcut, id: 'preset:other:like' }] })).toEqual(['shortcuts.0.id']);
    expect(issues({ ...tube, shortcuts: [shortcut, shortcut] })).toEqual(['shortcuts.1.id']);
  });
});

describe('parsePresets', () => {
  it('keeps the valid presets, once per id, and never throws', () => {
    const broken = { ...tube, id: 'broken', matches: [] };
    const again = { ...tube, name: 'Tube again' };
    expect(parsePresets([tube, broken, again, 'x', null])).toEqual([tube]);
    for (const value of [undefined, null, 'presets', { tube }, [1]]) expect(parsePresets(value)).toEqual([]);
  });
});

describe('PresetOverrideSchema', () => {
  it('takes keys only with their key mode, so they can be checked without the preset', () => {
    expect(PresetOverrideSchema.safeParse({ enabled: false }).success).toBe(true);
    expect(PresetOverrideSchema.safeParse({ keys: 'ctrl+l', keyMode: 'key' }).success).toBe(true);
    expect(PresetOverrideSchema.safeParse({ keys: 'ctrl+l' }).success).toBe(false);
    expect(PresetOverrideSchema.safeParse({ keyMode: 'code' }).success).toBe(false);
    expect(PresetOverrideSchema.safeParse({ keys: 'shift+/', keyMode: 'key' }).success).toBe(false);
  });
});

describe('presetOverride', () => {
  it("keeps only what differs from the preset's own shortcut, with keys in canonical notation", () => {
    expect(presetOverride(shortcut, undefined, { keys: 'Ctrl+L' })).toEqual({ keys: 'ctrl+l', keyMode: 'key' });
    expect(presetOverride(shortcut, undefined, { keys: 'g  l' })).toEqual({});
    expect(presetOverride(shortcut, { keys: 'ctrl+l', keyMode: 'key' }, { enabled: false })).toEqual({
      keys: 'ctrl+l',
      keyMode: 'key',
      enabled: false,
    });
    expect(presetOverride(shortcut, { enabled: false }, { enabled: true })).toEqual({});
    expect(presetOverride(shortcut, undefined, { keys: 'KeyL', keyMode: 'code' })).toEqual({ keys: 'KeyL', keyMode: 'code' });
  });
});

describe('presetShortcut', () => {
  it("is the preset's shortcut as the user has it", () => {
    expect(presetShortcut(tube, shortcut)).toEqual({
      id: 'preset:tube:like',
      keys: 'g l',
      keyMode: 'key',
      action: shortcut.action,
      scope: { type: 'site', match: '*://tube.example/*' },
      label: 'Like the video',
      source: 'preset',
      verified: false,
      enabled: true,
    });
    expect(presetShortcut(tube, shortcut, { keys: 'KeyL', keyMode: 'code', enabled: false })).toMatchObject({
      keys: 'KeyL',
      keyMode: 'code',
      enabled: false,
    });
  });
});

describe('presetHosts', () => {
  it('lists the hosts the patterns name, leaving out patterns for many hosts', () => {
    expect(presetHosts(tube)).toEqual(['tube.example', 'm.tube.example']);
  });
});

describe('bundled presets', () => {
  const bundled: unknown[] = [github, youtube, reddit];
  const presets = parsePresets(bundled);

  it('are valid, with nothing the schema would drop', () => {
    for (const raw of bundled) {
      const result = PresetSchema.safeParse(raw);
      expect(result.success ? [] : result.error.issues).toEqual([]);
      expect(result.data).toEqual(raw);
    }
    expect(presets.map((preset) => preset.id)).toEqual(['github', 'youtube', 'reddit']);
  });

  it("add shortcuts only on keys the site doesn't use, on any of its pages", () => {
    for (const preset of presets) {
      const native = preset.reserved.map((key) => ({ ...key, site: preset.name }));
      const own = preset.shortcuts.map((entry) => presetShortcut(preset, entry));
      for (const isMac of [false, true]) {
        const found = [...findConflicts(own, isMac, native)].flatMap(([id, conflicts]) =>
          conflicts.map((conflict) => `${id}: ${conflict.kind}`),
        );
        expect(found).toEqual([]);
      }
    }
  });

  it("let only AnyKey's built-in keys give way, and list each of the site's keys once", () => {
    const builtIn = new Set(DEFAULT_SHORTCUTS.map((entry) => entry.keys));
    for (const preset of presets) {
      for (const key of preset.reserved) if (key.yield === true) expect(builtIn).toContain(key.keys);
      const entries = preset.reserved.map((key) => JSON.stringify([key.keys, key.matches]));
      expect(entries.filter((entry, i) => entries.indexOf(entry) !== i)).toEqual([]);
    }
  });

  it('give way where the sites use the same keys as AnyKey', () => {
    const yielded = (href: string): string[] => {
      const url = new URL(href);
      const parts = { scheme: url.protocol.slice(0, -1), host: url.hostname, port: url.port, path: url.pathname + url.search };
      return pageShortcuts(EMPTY_STATE, presets, parts).yielded.map(({ shortcut: { keys } }) => keys);
    };
    expect(yielded('https://github.com/')).toEqual([]);
    expect(yielded('https://github.com/owner/repo')).toEqual(['g g']);
    // GitHub's lists take j and k to move their focus, and x to select the focused item.
    expect(yielded('https://github.com/owner/repo/issues?q=is%3Aopen')).toEqual(['j', 'k', 'u', 'g g', 'x']);
    expect(yielded('https://github.com/owner/repo/pulls')).toEqual(['j', 'k', 'u', 'g g', 'x']);
    expect(yielded('https://github.com/owner/repo/issues/5')).toEqual(['g g', 'x']);
    expect(yielded('https://github.com/owner/repo/pull/12/files')).toEqual(['g g', 'x']);
    expect(yielded('https://github.com/owner/repo/actions/runs/1')).toEqual(['g g', 'g f']);
    expect(yielded('https://github.com/owner/repo/network')).toEqual(['j', 'k', 'g g', 'H', 'L', 'J', 'K']);
    // The graph's keys work on the graph only, not on the other network pages.
    expect(yielded('https://github.com/owner/repo/network/dependencies')).toEqual(['g g']);
    expect(yielded('https://www.youtube.com/')).toEqual([]);
    expect(yielded('https://www.youtube.com/watch?v=abc')).toEqual(['j', 'k']);
    expect(yielded('https://www.reddit.com/r/AskReddit/')).toEqual(['j', 'k', 'x']);
    expect(yielded('https://www.reddit.com/mod/AskReddit/queue')).toEqual(['j', 'k', 'd', 'x']);
    expect(yielded('https://old.reddit.com/')).toEqual([]);
  });
});
