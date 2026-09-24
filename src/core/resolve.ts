import { DEFAULT_SHORTCUTS } from './defaults';
import type { SiteState, SyncState } from './docs';
import { sequenceTokens } from './keys';
import { matchesPattern } from './matchPattern';
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

/**
 * Every shortcut that applies to a page, ready for `resolve()` (steps 1, 2 and 4 of docs/design.md, "Resolution"):
 * nothing on a switched-off host; otherwise the defaults, the user's global shortcuts, and the user's site shortcuts
 * from every site doc whose match pattern takes the URL.
 */
export function shortcutsForUrl(state: SyncState, url: UrlParts | null): Shortcut[] {
  const site = url === null ? undefined : state.sites.get(url.host);
  if (site?.disabled === true) return [];
  const siteShortcuts =
    url === null
      ? []
      : [...state.sites.values()].flatMap((doc) =>
          doc.shortcuts.filter((shortcut) => shortcut.scope.type === 'site' && matchesPattern(shortcut.scope.match, url)),
        );
  return [...effectiveDefaults(state, site), ...state.global.shortcuts, ...siteShortcuts];
}
