import { DEFAULT_SHORTCUTS } from './defaults';
import type { SiteState, SyncState } from './docs';
import { sequenceTokens } from './keys';
import { matchesPattern } from './matchPattern';
import { covers, presetHosts, presetShortcut, type Preset, type ReservedKey } from './presets';
import type { Shortcut } from './schema';
import type { UrlParts } from './url';

export interface Shadowed {
  shortcut: Shortcut;
  /** The higher-precedence shortcut that takes its keys. */
  by: Shortcut;
}

export interface Resolution {
  /** In precedence order, highest first. */
  active: Shortcut[];
  shadowed: Shadowed[];
}

/** Precedence: user site > user global > preset > default. */
export function rankOf(shortcut: Shortcut): number {
  if (shortcut.source === 'user') return shortcut.scope.type === 'site' ? 3 : 2;
  return shortcut.source === 'preset' ? 1 : 0;
}

/**
 * Picks the shortcuts that can fire (rules in docs/design.md, "Resolution"). Disabled shortcuts and unparseable
 * keys drop out. For identical key sequences the higher-precedence shortcut wins, and the first one wins within a
 * rank. A higher-precedence sequence also shadows lower-precedence sequences that start with it, so a user's `g`
 * never waits behind a preset's `g e`.
 */
export function resolve(input: { shortcuts: readonly Shortcut[]; isMac: boolean }): Resolution {
  const entries = input.shortcuts
    .filter((shortcut) => shortcut.enabled)
    .flatMap((shortcut) => {
      const tokens = sequenceTokens(shortcut.keys, shortcut.keyMode, input.isMac);
      return tokens === null ? [] : [{ shortcut, tokens, rank: rankOf(shortcut) }];
    })
    // Array.prototype.sort is stable, so input order breaks ties within a rank.
    .sort((a, b) => b.rank - a.rank);

  const winners: typeof entries = [];
  const shadowed: Shadowed[] = [];
  for (const entry of entries) {
    const winner = winners.find(
      (w) =>
        w.shortcut.keyMode === entry.shortcut.keyMode &&
        (w.rank > entry.rank ? startsWith(entry.tokens, w.tokens) : sameTokens(entry.tokens, w.tokens)),
    );
    if (winner === undefined) winners.push(entry);
    else shadowed.push({ shortcut: entry.shortcut, by: winner.shortcut });
  }
  return { active: winners.map((w) => w.shortcut), shadowed };
}

function startsWith(tokens: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length <= tokens.length && prefix.every((token, i) => tokens[i] === token);
}

function sameTokens(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && startsWith(a, b);
}

/** The built-in shortcuts with the user's changes: global overrides, then the host's own on/off switches. */
export function effectiveDefaults(state: SyncState, site?: SiteState): Shortcut[] {
  return DEFAULT_SHORTCUTS.map((shortcut) => {
    const override = state.global.overrides.get(shortcut.id);
    const enabled = site?.globals.get(shortcut.id) ?? override?.enabled ?? shortcut.enabled;
    if (override === undefined && enabled === shortcut.enabled) return shortcut;
    return {
      ...shortcut,
      keys: override?.keys ?? shortcut.keys,
      keyMode: override?.keyMode ?? shortcut.keyMode,
      enabled,
    };
  });
}

/** A key a site uses itself, from its preset's reserved keys. */
export interface NativeKey {
  /** Key-mode notation: "g c", "?". */
  keys: string;
  label: string;
  /** The site's name, from its preset: "GitHub". */
  site: string;
  /** The pages it works on, as match patterns, when not every page of the site. */
  matches?: readonly string[];
  /** Built-in shortcuts, by id, that give way to this key where it works, so they don't take it there. */
  yieldedBy?: readonly string[];
}

/** A built-in shortcut that is off on a page because the site uses its keys. */
export interface Yielded {
  /** As the user has it everywhere else. */
  shortcut: Shortcut;
  /** The site's key it gives way to. */
  native: NativeKey;
}

export interface PageShortcuts {
  /** Every shortcut that applies to the page, ready for `resolve()`. Those that are off here are included, off. */
  shortcuts: Shortcut[];
  /** The presets for the page's site. */
  presets: Preset[];
  /** The site's own keys that work on the page. */
  native: NativeKey[];
  /** Built-in shortcuts that would run on the page, but give way to the site's own keys there. */
  yielded: Yielded[];
}

/**
 * Every shortcut that applies to a page (steps 1 to 4 of docs/design.md, "Resolution"): nothing on a switched-off
 * host; otherwise the defaults, less those that give way to the site's keys; the shortcuts of the presets for the
 * site, with the user's changes; the user's global shortcuts; and the user's site shortcuts from every site doc
 * whose match pattern takes the URL.
 */
export function pageShortcuts(state: SyncState, presets: readonly Preset[], url: UrlParts | null): PageShortcuts {
  if (url === null) {
    return { shortcuts: [...effectiveDefaults(state), ...state.global.shortcuts], presets: [], native: [], yielded: [] };
  }
  const site = state.sites.get(url.host);
  if (site?.disabled === true) return { shortcuts: [], presets: [], native: [], yielded: [] };
  const covering = presets.filter((preset) => covers(preset.matches, url));
  const reserved = covering.flatMap((preset) =>
    preset.reserved.filter((key) => covers(key.matches, url)).map((key) => ({ key, native: nativeKey(preset, key) })),
  );

  const yielded: Yielded[] = [];
  const defaults = effectiveDefaults(state, site).map((shortcut) => {
    // The site's own switch for a default beats the preset.
    const taken = site?.globals.has(shortcut.id) === true ? undefined : reserved.find(({ key }) => yieldsTo(key, shortcut));
    if (taken === undefined) return shortcut;
    if (shortcut.enabled) yielded.push({ shortcut, native: taken.native });
    return { ...shortcut, enabled: false };
  });
  const fromPresets = covering.flatMap((preset) => presetShortcuts(state, preset, url));
  const siteShortcuts = [...state.sites.values()].flatMap((doc) =>
    doc.shortcuts.filter((shortcut) => shortcut.scope.type === 'site' && matchesPattern(shortcut.scope.match, url)),
  );
  return {
    shortcuts: [...defaults, ...fromPresets, ...state.global.shortcuts, ...siteShortcuts],
    presets: covering,
    native: reserved.map(({ native }) => native),
    yielded,
  };
}

/** A preset's shortcuts with the user's changes: those for the page at `url`, or all of them. */
function presetShortcuts(state: SyncState, preset: Preset, url?: UrlParts): Shortcut[] {
  const overrides = state.presets.get(preset.id);
  return preset.shortcuts
    .filter((shortcut) => url === undefined || covers(shortcut.matches, url))
    .map((shortcut) => presetShortcut(preset, shortcut, overrides?.get(shortcut.id)));
}

export interface SiteShortcuts {
  /**
   * Every shortcut that can run on some page of the site: the built-in ones as the user has them there, the
   * shortcuts of the site's presets, the user's global shortcuts, and the shortcuts kept with the site.
   */
  shortcuts: Shortcut[];
  /** The presets for the site. */
  presets: Preset[];
  /** The site's own keys, on any of its pages, each with the built-in shortcuts that give way to it. */
  native: NativeKey[];
}

/**
 * A whole site at once, for the options page: unlike `pageShortcuts`, it leaves out no preset shortcut or site key
 * for being on other pages. A built-in shortcut that gives way to a site key stays in, since it runs on the site's
 * other pages, and the key names it in `yieldedBy` instead.
 */
export function shortcutsOnSite(state: SyncState, presets: readonly Preset[], host: string): SiteShortcuts {
  const site = state.sites.get(host);
  const own = presets.filter((preset) => presetHosts(preset).includes(host));
  const defaults = effectiveDefaults(state, site);
  const native = own.flatMap((preset) =>
    preset.reserved.map((key): NativeKey => {
      const yieldedBy = defaults
        .filter((shortcut) => site?.globals.has(shortcut.id) !== true && yieldsTo(key, shortcut))
        .map(({ id }) => id);
      return { ...nativeKey(preset, key), ...(yieldedBy.length > 0 ? { yieldedBy } : {}) };
    }),
  );
  return {
    shortcuts: [
      ...defaults,
      ...own.flatMap((preset) => presetShortcuts(state, preset)),
      ...state.global.shortcuts,
      ...(site?.shortcuts ?? []),
    ],
    presets: own,
    native,
  };
}

const DEFAULTS_BY_ID = new Map(DEFAULT_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

/**
 * Whether a built-in shortcut gives way to a key the site uses itself: the preset says so, and the user left the
 * shortcut on its own keys. User settings always win over presets, so a rekeyed default never gives way.
 */
function yieldsTo(key: ReservedKey, shortcut: Shortcut): boolean {
  const base = DEFAULTS_BY_ID.get(shortcut.id);
  const ownKeys = shortcut.keys === base?.keys && shortcut.keyMode === base.keyMode;
  // Both are in canonical notation, so the same keys are the same text.
  return key.yield === true && ownKeys && shortcut.keyMode === 'key' && shortcut.keys === key.keys;
}

function nativeKey(preset: Preset, key: ReservedKey): NativeKey {
  return { keys: key.keys, label: key.label, site: preset.name, ...(key.matches === undefined ? {} : { matches: key.matches }) };
}

/** A built-in shortcut that gives way somewhere on a preset's site. */
export interface PresetYield {
  /** As the user has it everywhere else. */
  shortcut: Shortcut;
  /** Every site key it gives way to, each on its own pages: GitHub's `j` moves through lists and the network graph. */
  natives: NativeKey[];
}

/**
 * The built-in shortcuts that give way to the site's own keys on some page of a preset's site, as the user has them
 * everywhere else: for the options page, which lets the user keep them on the site instead. A shortcut the user
 * turned off everywhere gives way to nothing, so it is left out, unless the site has a switch of its own for it.
 */
export function presetYields(state: SyncState, preset: Preset, site?: SiteState): PresetYield[] {
  return effectiveDefaults(state).flatMap((shortcut) => {
    if (!shortcut.enabled && site?.globals.has(shortcut.id) !== true) return [];
    const natives = preset.reserved.filter((key) => yieldsTo(key, shortcut)).map((key) => nativeKey(preset, key));
    return natives.length === 0 ? [] : [{ shortcut, natives }];
  });
}
